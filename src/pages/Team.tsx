import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { toast } from "sonner";
import { UserPlus, Shield, Crown, User, Trash2, Mail } from "lucide-react";
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

type TaskPermissionKey = "create_tasks" | "edit_tasks" | "change_task_status" | "delete_tasks" | "assign_tasks";

const TASK_PERMISSION_LABELS: Record<TaskPermissionKey, string> = {
  create_tasks: "Create tasks",
  edit_tasks: "Edit task details",
  change_task_status: "Change task status",
  delete_tasks: "Delete tasks",
  assign_tasks: "Assign members",
};

const getDefaultTaskPermissions = (role: string) => {
  if (role === "admin" || role === "leader") {
    return {
      create_tasks: true,
      edit_tasks: true,
      change_task_status: true,
      delete_tasks: true,
      assign_tasks: true,
    };
  }

  return {
    create_tasks: false,
    edit_tasks: false,
    change_task_status: true,
    delete_tasks: false,
    assign_tasks: false,
  };
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
  const [editingDesignationMember, setEditingDesignationMember] = useState<string | null>(null);
  const [designationDraft, setDesignationDraft] = useState("");
  const [permissionSavingMember, setPermissionSavingMember] = useState<string | null>(null);

  const fetchMembers = async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("project_members")
      .select("*, profiles!project_members_user_id_profiles_fkey(display_name, avatar_url, email)")
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
    const member = members.find((m) => m.id === memberId);
    const { error } = await supabase
      .from("project_members")
      .update({
        role: newRole as any,
        task_permissions: member ? getDefaultTaskPermissions(newRole) : undefined,
      })
      .eq("id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Role updated"); setEditingMember(null); fetchMembers(); }
  };

  const updateTaskPermission = async (member: any, permission: TaskPermissionKey, enabled: boolean) => {
    const currentPermissions = {
      ...getDefaultTaskPermissions(member.role),
      ...(member.task_permissions || {}),
    };

    const nextPermissions = {
      ...currentPermissions,
      [permission]: enabled,
    };

    setPermissionSavingMember(member.id);
    const { error } = await supabase
      .from("project_members")
      .update({ task_permissions: nextPermissions })
      .eq("id", member.id);

    setPermissionSavingMember(null);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Task permission updated");
    fetchMembers();
  };

  const startDesignationEdit = (member: any) => {
    setEditingDesignationMember(member.id);
    setDesignationDraft(member.designation || "");
  };

  const saveDesignation = async (memberId: string) => {
    const { error } = await supabase
      .from("project_members")
      .update({ designation: designationDraft.trim() || null })
      .eq("id", memberId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Designation updated");
    setEditingDesignationMember(null);
    setDesignationDraft("");
    fetchMembers();
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
          const memberEmail = (m.profiles as any)?.email;
          const mailtoUrl = memberEmail ? `mailto:${encodeURIComponent(memberEmail)}` : "";
          const memberPermissions = {
            ...getDefaultTaskPermissions(m.role),
            ...(m.task_permissions || {}),
          } as Record<TaskPermissionKey, boolean>;
          const canManageMember = isLeader && m.user_id !== user?.id;

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
                      <p className="text-xs text-muted-foreground mt-0.5">{memberEmail || "No email available"}</p>
                      {canManageMember && editingMember === m.id ? (
                        <Select defaultValue={m.role} onValueChange={(val) => updateRole(m.id, val)}>
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="leader">Leader</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={() => canManageMember && setEditingMember(m.id)}>
                          <Badge className={ROLE_COLORS[m.role]}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                          </Badge>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {format(new Date(m.joined_at), "MMM d, yyyy")}
                      </p>
                      {editingDesignationMember === m.id ? (
                        <div className="mt-2 space-y-2">
                          <Input
                            value={designationDraft}
                            onChange={(e) => setDesignationDraft(e.target.value)}
                            placeholder="Designation (e.g. Frontend Developer)"
                            className="h-8 text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => saveDesignation(m.id)}>Save</Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => { setEditingDesignationMember(null); setDesignationDraft(""); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="mt-2"
                          onClick={() => {
                            if (isLeader) startDesignationEdit(m);
                          }}
                        >
                          <Badge variant="outline" className="text-xs">
                            {m.designation || "No designation"}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  {canManageMember && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {canManageMember && (
                  <div className="mt-4 border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Task permissions</p>
                    {m.role === "member" ? (
                      <div className="space-y-2">
                        {(Object.keys(TASK_PERMISSION_LABELS) as TaskPermissionKey[]).map((permissionKey) => (
                          <label key={permissionKey} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={!!memberPermissions[permissionKey]}
                              onCheckedChange={(checked) => updateTaskPermission(m, permissionKey, checked === true)}
                              disabled={permissionSavingMember === m.id}
                            />
                            <span>{TASK_PERMISSION_LABELS[permissionKey]}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Leaders and admins always have full task access.</p>
                    )}
                  </div>
                )}

                <div className="mt-4 border-t pt-3">
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild={!!memberEmail} disabled={!memberEmail}>
                    {memberEmail ? (
                      <a href={mailtoUrl}>
                        <Mail className="h-3.5 w-3.5 mr-1.5" /> Mail
                      </a>
                    ) : (
                      <span>
                        <Mail className="h-3.5 w-3.5 mr-1.5" /> Mail
                      </span>
                    )}
                  </Button>
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
                      .insert({
                        project_id: currentProject!.id,
                        user_id: targetUserId,
                        role: inviteRole as any,
                        task_permissions: getDefaultTaskPermissions(inviteRole),
                      });
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
