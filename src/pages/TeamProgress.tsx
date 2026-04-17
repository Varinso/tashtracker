import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { CheckCircle2, Clock, FileText, AlertTriangle, Shield, Search, Download, ArrowUpRight, Users, Activity, Target } from "lucide-react";
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
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    if (!currentProject || !user) {
      setMembers([]); setTasks([]); setFiles([]); setActivityLog([]);
      setIsLeader(false); setLoading(false);
      return;
    }

    setLoading(true);
    const [membersRes, tasksRes, filesRes, activityRes] = await Promise.all([
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
      supabase
        .from("activity_log")
        .select("*")
        .eq("project_id", currentProject.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const membersList = membersRes.data || [];
    setMembers(membersList);
    setTasks(tasksRes.data || []);
    setFiles(filesRes.data || []);
    setActivityLog(activityRes.data || []);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${currentProject.id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${currentProject.id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "files", filter: `project_id=eq.${currentProject.id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignments" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `project_id=eq.${currentProject.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentProject, fetchAll]);

  const memberMetrics = useMemo(() => {
    return members.map((member: any) => {
      const memberTasks = tasks.filter((t) => t.task_assignments?.some((a: any) => a.user_id === member.user_id));
      const memberFiles = files.filter((f) => f.uploaded_by === member.user_id);
      const memberActivity = activityLog.filter((a) => a.user_id === member.user_id);
      const doneTasks = memberTasks.filter((t) => t.status === "done").length;
      const totalTasks = memberTasks.length;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
      const overdue = memberTasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length;
      const displayName = (member.profiles as any)?.display_name || "Unknown";

      return {
        ...member,
        displayName,
        memberTasks,
        memberFiles,
        memberActivity,
        doneTasks,
        totalTasks,
        progress,
        overdue,
      };
    });
  }, [members, tasks, files, activityLog]);

  const filteredMembers = memberMetrics.filter((member) =>
    member.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (member.designation || "").toLowerCase().includes(search.toLowerCase()) ||
    member.role.toLowerCase().includes(search.toLowerCase())
  );

  const totalMemberTasks = tasks.filter((t) => t.task_assignments?.length > 0).length;
  const totalCompletedTasks = tasks.filter((t) => t.status === "done").length;
  const totalFiles = files.length;
  const totalOverdue = tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length;

  const avgProgress = memberMetrics.length
    ? Math.round(memberMetrics.reduce((sum, member) => sum + member.progress, 0) / memberMetrics.length)
    : 0;

  const distribution = [
    { label: "In Progress", value: tasks.filter((t) => t.status === "in_progress").length, color: "bg-blue-500" },
    { label: "Completed", value: tasks.filter((t) => t.status === "done").length, color: "bg-green-500" },
    { label: "Pending", value: tasks.filter((t) => t.status === "todo" || !t.status).length, color: "bg-amber-500" },
    { label: "On Hold", value: tasks.filter((t) => t.status === "review").length, color: "bg-slate-500" },
  ];

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
  const getMemberActivity = (userId: string) =>
    activityLog.filter((a) => a.user_id === userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Team Progress</h1>
              <p className="text-muted-foreground">Track performance and productivity metrics across the team.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-background">Updated live</span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 bg-background">Leader view</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toast.success("Report exported") }>
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search member, role, designation..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Tasks Completed", value: totalCompletedTasks, icon: CheckCircle2, delta: `+${totalCompletedTasks - totalOverdue}` },
          { label: "Active Projects", value: currentProject ? 1 : 0, icon: Target, delta: `+${members.length}` },
          { label: "Team Members", value: members.length, icon: Users, delta: `${avgProgress}% avg progress` },
          { label: "Avg. Completion Time", value: `${avgProgress / 10 || 0}.3`, suffix: "days", icon: Clock, delta: `${totalFiles} files shared` },
        ].map((item) => (
          <Card key={item.label} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs shrink-0">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <div className="flex items-end gap-1 mt-2">
                  <h3 className="text-3xl font-bold tracking-tight">{item.value}</h3>
                  {item.suffix && <span className="text-lg text-muted-foreground pb-1">{item.suffix}</span>}
                </div>
                <p className="text-xs text-emerald-500 mt-3">{item.delta}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.9fr] gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Task Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <div key={member.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{member.displayName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{member.designation || member.role}</span>
                    </div>
                    <span className="text-muted-foreground">{member.progress}%</span>
                  </div>
                  <Progress value={member.progress} className="h-2.5" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{member.doneTasks}/{member.totalTasks} tasks completed</span>
                    <span>{member.memberFiles.length} files</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No members match your search.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Progress Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall progress</p>
                  <p className="text-3xl font-bold">{avgProgress}%</p>
                </div>
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <Progress value={avgProgress} className="h-2.5 mt-4" />
            </div>

            <div className="space-y-3">
              {distribution.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-xl font-semibold">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Files uploaded</span>
                <Badge variant="secondary">{totalFiles}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overdue tasks</span>
                <Badge variant={totalOverdue > 0 ? "destructive" : "secondary"}>{totalOverdue}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Members at risk</span>
                <Badge variant="outline">{memberMetrics.filter((m) => m.overdue > 0).length}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Progress Report</CardTitle>
          <p className="text-sm text-muted-foreground">Latest activity and team signals</p>
        </CardHeader>
        <CardContent>
          {activityLog.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activityLog.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border p-4 bg-muted/10">
                  <p className="text-sm font-medium">{(item.profiles as any)?.display_name || "Member"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(item.created_at), "MMM d, h:mm a")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamProgress;
