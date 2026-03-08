import React, { createContext, useContext, useState, useEffect } from "react";
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

  const fetchProjects = async () => {
    if (!user) { setProjects([]); setLoading(false); return; }
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);
    if (data && data.length > 0 && !currentProject) {
      setCurrentProject(data[0]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, [user]);

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, loading, refetchProjects: fetchProjects }}>
      {children}
    </ProjectContext.Provider>
  );
};
