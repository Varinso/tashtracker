import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const TYPE_COLORS: Record<string, number> = {
  task: 0x3b82f6,
  meeting: 0x8b5cf6,
  file: 0x10b981,
  member: 0xf59e0b,
  info: 0x6b7280,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- AUTH: require a valid JWT ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client used only to verify the user's identity
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, title, message, type } = await req.json();

    if (!project_id || typeof project_id !== "string" || !title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "project_id and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for membership check + reading webhooks
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---- AUTHZ: caller must be a member of this project ----
    const { data: membership, error: memberErr } = await admin
      .from("project_members")
      .select("id")
      .eq("project_id", project_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberErr || !membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: webhooks, error } = await admin
      .from("discord_webhooks")
      .select("*")
      .eq("project_id", project_id)
      .eq("enabled", true);

    if (error) {
      console.error("Error fetching webhooks:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch webhooks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifType = type || "info";
    const filtered = webhooks.filter((w: any) => {
      if (notifType === "task" && !w.notify_tasks) return false;
      if (notifType === "meeting" && !w.notify_meetings) return false;
      if (notifType === "file" && !w.notify_files) return false;
      return true;
    });

    const color = TYPE_COLORS[notifType] || TYPE_COLORS.info;

    const results = await Promise.allSettled(
      filtered.map((webhook: any) =>
        fetch(webhook.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title,
                description: message || undefined,
                color,
                footer: { text: `Channel: ${webhook.channel_name}` },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    console.log(`Sent ${sent}/${filtered.length} Discord notifications for project ${project_id}`);

    return new Response(JSON.stringify({ sent, total: filtered.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Discord notification error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
