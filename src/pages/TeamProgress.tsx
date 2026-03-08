import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { CheckCircle2, Clock, FileText, AlertTriangle, Shield } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-warning/10 text-warning-foreground",
  done: "bg-success/10 text-foreground",
};

const TeamProgress = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!currentProject || !user) {
      setMembers([]);
      setTasks([]);
      setFiles([]);
      setIsLeader(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [membersRes, tasksRes, filesRes] = await Promise.all([
      supabase
        .from("project_members")
        .select("*, profiles!project_members_user_id_profiles_fkey(display_name, avatar_url)")
        .eq("project_id", currentProject.id),
      supabase
        .from("tasks")
        .select("*, task_assignments(user_id)")
        .eq("project_id", currentProject.id),
      supabase
        .from("files")
        .select("id, uploaded_by, file_name, created_at")
        .eq("project_id", currentProject.id),
    ]);

    const membersList = membersRes.data || [];
    setMembers(membersList);
    setTasks(tasksRes.data || []);
    setFiles(filesRes.data || []);

    const currentMember = membersList.find((m: any) => m.user_id === user.id);
    setIsLeader(currentMember?.role === "leader" || currentMember?.role === "admin");
    setLoading(false);
  }, [currentProject, user]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    if (!currentProject) return;

    const channel = supabase
      .channel(`team-progress-live-${currentProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_members",
          filter: `project_id=eq.${currentProject.id}`,
        },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${currentProject.id}`,
        },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "files",
          filter: `project_id=eq.${currentProject.id}`,
        },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_assignments",
        },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject, fetchAll]);

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project first</div>;
  }

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading...</div>;
  }

  if (!isLeader) {
    return (
      <div className="text-center py-20 space-y-3">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto" />
        <p className="text-muted-foreground">Only project leaders can view team progress.</p>
      </div>
    );
  }

  const getMemberTasks = (userId: string) =>
    tasks.filter((t) => t.task_assignments?.some((a: any) => a.user_id === userId));

  const getMemberFiles = (userId: string) =>
    files.filter((f) => f.uploaded_by === userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Progress</h1>
        <p className="text-muted-foreground mt-1">Overview of each team member's tasks and contributions</p>
      </div>

      <div className="space-y-6">
        {members.map((m) => {
          const memberTasks = getMemberTasks(m.user_id);
          const memberFiles = getMemberFiles(m.user_id);
          const doneTasks = memberTasks.filter((t) => t.status === "done").length;
          const totalTasks = memberTasks.length;
          const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
          const overdue = memberTasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length;
          const displayName = (m.profiles as any)?.display_name || "Unknown";

          return (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {displayName[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <CardTitle className="text-base">{displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{doneTasks}/{totalTasks} tasks</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{memberFiles.length} files</span>
                    </div>
                    {overdue > 0 && (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{overdue} overdue</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Task completion</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {memberTasks.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks</p>
                    <div className="grid gap-2">
                      {memberTasks.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-muted/50">
                          <span className="truncate mr-2">{t.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {t.deadline && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(t.deadline), "MMM d")}
                              </span>
                            )}
                            <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[t.status] || ""}`}>
                              {STATUS_LABELS[t.status] || t.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {memberTasks.length > 5 && (
                        <p className="text-xs text-muted-foreground pl-3">+{memberTasks.length - 5} more tasks</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tasks assigned</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TeamProgress;
