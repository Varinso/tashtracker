import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  subMonths,
  subWeeks,
  subDays,
  isSameMonth,
  isSameDay,
  isToday,
  eachDayOfInterval,
  isBefore,
} from "date-fns";

type ViewMode = "month" | "week" | "day";

const isTaskOverdue = (task: any): boolean => {
  if (!task.deadline || task.status === "done") return false;
  const deadline = new Date(task.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return isBefore(deadline, today);
};

const CalendarView = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  useEffect(() => {
    if (!currentProject) return;
    const fetchData = async () => {
      const [t, m, mem] = await Promise.all([
        supabase.from("tasks").select("*, task_assignments(user_id)").eq("project_id", currentProject.id).not("deadline", "is", null),
        supabase.from("meetings").select("*").eq("project_id", currentProject.id),
        supabase.from("project_members").select("user_id, role").eq("project_id", currentProject.id),
      ]);
      setMembers(mem.data || []);

      const allTasks = t.data || [];
      const currentMember = (mem.data || []).find((mm: any) => mm.user_id === user?.id);
      const isLeader = currentMember?.role === "leader" || currentMember?.role === "admin";

      // Filter tasks: members only see assigned tasks
      const visibleTasks = isLeader
        ? allTasks
        : allTasks.filter((tk: any) => tk.task_assignments?.some((a: any) => a.user_id === user?.id));

      setTasks(visibleTasks);
      setMeetings(m.data || []);
    };
    fetchData();
  }, [currentProject, user]);

  const nav = (dir: number) => {
    if (viewMode === "month") setCurrentDate((d) => dir > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (viewMode === "week") setCurrentDate((d) => dir > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate((d) => dir > 0 ? addDays(d, 1) : subDays(d, 1));
  };

  const getEventsForDay = (day: Date) => {
    const taskEvents = tasks.filter((t) => t.deadline && isSameDay(new Date(t.deadline), day)).map((t) => ({ ...t, type: "task" as const }));
    const meetingEvents = meetings.filter((m) => isSameDay(new Date(m.meeting_date), day)).map((m) => ({ ...m, type: "meeting" as const }));
    return [...taskEvents, ...meetingEvents];
  };

  const handleTaskClick = (taskId: string) => {
    navigate(`/tasks?taskId=${taskId}`);
  };

  const handleMeetingClick = (meetingId: string) => {
    navigate(`/meetings?meetingId=${meetingId}`);
  };

  const headerLabel = viewMode === "month"
    ? format(currentDate, "MMMM yyyy")
    : viewMode === "week"
    ? `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
    : format(currentDate, "EEEE, MMMM d, yyyy");

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view calendar</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-1">
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <Button key={v} variant={viewMode === v ? "default" : "outline"} size="sm" onClick={() => setViewMode(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold">{headerLabel}</h2>
        <Button variant="outline" size="icon" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {viewMode === "month" && <MonthView currentDate={currentDate} getEventsForDay={getEventsForDay} onTaskClick={handleTaskClick} onMeetingClick={handleMeetingClick} />}
      {viewMode === "week" && <WeekView currentDate={currentDate} getEventsForDay={getEventsForDay} onTaskClick={handleTaskClick} onMeetingClick={handleMeetingClick} />}
      {viewMode === "day" && <DayView currentDate={currentDate} getEventsForDay={getEventsForDay} onTaskClick={handleTaskClick} onMeetingClick={handleMeetingClick} />}
    </div>
  );
};

type ViewProps = { currentDate: Date; getEventsForDay: (d: Date) => any[]; onTaskClick: (id: string) => void; onMeetingClick: (id: string) => void };

function EventItem({ e, onTaskClick, onMeetingClick }: { e: any; onTaskClick: (id: string) => void; onMeetingClick: (id: string) => void }) {
  const isTask = e.type === "task";
  const isMeeting = e.type === "meeting";
  const isDone = isTask && e.status === "done";
  const isOverdue = isTask && isTaskOverdue(e);
  return (
    <div
      onClick={(ev) => { ev.stopPropagation(); if (isTask) onTaskClick(e.id); else if (isMeeting) onMeetingClick(e.id); }}
      className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${
        isTask
          ? isOverdue
            ? "bg-red-500/15 text-red-700 dark:text-red-400"
            : isDone
            ? "bg-green-500/15 text-green-700 dark:text-green-400"
            : "bg-primary/10 text-primary"
          : "bg-accent text-accent-foreground"
      }`}
    >
      {e.title}
    </div>
  );
}

function MonthView({ currentDate, getEventsForDay, onTaskClick, onMeetingClick }: ViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-3 text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const events = getEventsForDay(day);
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] p-2 border-b border-r ${!isSameMonth(day, currentDate) ? "opacity-30" : ""} ${isToday(day) ? "bg-accent/30" : ""}`}
              >
                <span className={`text-sm ${isToday(day) ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-1">
                  {events.slice(0, 3).map((e, i) => (
                    <EventItem key={i} e={e} onTaskClick={onTaskClick} onMeetingClick={onMeetingClick} />
                  ))}
                  {events.length > 3 && <span className="text-xs text-muted-foreground">+{events.length - 3} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekView({ currentDate, getEventsForDay, onTaskClick, onMeetingClick }: ViewProps) {
  const weekStart = startOfWeek(currentDate);
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate) });
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  return (
    <Card>
      <CardContent className="p-0 overflow-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] min-w-[800px]">
          <div className="border-b border-r p-2" />
          {days.map((d) => (
            <div key={d.toISOString()} className={`border-b border-r p-2 text-center ${isToday(d) ? "bg-accent/30" : ""}`}>
              <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
              <div className={`text-sm font-semibold ${isToday(d) ? "text-primary" : ""}`}>{format(d, "d")}</div>
            </div>
          ))}
          {hours.map((h) => (
            <div key={h} className="contents">
              <div className="border-r border-b p-1 text-xs text-muted-foreground text-right pr-2">{h}:00</div>
              {days.map((d) => {
                const dayEvents = getEventsForDay(d);
                return (
                  <div key={d.toISOString() + h} className="border-r border-b min-h-[48px] p-0.5 relative">
                    {h === 7 && dayEvents.map((e, i) => (
                      <EventItem key={i} e={e} onTaskClick={onTaskClick} onMeetingClick={onMeetingClick} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DayView({ currentDate, getEventsForDay, onTaskClick, onMeetingClick }: ViewProps) {
  const events = getEventsForDay(currentDate);
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  return (
    <Card>
      <CardContent className="p-0">
        {hours.map((h) => (
          <div key={h} className="flex border-b">
            <div className="w-16 p-2 text-xs text-muted-foreground text-right pr-3 shrink-0">{h}:00</div>
            <div className="flex-1 min-h-[56px] p-1">
              {h === 7 && events.map((e, i) => (
                <div
                  key={i}
                  onClick={() => { if (e.type === "task") onTaskClick(e.id); else if (e.type === "meeting") onMeetingClick(e.id); }}
                  className={`px-3 py-2 rounded-lg mb-1 cursor-pointer hover:opacity-80 transition-opacity ${e.type === "task" ? (isTaskOverdue(e) ? "bg-red-500/15 border border-red-500/30" : e.status === "done" ? "bg-green-500/15 border border-green-500/30" : "bg-primary/10 border border-primary/20") : "bg-accent border border-accent-foreground/10"}`}
                >
                  <span className="text-sm font-medium">{e.title}</span>
                  {e.type === "task" && <Badge variant="outline" className="ml-2 text-xs">{e.status}</Badge>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default CalendarView;
