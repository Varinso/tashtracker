import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { UserPlus, Shield, Crown, User, Trash2 } from "lucide-react";
import { format } from "date-fns";

const ROLE_ICONS: Record<string, React.ComponentType<any>> = {
  admin: Shield,
  leader: Crown,
  member: User,
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  leader: "bg-primary/10 text-primary",
  member: "bg-muted text-muted-foreground",
};

const Team = () => {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("project_members")
      .select("*, profiles!project_members_user_id_profiles_fkey(display_name, avatar_url)")
      .eq("project_id", currentProject.id)
      .order("joined_at");
    setMembers(data || []);
  };

  useEffect(() => { fetchMembers(); }, [currentProject]);

  const currentUserRole = members.find((m) => m.user_id === user?.id)?.role;
  const isLeader = currentUserRole === "leader" || currentUserRole === "admin";

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("project_members").delete().eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Member removed"); fetchMembers(); }
  };

  const updateRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("project_members")
      .update({ role: newRole as any })
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Role updated"); setEditingMember(null); fetchMembers(); }
  };

  if (!currentProject) {
    return <div className="text-center py-20 text-muted-foreground">Select a project to manage team</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        {isLeader && (
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Invite Member
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => {
          const RoleIcon = ROLE_ICONS[m.role] || User;
          return (
            <Card key={m.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                      {(m.profiles as any)?.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold">{(m.profiles as any)?.display_name || "Unknown"}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={ROLE_COLORS[m.role]}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {format(new Date(m.joined_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {isLeader && m.user_id !== user?.id && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the email of a registered user to add them to this project.
            </p>
            <Input placeholder="Member email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="leader">Project Leader</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button
                disabled={inviteLoading || !inviteEmail.trim()}
                onClick={async () => {
                  setInviteLoading(true);
                  try {
                    // Look up user by email
                    const { data: profiles, error: lookupError } = await supabase
                      .rpc("lookup_profile_by_email", { _email: inviteEmail.trim().toLowerCase() });
                    if (lookupError) throw lookupError;
                    if (!profiles || profiles.length === 0) {
                      toast.error("No user found with that email");
                      return;
                    }
                    const targetUserId = profiles[0].id;
                    // Check if already a member
                    const existing = members.find((m) => m.user_id === targetUserId);
                    if (existing) {
                      toast.error("User is already a member of this project");
                      return;
                    }
                    // Add to project
                    const { error: insertError } = await supabase
                      .from("project_members")
                      .insert({ project_id: currentProject!.id, user_id: targetUserId, role: inviteRole as any });
                    if (insertError) throw insertError;
                    toast.success("Member added successfully");
                    setInviteEmail("");
                    setShowInvite(false);
                    fetchMembers();
                  } catch (err: any) {
                    toast.error(err.message || "Failed to add member");
                  } finally {
                    setInviteLoading(false);
                  }
                }}
              >
                {inviteLoading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Team;
