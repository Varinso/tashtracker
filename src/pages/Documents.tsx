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
import { Upload, Search, FileText, File, Image, Sheet, Trash2, Download, User, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const FILE_ICONS: Record<string, React.ComponentType<any>> = {
  pdf: FileText, doc: File, docx: File, xls: Sheet, xlsx: Sheet,
  png: Image, jpg: Image, jpeg: Image,
};

const Documents = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const fetchMembers = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("project_members")
      .select("*, profiles!project_members_user_id_profiles_fkey(display_name)")
      .eq("project_id", currentProject.id);
    setMembers(data || []);
  };

  useEffect(() => { fetchFiles(); fetchMembers(); }, [currentProject]);

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
      });
      if (error) throw error;
      toast.success("File uploaded!");
      fetchFiles();
      setShowUpload(false);
      setSelectedFile(null);
      setDescription("");
      setTags("");
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

  const toggleSection = (userId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const filtered = files.filter(
    (f) =>
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      f.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
  );

  // Group files by uploader
  const groupedByMember = members.map((m) => ({
    userId: m.user_id,
    displayName: (m.profiles as any)?.display_name || "Unknown",
    files: filtered.filter((f) => f.uploaded_by === m.user_id),
  })).filter((g) => g.files.length > 0 || g.userId === user?.id);

  // Add files from non-members (edge case)
  const memberIds = new Set(members.map((m) => m.user_id));
  const orphanFiles = filtered.filter((f) => !memberIds.has(f.uploaded_by));

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to view documents</div>;
  }

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
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(file.created_at), "MMM d, yyyy")}
              </p>
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
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-1" /> Upload File
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search files or tags..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {groupedByMember.length === 0 && orphanFiles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No documents found</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {groupedByMember.map((group) => {
            const isCollapsed = collapsedSections.has(group.userId);
            const isCurrentUser = group.userId === user?.id;
            return (
              <div key={group.userId}>
                <button
                  className="flex items-center gap-2 mb-3 text-left w-full group"
                  onClick={() => toggleSection(group.userId)}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">
                    {group.displayName} {isCurrentUser && <span className="text-sm font-normal text-muted-foreground">(You)</span>}
                  </h2>
                  <Badge variant="secondary" className="text-xs">{group.files.length} file{group.files.length !== 1 ? "s" : ""}</Badge>
                </button>
                {!isCollapsed && (
                  group.files.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
                      {group.files.map(renderFileCard)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground pl-6">No documents uploaded yet</p>
                  )
                )}
              </div>
            );
          })}
          {orphanFiles.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Other</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orphanFiles.map(renderFileCard)}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <Input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} required />
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
