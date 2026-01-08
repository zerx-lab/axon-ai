/**
 * 项目状态管理
 * 
 * 管理项目列表，包括：
 * - 默认项目的初始化
 * - 打开/关闭项目
 * - 项目展开/折叠状态
 */

import { useState, useCallback, useEffect } from "react";
import type { Project } from "@/types/project";
import {
  DEFAULT_PROJECT_ID,
  createDefaultProject,
  createProject,
  isSameDirectory,
  normalizeDirectory,
} from "@/types/project";
import type { Session } from "@/types/chat";

// ============== 常量 ==============

/** localStorage 存储键名 - 项目列表 */
const PROJECTS_STORAGE_KEY = "axon-projects";

// ============== 类型定义 ==============

/** 项目状态 */
export interface ProjectState {
  /** 项目列表 */
  projects: Project[];
  /** 是否已初始化 */
  isInitialized: boolean;
}

/** 关闭项目的结果 */
export interface CloseProjectResult {
  /** 是否成功 */
  success: boolean;
  /** 被关闭的项目 */
  project?: Project;
}

/** 项目操作返回值 */
export interface UseProjectsReturn {
  // 状态
  projects: Project[];
  isInitialized: boolean;
  
  // 获取方法
  getProject: (projectId: string) => Project | undefined;
  getProjectByDirectory: (directory: string) => Project | undefined;
  getDefaultProject: () => Project | undefined;
  
  // 操作方法
  initialize: (defaultDirectory: string) => void;
  openProject: (directory: string) => Project;
  closeProject: (projectId: string) => CloseProjectResult;
  toggleProjectExpanded: (projectId: string) => void;
  
  // 辅助方法
  getProjectsWithSessions: (sessions: Session[]) => Array<{
    project: Project;
    sessions: Session[];
  }>;
}

// ============== 辅助函数 ==============

/**
 * 从 localStorage 加载项目列表
 */
function loadProjects(): Project[] {
  try {
    const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("[Projects] 加载项目列表失败:", e);
  }
  return [];
}

/**
 * 保存项目列表到 localStorage
 */
function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("[Projects] 保存项目列表失败:", e);
  }
}

// ============== Hook ==============

/**
 * 项目管理 Hook
 */
