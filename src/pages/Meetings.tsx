import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { Plus, Calendar, Trash2, Edit, Video, Clock, ExternalLink, Copy, Link } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

const getMeetingStatus = (meetingDate: string): "upcoming" | "live" | "ended" => {
  const diffMs = new Date(meetingDate).getTime() - Date.now();
  if (diffMs > 0) return "upcoming";
  if (diffMs > -3600000) return "live";
  return "ended";
};

const MeetingTimer = ({ meetingDate }: { meetingDate: string }) => {
  const [display, setDisplay] = useState("");
  const [status, setStatus] = useState<"upcoming" | "live" | "ended">("upcoming");

  useEffect(() => {
    const update = () => {
      const diffMs = new Date(meetingDate).getTime() - Date.now();
      if (diffMs > 0) {
        setStatus("upcoming");
        const d = Math.floor(diffMs / 86400000);
        const h = Math.floor((diffMs % 86400000) / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        const s = Math.floor((diffMs % 60000) / 1000);
        const parts: string[] = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);
        setDisplay(parts.join(" "));
      } else if (diffMs > -3600000) {
        setStatus("live");
        setDisplay("Meeting in progress");
      } else {
        setStatus("ended");
        setDisplay("Meeting ended");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [meetingDate]);

  return (
    <div className="flex items-center gap-1.5">
      <Clock className="h-3.5 w-3.5" />
      {status === "upcoming" && (
        <span className="text-sm font-mono text-orange-600 dark:text-orange-400">
          Starts in {display}
        </span>
      )}
      {status === "live" && (
        <Badge variant="default" className="bg-green-600 animate-pulse">
          {display}
        </Badge>
      )}
      {status === "ended" && (
        <span className="text-sm text-muted-foreground">{display}</span>
      )}
    </div>
  );
};

const Meetings = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editMeeting, setEditMeeting] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMeetings = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("meetings")
      .select("*, profiles!meetings_created_by_profiles_fkey(display_name)")
      .eq("project_id", currentProject.id)
      .order("meeting_date", { ascending: true });
    setMeetings(data || []);
  };

  useEffect(() => { fetchMeetings(); }, [currentProject]);

  useEffect(() => {
    const meetingId = searchParams.get("meetingId");
    if (meetingId && meetings.length > 0) {
      const m = meetings.find((mt) => mt.id === meetingId);
      if (m && m.created_by === user?.id) {
        setEditMeeting(m);
        setTitle(m.title);
        setMeetingDate(format(new Date(m.meeting_date), "yyyy-MM-dd'T'HH:mm"));
        setMeetLink(m.meet_link || "");
        setNotes(m.notes || "");
        setShowCreate(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [meetings, searchParams]);

  const resetForm = () => { setTitle(""); setMeetingDate(""); setMeetLink(""); setNotes(""); setEditMeeting(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !user) return;
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        meeting_date: meetingDate,
        meet_link: meetLink.trim() || null,
        notes: notes.trim() || null,
        project_id: currentProject.id,
        created_by: user.id,
      } as any;
      if (editMeeting) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", editMeeting.id);
        if (error) throw error;
        toast.success("Meeting updated!");
      } else {
        const { error } = await supabase.from("meetings").insert(payload);
        if (error) throw error;
        toast.success("Meeting created!");
      }
      fetchMeetings();
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteMeeting = async (id: string) => {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Meeting deleted"); fetchMeetings(); }
  };

  const openEdit = (m: any) => {
    setEditMeeting(m);
    setTitle(m.title);
    setMeetingDate(format(new Date(m.meeting_date), "yyyy-MM-dd'T'HH:mm"));
    setMeetLink(m.meet_link || "");
    setNotes(m.notes || "");
    setShowCreate(true);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied!");
  };

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view meetings</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Meeting
        </Button>
      </div>

      <div className="space-y-4">
        {meetings.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No meetings scheduled</CardContent></Card>
        ) : (
          meetings.map((m) => {
            const link = m.meet_link || "";
            const status = getMeetingStatus(m.meeting_date);
            const isCreator = m.created_by === user?.id;

            return (
              <Card key={m.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <Video className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Title + status badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{m.title}</h3>
                          <Badge
                            variant={status === "live" ? "default" : status === "upcoming" ? "secondary" : "outline"}
                            className={status === "live" ? "bg-green-600" : ""}
                          >
                            {status === "live" ? "Live" : status === "upcoming" ? "Upcoming" : "Ended"}
                          </Badge>
                        </div>

                        {/* Date + creator */}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(m.meeting_date), "MMM d, yyyy 'at' h:mm a")}
                          <span>· Created by {(m.profiles as any)?.display_name || "Unknown"}</span>
                        </div>

                        {/* Notes */}
                        {m.notes && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{m.notes}</p>
                        )}

                        {/* Timer + meeting link + join */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t flex-wrap gap-2">
                          <MeetingTimer meetingDate={m.meeting_date} />
                          {link ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground hidden sm:inline-flex"
                                onClick={() => copyLink(link)}
                                title="Copy meeting link"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy Link
                              </Button>
                              <Button
                                size="sm"
                                variant={status === "live" ? "default" : "outline"}
                                className={status === "live" ? "bg-green-600 hover:bg-green-700" : ""}
                                onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Join Meeting
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Link className="h-3 w-3" /> No meeting link provided
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Creator-only actions */}
                    {isCreator && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Edit meeting">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteMeeting(m.id)}
                          title="Delete meeting"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMeeting ? "Edit Meeting" : "New Meeting"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date & Time</label>
              <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Meeting Link</label>
              <Input
                placeholder="Paste Google Meet or video call link"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                type="url"
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Video className="h-3 w-3" />
                Paste a Google Meet, Zoom, or any video call link
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Notes</label>
              <Textarea placeholder="Meeting agenda or notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editMeeting ? "Update Meeting" : "Create Meeting"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Meetings;
