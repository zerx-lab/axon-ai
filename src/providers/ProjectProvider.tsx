/**
 * Project Context Provider
 * 
 * 提供全局的项目状态管理，确保所有组件共享同一个项目状态实例
 */

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useProjects, type UseProjectsReturn } from "@/stores/project";
import { useWorkspace } from "@/stores/workspace";

// 创建 Context
const ProjectContext = createContext<UseProjectsReturn | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
}

/**
 * Project Provider
 * 
 * 包装 useProjects hook，使其状态在所有子组件中共享
 * 并在工作区初始化后自动初始化项目
 */
export function ProjectProvider({ children }: ProjectProviderProps) {
  const projectState = useProjects();
  const { state: workspaceState } = useWorkspace();

  // 工作区初始化后，初始化项目
  useEffect(() => {
    if (workspaceState.isInitialized && workspaceState.defaultDirectory) {
      projectState.initialize(workspaceState.defaultDirectory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceState.isInitialized, workspaceState.defaultDirectory]);

  return (
    <ProjectContext.Provider value={projectState}>
      {children}
    </ProjectContext.Provider>
  );
}

/**
 * 使用共享的 Project 状态
 * 
 * 必须在 ProjectProvider 内部使用
 */
export function useProjectContext(): UseProjectsReturn {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within ProjectProvider");
  }
  return context;
}
