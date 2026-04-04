import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { Plus, Trash2, TestTube, Webhook, Pencil } from "lucide-react";

interface DiscordWebhook {
  id: string;
  project_id: string;
  channel_name: string;
  webhook_url: string;
  enabled: boolean;
  notify_tasks: boolean;
  notify_meetings: boolean;
  notify_files: boolean;
  created_by: string;
  created_at: string;
}

const DiscordWebhookSettings = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editWebhook, setEditWebhook] = useState<DiscordWebhook | null>(null);

  // Form state
  const [channelName, setChannelName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notifyTasks, setNotifyTasks] = useState(true);
  const [notifyMeetings, setNotifyMeetings] = useState(true);
  const [notifyFiles, setNotifyFiles] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    const { data } = await supabase
      .from("discord_webhooks")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: true });
    setWebhooks((data as DiscordWebhook[]) || []);
    setLoading(false);
  }, [currentProject]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const resetForm = () => {
    setChannelName("");
    setWebhookUrl("");
    setNotifyTasks(true);
    setNotifyMeetings(true);
    setNotifyFiles(true);
    setEditWebhook(null);
  };

  const openAdd = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (wh: DiscordWebhook) => {
    setEditWebhook(wh);
    setChannelName(wh.channel_name);
    setWebhookUrl(wh.webhook_url);
    setNotifyTasks(wh.notify_tasks);
    setNotifyMeetings(wh.notify_meetings);
    setNotifyFiles(wh.notify_files);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!currentProject || !user) return;
    if (!channelName.trim() || !webhookUrl.trim()) {
      toast.error("Channel name and webhook URL are required");
      return;
    }
    if (!webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      toast.error("Please enter a valid Discord webhook URL");
      return;
    }

    setSaving(true);
    try {
      if (editWebhook) {
        const { error } = await supabase
          .from("discord_webhooks")
          .update({
            channel_name: channelName.trim(),
            webhook_url: webhookUrl.trim(),
            notify_tasks: notifyTasks,
            notify_meetings: notifyMeetings,
            notify_files: notifyFiles,
          })
          .eq("id", editWebhook.id);
        if (error) throw error;
        toast.success("Webhook updated");
      } else {
        const { error } = await supabase.from("discord_webhooks").insert({
          project_id: currentProject.id,
          channel_name: channelName.trim(),
          webhook_url: webhookUrl.trim(),
          notify_tasks: notifyTasks,
          notify_meetings: notifyMeetings,
          notify_files: notifyFiles,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success("Webhook added");
      }
      setShowDialog(false);
      resetForm();
      fetchWebhooks();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (wh: DiscordWebhook) => {
    const { error } = await supabase
      .from("discord_webhooks")
      .update({ enabled: !wh.enabled })
      .eq("id", wh.id);
    if (error) toast.error(error.message);
    else fetchWebhooks();
  };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase.from("discord_webhooks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Webhook deleted");
      fetchWebhooks();
    }
  };

  const testWebhook = async (wh: DiscordWebhook) => {
    try {
      const res = await fetch(wh.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "🔔 Test Notification",
              description: "This is a test notification from your project management app.",
              color: 0x3b82f6,
              footer: { text: `Channel: ${wh.channel_name}` },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (res.ok) toast.success("Test message sent to Discord!");
      else toast.error("Failed to send test message");
    } catch {
      toast.error("Failed to reach Discord webhook");
    }
  };

  const maskUrl = (url: string) => {
    const parts = url.split("/");
    if (parts.length > 2) {
      const token = parts[parts.length - 1];
      return `.../${token.slice(0, 8)}****`;
    }
    return "****";
  };

  if (loading) return <div className="text-muted-foreground text-sm py-4">Loading Discord settings...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Discord Webhooks</h2>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Webhook className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No Discord webhooks configured</p>
            <p className="text-xs mt-1">Add a webhook to receive notifications in Discord</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {webhooks.map((wh) => (
            <Card key={wh.id} className={!wh.enabled ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{wh.channel_name}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{maskUrl(wh.webhook_url)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {wh.notify_tasks && <Badge variant="secondary" className="text-xs">Tasks</Badge>}
                      {wh.notify_meetings && <Badge variant="secondary" className="text-xs">Meetings</Badge>}
                      {wh.notify_files && <Badge variant="secondary" className="text-xs">Files</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch checked={wh.enabled} onCheckedChange={() => toggleEnabled(wh)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testWebhook(wh)} title="Test">
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(wh)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteWebhook(wh.id)} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editWebhook ? "Edit Webhook" : "Add Discord Webhook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Channel Name</Label>
              <Input placeholder="e.g. #general, #dev-updates" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Go to Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL
              </p>
            </div>
            <div className="space-y-3">
              <Label>Notification Types</Label>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-tasks" className="font-normal text-sm">Task notifications</Label>
                <Switch id="notify-tasks" checked={notifyTasks} onCheckedChange={setNotifyTasks} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-meetings" className="font-normal text-sm">Meeting notifications</Label>
                <Switch id="notify-meetings" checked={notifyMeetings} onCheckedChange={setNotifyMeetings} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-files" className="font-normal text-sm">File notifications</Label>
                <Switch id="notify-files" checked={notifyFiles} onCheckedChange={setNotifyFiles} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editWebhook ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscordWebhookSettings;