export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [isInitialized, setIsInitialized] = useState(false);

  // 保存项目列表变化
  useEffect(() => {
    if (isInitialized) {
      saveProjects(projects);
    }
  }, [projects, isInitialized]);

  // 初始化项目（确保默认项目存在）
  const initialize = useCallback((defaultDirectory: string) => {
    setProjects((prev) => {
      // 检查是否已有默认项目
      const existingDefault = prev.find((p) => p.id === DEFAULT_PROJECT_ID);
      
      if (existingDefault) {
        // 如果默认项目存在但目录不同，更新目录
        if (!isSameDirectory(existingDefault.directory, defaultDirectory)) {
          console.log("[Projects] 更新默认项目目录:", defaultDirectory);
          return prev.map((p) =>
            p.id === DEFAULT_PROJECT_ID
              ? { ...p, directory: defaultDirectory, updatedAt: Date.now() }
              : p
          );
        }
        console.log("[Projects] 默认项目已存在");
        return prev;
      }
      
      // 创建默认项目
      console.log("[Projects] 创建默认项目:", defaultDirectory);
      const defaultProject = createDefaultProject(defaultDirectory);
      return [defaultProject, ...prev];
    });
    
    setIsInitialized(true);
  }, []);

  // 获取项目
  const getProject = useCallback(
    (projectId: string): Project | undefined => {
      return projects.find((p) => p.id === projectId);
    },
    [projects]
  );

  // 通过目录获取项目
  const getProjectByDirectory = useCallback(
    (directory: string): Project | undefined => {
      return projects.find((p) => isSameDirectory(p.directory, directory));
    },
    [projects]
  );

  // 获取默认项目
  const getDefaultProject = useCallback((): Project | undefined => {
    return projects.find((p) => p.id === DEFAULT_PROJECT_ID);
  }, [projects]);

  // 打开项目（如果不存在则创建）
  const openProject = useCallback(
    (directory: string): Project => {
      // 检查项目是否已存在
      const existing = projects.find((p) => isSameDirectory(p.directory, directory));
      
      if (existing) {
        // 如果项目存在但未展开，展开它
        if (!existing.expanded) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === existing.id
                ? { ...p, expanded: true, updatedAt: Date.now() }
                : p
            )
          );
        }
        return existing;
      }
      
      // 创建新项目
      const newProject = createProject(directory);
      console.log("[Projects] 创建新项目:", newProject.name, directory);
      
      setProjects((prev) => {
        // 将新项目添加到默认项目之后
        const defaultIndex = prev.findIndex((p) => p.id === DEFAULT_PROJECT_ID);
        if (defaultIndex >= 0) {
          const newList = [...prev];
          newList.splice(defaultIndex + 1, 0, newProject);
          return newList;
        }
        return [...prev, newProject];
      });
      
      return newProject;
    },
    [projects]
  );

  // 关闭项目（从列表移除，返回被关闭的项目信息）
  const closeProject = useCallback(
    (projectId: string): CloseProjectResult => {
      const project = projects.find((p) => p.id === projectId);
      
      // 不能关闭默认项目
      if (!project || project.isDefault) {
        console.warn("[Projects] 不能关闭默认项目或项目不存在:", projectId);
        return { success: false };
      }
      
      console.log("[Projects] 关闭项目:", project.name);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      return { success: true, project };
    },
    [projects]
  );

  // 切换项目展开/折叠状态
  const toggleProjectExpanded = useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, expanded: !p.expanded, updatedAt: Date.now() }
          : p
      )
    );
  }, []);

  // 获取带有会话的项目列表（用于 UI 展示）
  const getProjectsWithSessions = useCallback(
    (sessions: Session[]): Array<{ project: Project; sessions: Session[] }> => {
      // 按项目目录分组会话
      const sessionsByDirectory = new Map<string, Session[]>();
      
      for (const session of sessions) {
        const normalizedDir = normalizeDirectory(session.directory || "");
        const existing = sessionsByDirectory.get(normalizedDir) || [];
        existing.push(session);
        sessionsByDirectory.set(normalizedDir, existing);
      }
      
      // 为每个项目匹配会话
      const result: Array<{ project: Project; sessions: Session[] }> = [];
      const matchedDirectories = new Set<string>();
      
      for (const project of projects) {
        const normalizedProjectDir = normalizeDirectory(project.directory);
        const projectSessions = sessionsByDirectory.get(normalizedProjectDir) || [];
        matchedDirectories.add(normalizedProjectDir);
        
        result.push({
          project,
          sessions: projectSessions.sort((a, b) => b.updatedAt - a.updatedAt),
        });
      }
      
      // 处理不属于任何项目的会话（归入默认项目）
      const defaultProject = projects.find((p) => p.id === DEFAULT_PROJECT_ID);
      if (defaultProject) {
        const defaultProjectResult = result.find(
          (r) => r.project.id === DEFAULT_PROJECT_ID
        );
        
        if (defaultProjectResult) {
          // 将未匹配的会话添加到默认项目
          for (const [dir, sessions] of sessionsByDirectory) {
            if (!matchedDirectories.has(dir)) {
              defaultProjectResult.sessions.push(...sessions);
            }
          }
          // 重新排序
          defaultProjectResult.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        }
      }
      
      return result;
    },
    [projects]
  );

  return {
    projects,
    isInitialized,
    getProject,
    getProjectByDirectory,
    getDefaultProject,
    initialize,
    openProject,
    closeProject,
    toggleProjectExpanded,
    getProjectsWithSessions,
  };
}
