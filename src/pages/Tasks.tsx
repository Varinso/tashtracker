import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { Plus, Search, Calendar, User, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type TaskStatus = "todo" | "in_progress" | "review" | "done";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-warning/10 text-warning-foreground",
  done: "bg-success/10 text-foreground",
};

const Tasks = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);

  // Create/edit form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [phase, setPhase] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("tasks")
      .select("*, task_assignments(user_id, profiles!task_assignments_user_id_profiles_fkey(display_name))")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });
    setTasks(data || []);
  };

  const fetchMembers = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("project_members")
      .select("*, profiles!project_members_user_id_profiles_fkey(display_name)")
      .eq("project_id", currentProject.id);
    setMembers(data || []);
  };

  useEffect(() => { fetchTasks(); fetchMembers(); }, [currentProject]);

  const openEdit = (task: any) => {
    setEditTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPhase(task.phase || "");
    setDeadline(task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd") : "");
    setShowCreate(true);
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setStatus("todo"); setPhase(""); setDeadline(""); setEditTask(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !user) return;
    setLoading(true);
    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        phase: phase.trim() || null,
        deadline: deadline || null,
        project_id: currentProject.id,
        created_by: user.id,
      };

      if (editTask) {
        const { error } = await supabase.from("tasks").update(taskData).eq("id", editTask.id);
        if (error) throw error;
        toast.success("Task updated!");
      } else {
        const { error } = await supabase.from("tasks").insert(taskData);
        if (error) throw error;
        toast.success("Task created!");
      }
      fetchTasks();
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Task deleted"); fetchTasks(); }
  };

  const updateStatus = async (id: string, newStatus: TaskStatus) => {
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchTasks();
  };

  const filtered = tasks
    .filter((t) => filter === "all" || t.status === filter)
    .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view tasks</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks found</CardContent></Card>
        ) : (
          filtered.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(task)}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{task.title}</h3>
                    <Badge variant="secondary" className={STATUS_COLORS[task.status as TaskStatus]}>
                      {STATUS_LABELS[task.status as TaskStatus]}
                    </Badge>
                    {task.phase && <Badge variant="outline" className="text-xs">{task.phase}</Badge>}
                  </div>
                  {task.description && <p className="text-sm text-muted-foreground truncate">{task.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {task.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.deadline), "MMM d, yyyy")}
                      </span>
                    )}
                    {task.task_assignments?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.task_assignments.map((a: any) => (a.profiles as any)?.display_name).filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                      <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); updateStatus(task.id, s); }}>
                        Move to {STATUS_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTask ? "Edit Task" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Phase (e.g. Research)" value={phase} onChange={(e) => setPhase(e.target.value)} />
            </div>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : editTask ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
