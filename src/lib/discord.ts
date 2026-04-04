import { supabase } from "@/integrations/supabase/client";

export async function sendDiscordNotification(
  projectId: string,
  title: string,
  message: string,
  type: string
) {
  try {
    const { error } = await supabase.functions.invoke("send-discord-notification", {
      body: { project_id: projectId, title, message, type },
    });
    if (error) console.error("Discord notification error:", error);
  } catch (err) {
    console.error("Discord notification error:", err);
  }
}
