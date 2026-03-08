import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { Plus, Calendar, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

const Meetings = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editMeeting, setEditMeeting] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchMeetings = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("meetings")
      .select("*, profiles!meetings_created_by_profiles_fkey(display_name)")
      .eq("project_id", currentProject.id)
      .order("meeting_date", { ascending: false });
    setMeetings(data || []);
  };

  useEffect(() => { fetchMeetings(); }, [currentProject]);

  const resetForm = () => { setTitle(""); setMeetingDate(""); setNotes(""); setEditMeeting(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !user) return;
    setLoading(true);
    try {
      const data = {
        title: title.trim(),
        meeting_date: meetingDate,
        notes: notes.trim() || null,
        project_id: currentProject.id,
        created_by: user.id,
      };
      if (editMeeting) {
        const { error } = await supabase.from("meetings").update(data).eq("id", editMeeting.id);
        if (error) throw error;
        toast.success("Meeting updated!");
      } else {
        const { error } = await supabase.from("meetings").insert(data);
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

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view meetings</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meeting Notes</h1>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Meeting
        </Button>
      </div>

      <div className="space-y-4">
        {meetings.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No meetings yet</CardContent></Card>
        ) : (
          meetings.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
              setEditMeeting(m);
              setTitle(m.title);
              setMeetingDate(format(new Date(m.meeting_date), "yyyy-MM-dd'T'HH:mm"));
              setNotes(m.notes || "");
              setShowCreate(true);
            }}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{m.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(m.meeting_date), "MMM d, yyyy 'at' h:mm a")}
                        <span>· {(m.profiles as any)?.display_name}</span>
                      </div>
                      {m.notes && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{m.notes}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editMeeting ? "Edit Meeting" : "New Meeting"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input placeholder="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
            <Textarea placeholder="Meeting notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : editMeeting ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Meetings;
