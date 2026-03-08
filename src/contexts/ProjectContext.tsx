import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects">;

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  loading: boolean;
  refetchProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType>({} as ProjectContextType);

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    const nextProjects = data || [];
    setProjects(nextProjects);
    setCurrentProject((prev) => {
      if (nextProjects.length === 0) return null;
      if (prev && nextProjects.some((project) => project.id === prev.id)) return prev;
      return nextProjects[0];
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`project-membership-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchProjects()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProjects]);

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, loading, refetchProjects: fetchProjects }}>
      {children}
    </ProjectContext.Provider>
  );
};
