import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, CheckCircle2, Clock, AlertTriangle, Users, FolderOpen, Trash2, CalendarClock, ExternalLink, UserPlus } from "lucide-react";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const STATUS_COLORS = ["#d6d8e6", "#6366f1", "#f59e0b", "#22c55e"];

const KPI_STYLES = [
  "bg-gradient-to-br from-indigo-500 to-blue-600 text-white",
  "bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white",
  "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
  "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
];

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentProject, projects, refetchProjects } = useProject();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isCreator = currentProject?.created_by === user?.id;
  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const isLeader = currentUserRole === "leader" || currentUserRole === "admin";

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("projects").delete().eq("id", currentProject.id);
      if (error) throw error;
      toast.success("Project deleted");
      refetchProjects();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!currentProject) return;
    const fetchData = async () => {
      const [tasksRes, membersRes, activityRes, meetingsRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("project_id", currentProject.id),
        supabase.from("project_members").select("*, profiles!project_members_user_id_profiles_fkey(display_name, avatar_url, email)").eq("project_id", currentProject.id),
        supabase.from("activity_log").select("*, profiles!activity_log_user_id_profiles_fkey(display_name)").eq("project_id", currentProject.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("meetings").select("*").eq("project_id", currentProject.id).order("meeting_date", { ascending: true }),
      ]);
      setTasks(tasksRes.data || []);
      setMembers(membersRes.data || []);
      setActivity(activityRes.data || []);
      setMeetings(meetingsRes.data || []);
    };
    fetchData();
  }, [currentProject]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  const weeklyActivityMap = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    return {
      dayIndex: date.getDay(),
      key: date.toISOString().slice(0, 10),
      activity: 0,
    };
  });

  activity.forEach((item) => {
    const key = new Date(item.created_at).toISOString().slice(0, 10);
    const target = weeklyActivityMap.find((d) => d.key === key);
    if (target) target.activity += 1;
  });

  const maxActivity = Math.max(...weeklyActivityMap.map((d) => d.activity), 1);
  const weeklyEngagementData = weeklyActivityMap.map((d) => ({
    day: WEEKDAY_LABELS[d.dayIndex],
    value: Math.round((d.activity / maxActivity) * 100),
  }));

  const chartTooltipFormatter = (value: number) => [`${value}%`, "Activity"];

  const nextMeeting = meetings.find((m) => new Date(m.meeting_date).getTime() >= now) || null;

  const meetingCountdown = (() => {
    if (!nextMeeting) return "No upcoming meeting";
    const diff = new Date(nextMeeting.meeting_date).getTime() - now;
    if (diff <= 0) return "Live now";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  })();

  const memberSnapshot = members.slice(0, 5).map((member, index) => ({
    ...member,
    status: ["completed", "in progress", "pending"][index % 3],
  }));

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
          <p className="text-muted-foreground mt-1">Track outcomes, activity, deadlines, and team momentum in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          {isLeader && isCreator && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete Project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{currentProject?.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the project, all its tasks, documents, meetings, and team data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteProject}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete Project"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Tasks", value: totalTasks, icon: CheckCircle2, sub: `${doneTasks} completed this cycle` },
          { label: "In Progress", value: inProgressTasks, icon: Clock, sub: `${tasks.filter((t) => t.status === "review").length} awaiting review` },
          { label: "Overdue", value: overdueTasks, icon: AlertTriangle, sub: `${Math.max(totalTasks - doneTasks, 0)} open items` },
          { label: "In Review", value: tasks.filter((t) => t.status === "review").length, icon: Users, sub: `${tasks.filter((t) => t.status === "review").length} tasks under review` },
        ].map((kpi, idx) => (
          <Card key={kpi.label} className={`${KPI_STYLES[idx]} border-0 shadow-md`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm/5 opacity-90">{kpi.label}</p>
                  <p className="text-3xl font-bold tracking-tight mt-0.5">{kpi.value}</p>
                  <p className="text-xs opacity-90 mt-1">{kpi.sub}</p>
                </div>
                <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={weeklyEngagementData} barCategoryGap="30%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis hide domain={[0, 100]} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} formatter={chartTooltipFormatter} labelStyle={{ color: "#111827" }} />
                <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="url(#dashboardBarGradient)" />
                <defs>
                  <linearGradient id="dashboardBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Average weekly engagement: {Math.round(weeklyEngagementData.reduce((sum, d) => sum + d.value, 0) / 7)}%</span>
              <span>Peak: {Math.max(...weeklyEngagementData.map((d) => d.value))}%</span>
            </div>
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total progress</span>
                <span className="font-semibold">{completionPct}%</span>
              </div>
              <Progress value={completionPct} className="h-2.5" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Meeting</CardTitle>
            </CardHeader>
            <CardContent>
              {nextMeeting ? (
                <div className="space-y-3 rounded-xl border p-3 bg-muted/30">
                  <div className="font-medium text-sm truncate">{nextMeeting.title}</div>
                  <div className="text-xs text-muted-foreground">Time: {format(new Date(nextMeeting.meeting_date), "h:mm a")}</div>
                  <div className="rounded-lg bg-slate-950 text-slate-100 p-3 space-y-2">
                    <div className="text-2xl font-semibold tracking-widest text-cyan-200">{meetingCountdown}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <CalendarClock className="h-3.5 w-3.5 text-cyan-300" />
                      Until {format(new Date(nextMeeting.meeting_date), "MMM d, h:mm a")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!nextMeeting.meet_link}
                    onClick={() => nextMeeting.meet_link && window.open(nextMeeting.meet_link, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Join Meeting
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming meetings scheduled.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Status Breakdowns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                      innerRadius={52}
                      isAnimationActive
                      animationBegin={100}
                      animationDuration={900}
                    >
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={STATUS_COLORS[i]} isAnimationActive />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center -mt-3 mb-2">
                <span className="text-3xl font-bold">{completionPct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {statusData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[i] }} />
                    {s.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Team Collaboration</CardTitle>
            <Button size="sm" variant="outline" onClick={() => navigate("/team")}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Member
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberSnapshot.length > 0 ? (
              memberSnapshot.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border p-3 bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
                      {(member.profiles as any)?.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{(member.profiles as any)?.display_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.designation || "Contributor"}</p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      member.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : member.status === "in progress"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-pink-100 text-pink-700"
                    }
                  >
                    {member.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Active Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length > 0 ? (
              <div className="space-y-3">
                {upcomingDeadlines.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.phase || "General"}</p>
                    </div>
                    <Badge variant="outline">Due {format(new Date(task.deadline), "MMM d")}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active deadlines right now.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length > 0 ? (
              <div className="space-y-2">
                {activity.slice(0, 5).map((item) => (
                  <div key={item.id} className="text-xs text-muted-foreground border-b pb-2 last:border-0">
                    <span className="font-medium text-foreground">{(item.profiles as any)?.display_name || "Member"}</span> {item.action}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateProjectDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
};

export default Dashboard;
