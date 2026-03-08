import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, CheckCircle2, Clock, AlertTriangle, Users, FolderOpen } from "lucide-react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const STATUS_COLORS = ["hsl(var(--muted))", "hsl(var(--primary))", "hsl(38, 92%, 50%)", "hsl(var(--success))"];

const Dashboard = () => {
  const { currentProject, projects, refetchProjects } = useProject();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    const fetchData = async () => {
      const [tasksRes, membersRes, activityRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("project_id", currentProject.id),
        supabase.from("project_members").select("*, profiles!project_members_user_id_profiles_fkey(display_name, avatar_url)").eq("project_id", currentProject.id),
        supabase.from("activity_log").select("*, profiles!activity_log_user_id_profiles_fkey(display_name)").eq("project_id", currentProject.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setTasks(tasksRes.data || []);
      setMembers(membersRes.data || []);
      setActivity(activityRes.data || []);
    };
    fetchData();
  }, [currentProject]);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const overdueTasks = tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const statusData = [
    { name: "To Do", value: tasks.filter((t) => t.status === "todo").length },
    { name: "In Progress", value: inProgressTasks },
    { name: "Review", value: tasks.filter((t) => t.status === "review").length },
    { name: "Done", value: doneTasks },
  ];

  const tasksWithPhase = tasks.filter((t) => t.phase);
  const phaseData = tasksWithPhase.reduce((acc: any[], t) => {
    const phase = t.phase!;
    const existing = acc.find((a) => a.phase === phase);
    if (existing) { existing.total++; if (t.status === "done") existing.done++; }
    else { acc.push({ phase, total: 1, done: t.status === "done" ? 1 : 0 }); }
    return acc;
  }, []);

  const upcomingDeadlines = tasks
    .filter((t) => t.deadline && new Date(t.deadline) >= new Date() && t.status !== "done")
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  if (!currentProject && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
        <div className="text-center space-y-2">
          <FolderOpen className="h-16 w-16 text-muted-foreground/40 mx-auto" />
          <h2 className="text-2xl font-bold">No Projects Yet</h2>
          <p className="text-muted-foreground max-w-md">Create your first project to start organizing your research and collaborating with your team.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" /> Create Project
        </Button>
        <CreateProjectDialog open={showCreate} onOpenChange={setShowCreate} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{currentProject?.name || "Dashboard"}</h1>
          <p className="text-muted-foreground mt-1">{currentProject?.description}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Project
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-3xl font-bold">{totalTasks}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-3xl font-bold">{inProgressTasks}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-destructive">{overdueTasks}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-3xl font-bold">{members.length}</p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{doneTasks} of {totalTasks} tasks completed</span>
                <span className="font-semibold">{completionPct}%</span>
              </div>
              <Progress value={completionPct} className="h-3" />
            </div>
            {phaseData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={phaseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="phase" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="done" fill="hsl(var(--primary))" name="Done" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {totalTasks > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {statusData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[i] }} />
                  <span className="text-xs text-muted-foreground">{s.name}: {s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deadlines + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-3">
                {upcomingDeadlines.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.phase}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(t.deadline), "MMM d")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
                      {(a.profiles as any)?.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">{(a.profiles as any)?.display_name}</span>{" "}
                        {a.action}
                      </p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, h:mm a")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateProjectDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

export default Dashboard;
