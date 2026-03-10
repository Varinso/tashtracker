import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Calendar, User, MoreHorizontal, X, List, Columns3, Clock, Flag, Layers } from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSearchParams } from "react-router-dom";

type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-accent text-accent-foreground",
  done: "bg-green-500/15 text-green-700 dark:text-green-400",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

const STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];

function sortTasks(tasks: any[]) {
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    const pa = PRIORITY_WEIGHT[a.priority] ?? 2;
    const pb = PRIORITY_WEIGHT[b.priority] ?? 2;
    if (pb !== pa) return pb - pa;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const Tasks = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Create/edit form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [phase, setPhase] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!currentProject) {
      setTasks([]);
      return;
    }

    const { data } = await supabase
      .from("tasks")
      .select("*, task_assignments(user_id, profiles!task_assignments_user_id_profiles_fkey(display_name))")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });

    setTasks(data || []);
  }, [currentProject]);

  const fetchMembers = useCallback(async () => {
    if (!currentProject) {
      setMembers([]);
      return;
    }

    const { data } = await supabase
      .from("project_members")
      .select("*, profiles!project_members_user_id_profiles_fkey(display_name)")
      .eq("project_id", currentProject.id);

    setMembers(data || []);
  }, [currentProject]);

  useEffect(() => {
    fetchTasks();
    fetchMembers();
  }, [fetchTasks, fetchMembers]);

  useEffect(() => {
    if (!currentProject) return;

    const channel = supabase
      .channel(`tasks-live-${currentProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${currentProject.id}`,
        },
        () => fetchTasks()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_members",
          filter: `project_id=eq.${currentProject.id}`,
        },
        () => fetchMembers()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_assignments",
        },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject, fetchMembers, fetchTasks]);

  // Handle deep link from calendar: ?taskId=xxx
  useEffect(() => {
    const taskId = searchParams.get("taskId");
    if (taskId && tasks.length > 0) {
      setExpandedTaskId(taskId);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, tasks]);

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const isLeader = currentUserRole === "leader" || currentUserRole === "admin";

  // Only leaders can create tasks
  const canCreateTask = isLeader;

  const openEdit = (task: any) => {
    if (!isLeader) return; // Only leaders can edit
    setEditTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority || "medium");
    setPhase(task.phase || "");
    setDeadline(task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd") : "");
    setAssignedUserIds(task.task_assignments?.map((a: any) => a.user_id) || []);
    setShowCreate(true);
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setStatus("todo"); setPriority("medium"); setPhase(""); setDeadline(""); setEditTask(null); setAssignedUserIds([]);
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
        priority,
        phase: phase.trim() || null,
        deadline: deadline || null,
        project_id: currentProject.id,
        created_by: user.id,
      };

      let taskId: string;

      if (editTask) {
        const { error } = await supabase.from("tasks").update(taskData).eq("id", editTask.id);
        if (error) throw error;
        taskId = editTask.id;
      } else {
        const { data, error } = await supabase.from("tasks").insert(taskData).select("id").single();
        if (error) throw error;
        taskId = data.id;
      }

      // Sync assignments
      if (isLeader || !editTask) {
        const { error: clearAssignmentsError } = await supabase
          .from("task_assignments")
          .delete()
          .eq("task_id", taskId);
        if (clearAssignmentsError) throw clearAssignmentsError;

        if (assignedUserIds.length > 0) {
          const { error: assignError } = await supabase.from("task_assignments").insert(
            assignedUserIds.map((uid) => ({ task_id: taskId, user_id: uid }))
          );
          if (assignError) throw assignError;
        }
      }

      // Log activity
      await supabase.from("activity_log").insert({
        project_id: currentProject.id,
        user_id: user.id,
        entity_type: "task",
        entity_id: taskId,
        action: editTask ? `updated task "${title.trim()}"` : `created task "${title.trim()}"`,
      });

      // Send notifications to assigned members
      if (assignedUserIds.length > 0) {
        const notifs = assignedUserIds
          .filter((uid) => uid !== user.id)
          .map((uid) => ({
            user_id: uid,
            project_id: currentProject.id,
            title: editTask ? "Task Updated" : "New Task Assigned",
            message: `You have been assigned to "${title.trim()}"`,
            type: "task",
            entity_type: "task",
            entity_id: taskId,
          }));
        if (notifs.length > 0) {
          await supabase.from("notifications").insert(notifs);
        }
      }

      toast.success(editTask ? "Task updated!" : "Task created!");
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

  const toggleAssignment = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Filter tasks: members only see assigned tasks, leaders see all
  const visibleTasks = isLeader
    ? tasks
    : tasks.filter((t) => t.task_assignments?.some((a: any) => a.user_id === user?.id));

  const filtered = sortTasks(
    visibleTasks
      .filter((t) => filter === "all" || t.status === filter)
      .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
  );

  // Drag and drop handlers
  const handleDragStart = (taskId: string) => setDragTaskId(taskId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetStatus: TaskStatus) => {
    if (dragTaskId) {
      updateStatus(dragTaskId, targetStatus);
      setDragTaskId(null);
    }
  };

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view tasks</div>;
  }

  const TaskCard = ({ task, compact = false }: { task: any; compact?: boolean }) => {
    const isExpanded = expandedTaskId === task.id;
    const assignees = task.task_assignments?.map((a: any) => (a.profiles as any)?.display_name).filter(Boolean) || [];

    return (
      <Card
        className={`hover:shadow-md transition-all cursor-pointer ${dragTaskId === task.id ? "opacity-50" : ""} ${isExpanded ? "ring-2 ring-primary/30" : ""}`}
        draggable
        onDragStart={() => handleDragStart(task.id)}
        onClick={() => {
          if (compact) {
            // In kanban: expand inline for all users, only leaders can edit via button
            setExpandedTaskId(isExpanded ? null : task.id);
          } else {
            setExpandedTaskId(isExpanded ? null : task.id);
          }
        }}
      >
        <CardContent className={compact ? "p-3" : "p-4"}>
          <div className={compact ? "" : "flex items-center gap-4"}>
            <div className={compact ? "" : "flex-1 min-w-0"}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className={`font-semibold truncate ${compact ? "text-sm" : ""}`}>{task.title}</h3>
                {!compact && (
                  <Badge variant="secondary" className={STATUS_COLORS[task.status as TaskStatus]}>
                    {STATUS_LABELS[task.status as TaskStatus]}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[task.priority as TaskPriority] || PRIORITY_COLORS.medium}`}>
                  {PRIORITY_LABELS[task.priority as TaskPriority] || "Medium"}
                </Badge>
                {task.phase && <Badge variant="outline" className="text-xs">{task.phase}</Badge>}
              </div>
              {/* Compact non-expanded: show deadline & assignees */}
              {compact && !isExpanded && (
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {task.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.deadline), "MMM d")}
                    </span>
                  )}
                  {assignees.length > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {assignees.join(", ")}
                    </span>
                  )}
                </div>
              )}
              {/* Compact expanded details (kanban) */}
              {compact && isExpanded && (
                <div className="mt-2 space-y-2 border-t pt-2">
                  {task.description && (
                    <p className="text-xs whitespace-pre-wrap">{task.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {task.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.deadline), "MMM d")}
                      </span>
                    )}
                    {assignees.length > 0 && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {assignees.join(", ")}
                      </span>
                    )}
                  </div>
                  {isLeader && (
                    <Button variant="outline" size="sm" className="w-full mt-1" onClick={(e) => { e.stopPropagation(); openEdit(task); }}>
                      Edit Task
                    </Button>
                  )}
                </div>
              )}
              {!compact && task.description && !isExpanded && (
                <p className="text-xs text-muted-foreground truncate">{task.description}</p>
              )}
              {!compact && !isExpanded && (
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {task.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.deadline), "MMM d")}
                    </span>
                  )}
                  {assignees.length > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {assignees.join(", ")}
                    </span>
                  )}
                </div>
              )}

              {/* Expanded details for list view */}
              {isExpanded && !compact && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  {task.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Flag className="h-3 w-3" /> Priority
                      </p>
                      <Badge variant="outline" className={PRIORITY_COLORS[task.priority as TaskPriority] || PRIORITY_COLORS.medium}>
                        {PRIORITY_LABELS[task.priority as TaskPriority] || "Medium"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Deadline
                      </p>
                      <span className="text-sm">
                        {task.deadline ? format(new Date(task.deadline), "MMM d, yyyy") : "No deadline"}
                      </span>
                    </div>
                    {task.phase && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Layers className="h-3 w-3" /> Phase
                        </p>
                        <span className="text-sm">{task.phase}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <User className="h-3 w-3" /> Assignees
                      </p>
                      <span className="text-sm">
                        {assignees.length > 0 ? assignees.join(", ") : "Unassigned"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(task.created_at), "MMM d, yyyy")}
                    </p>
                    {isLeader && (
                      <Button variant="outline" size="sm" className="ml-auto" onClick={(e) => { e.stopPropagation(); openEdit(task); }}>
                        Edit Task
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
            {!compact && !isExpanded && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); updateStatus(task.id, s); }}>
                      Move to {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                  {isLeader && (
                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}>
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
            <ToggleGroupItem value="list" aria-label="List view"><List className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Kanban view"><Columns3 className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
          {canCreateTask && (
            <Button onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {view === "list" && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Views */}
      {view === "list" ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks found</CardContent></Card>
          ) : (
            filtered.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUSES.map((colStatus) => {
            const colTasks = sortTasks(
              tasks.filter((t) => t.status === colStatus && t.title.toLowerCase().includes(search.toLowerCase()))
            );
            return (
              <div
                key={colStatus}
                className="rounded-lg border bg-muted/30 p-3 min-h-[200px]"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(colStatus)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">{STATUS_LABELS[colStatus]}</h2>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <TaskCard key={task.id} task={task} compact />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">⚪ Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Phase (e.g. Research)" value={phase} onChange={(e) => setPhase(e.target.value)} />
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

            {/* Assign Members */}
            {members.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to</label>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const selected = assignedUserIds.includes(m.user_id);
                    return (
                      <Badge
                        key={m.user_id}
                        variant={selected ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${selected ? "" : "hover:bg-accent"}`}
                        onClick={() => toggleAssignment(m.user_id)}
                      >
                        {(m.profiles as any)?.display_name || "Unknown"}
                        {selected && <X className="h-3 w-3 ml-1" />}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

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
