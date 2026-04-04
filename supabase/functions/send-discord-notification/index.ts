import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const TYPE_COLORS: Record<string, number> = {
  task: 0x3b82f6,    // blue
  meeting: 0x8b5cf6, // purple
  file: 0x10b981,    // green
  member: 0xf59e0b,  // amber
  info: 0x6b7280,    // gray
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { project_id, title, message, type } = await req.json();

    if (!project_id || !title) {
      return new Response(JSON.stringify({ error: "project_id and title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch enabled webhooks for this project, filtered by notification type
    const { data: webhooks, error } = await supabase
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

    // Filter by notification type preference
    const notifType = type || "info";
    const filtered = webhooks.filter((w: any) => {
      if (notifType === "task" && !w.notify_tasks) return false;
      if (notifType === "meeting" && !w.notify_meetings) return false;
      if (notifType === "file" && !w.notify_files) return false;
      return true;
    });

    const color = TYPE_COLORS[notifType] || TYPE_COLORS.info;

    // Send to each webhook
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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
