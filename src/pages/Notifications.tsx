import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { Bell, CheckCheck, Circle, FileText, ListChecks, Users, Calendar } from "lucide-react";
import { format } from "date-fns";

const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  task: ListChecks,
  file: FileText,
  meeting: Calendar,
  member: Users,
  info: Bell,
};

const Notifications = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (currentProject) {
      query.eq("project_id", currentProject.id);
    }

    const { data } = await query;
    setNotifications(data || []);
    setLoading(false);
  }, [user, currentProject]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            return (
              <Card
                key={n.id}
                className={`cursor-pointer transition-all hover:shadow-sm ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${!n.read ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${!n.read ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.read && <Circle className="h-2 w-2 fill-primary text-primary shrink-0" />}
                      <h3 className={`text-sm truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</h3>
                    </div>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(n.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
