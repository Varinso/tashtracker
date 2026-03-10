import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, FileText, File, Image, Sheet, Trash2, Download, ChevronDown, ChevronRight, FolderOpen, ListChecks, ClipboardList, User } from "lucide-react";
import { format } from "date-fns";

const FILE_ICONS: Record<string, React.ComponentType<any>> = {
  pdf: FileText, doc: File, docx: File, xls: Sheet, xlsx: Sheet,
  png: Image, jpg: Image, jpeg: Image,
};

const Documents = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const fetchFiles = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("files")
      .select("*, profiles!files_uploaded_by_profiles_fkey(display_name)")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });
    setFiles(data || []);
  };

  const fetchTasks = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });
    setTasks(data || []);
  };

  useEffect(() => { fetchFiles(); fetchTasks(); }, [currentProject]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !currentProject || !user) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/${currentProject.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from("project-files").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(filePath);
      const { error } = await supabase.from("files").insert({
        project_id: currentProject.id,
        uploaded_by: user.id,
        file_name: selectedFile.name,
        file_url: urlData.publicUrl,
        file_size: selectedFile.size,
        file_type: selectedFile.name.split(".").pop() || null,
        description: description.trim() || null,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()) : null,
        task_id: uploadTaskId || null,
      });
      if (error) throw error;

      // Log activity
      await supabase.from("activity_log").insert({
        project_id: currentProject.id,
        user_id: user.id,
        entity_type: "file",
        entity_id: null,
        action: `uploaded file "${selectedFile.name}"${uploadTaskId ? " to a task" : ""}`,
      });

      toast.success("File uploaded!");
      fetchFiles();
      setShowUpload(false);
      setSelectedFile(null);
      setDescription("");
      setTags("");
      setUploadTaskId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (file: any) => {
    const { error } = await supabase.from("files").delete().eq("id", file.id);
    if (error) toast.error(error.message);
    else { toast.success("File deleted"); fetchFiles(); }
  };

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filtered = files.filter(
    (f) =>
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      f.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
  );

  // Group files by task — show ALL tasks, even those with 0 files
  const taskGroups = tasks.map((task) => ({
    task,
    files: filtered.filter((f) => f.task_id === task.id),
  }));

  // General project files (no task_id)
  const generalFiles = filtered.filter((f) => !f.task_id);

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view documents</div>;
  }

  const openUploadForTask = (taskId: string | null) => {
    setUploadTaskId(taskId);
    setShowUpload(true);
  };

  const renderFileCard = (file: any) => {
    const ext = file.file_type?.toLowerCase() || "";
    const Icon = FILE_ICONS[ext] || FileText;
    return (
      <Card key={file.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate">{file.file_name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground">{(file.profiles as any)?.display_name || "Unknown"}</span>
                <span className="text-xs text-muted-foreground">· {format(new Date(file.created_at), "MMM d, yyyy")}</span>
              </div>
              {file.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{file.description}</p>}
              {file.tags && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {file.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-1 mt-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={file.file_url} target="_blank" rel="noopener"><Download className="h-3.5 w-3.5" /></a>
            </Button>
            {(file.uploaded_by === user?.id) && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFile(file)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <Button onClick={() => openUploadForTask(null)}>
          <Upload className="h-4 w-4 mr-1" /> Upload File
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search files or tags..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Task document sections — always show all tasks */}
      {taskGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Task Documents
          </h2>
          {taskGroups.map(({ task, files: taskFiles }) => {
            const isCollapsed = collapsedSections.has(task.id);
            const statusColor = task.status === "done" ? "bg-green-500/15 text-green-700 dark:text-green-400" : task.status === "in_progress" ? "bg-primary/10 text-primary" : task.status === "review" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground";
            const statusLabel = task.status === "done" ? "Done" : task.status === "in_progress" ? "In Progress" : task.status === "review" ? "Review" : "To Do";
            return (
              <Card key={task.id} className="overflow-hidden">
                <div className="flex items-center gap-2 p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleSection(task.id)}>
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <ListChecks className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-semibold truncate">{task.title}</h3>
                  <Badge variant="secondary" className={`text-xs shrink-0 ${statusColor}`}>{statusLabel}</Badge>
                  <Badge variant="outline" className="text-xs shrink-0">{taskFiles.length} file{taskFiles.length !== 1 ? "s" : ""}</Badge>
                  <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={(e) => { e.stopPropagation(); openUploadForTask(task.id); }}>
                    <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                  </Button>
                </div>
                {!isCollapsed && (
                  <div className="border-t px-4 pb-4 pt-3">
                    {taskFiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {taskFiles.map(renderFileCard)}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No documents yet for this task</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => openUploadForTask(task.id)}>
                          <Upload className="h-3.5 w-3.5 mr-1" /> Upload Document
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* General project files */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">General Project Files</h2>
          <Badge variant="secondary" className="text-xs">{generalFiles.length}</Badge>
        </div>
        {generalFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generalFiles.map(renderFileCard)}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No general project files yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => openUploadForTask(null)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload File
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showUpload} onOpenChange={(open) => { setShowUpload(open); if (!open) setUploadTaskId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Upload Document
              {uploadTaskId && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  → {tasks.find((t) => t.id === uploadTaskId)?.title}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <Input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} required />
            {/* Task selector — shown when not already uploading for a specific task */}
            {!uploadTaskId && tasks.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Link to task (optional)</label>
                <Select value={uploadTaskId || "none"} onValueChange={(v) => setUploadTaskId(v === "none" ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No task (general file)</SelectItem>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <Input placeholder="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
