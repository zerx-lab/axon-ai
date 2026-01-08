/**
 * 项目类型定义
 *
 * 项目用于组织和管理会话，每个项目对应一个工作目录
 */

// ============== 项目类型 ==============

/**
 * 项目信息
 * 项目是会话的容器，每个项目对应一个工作目录
 */
export interface Project {
  /** 项目唯一 ID（使用目录路径的 hash 或特殊标识） */
  id: string;
  /** 项目名称（显示用） */
  name: string;
  /** 项目工作目录路径 */
  directory: string;
  /** 是否为默认项目（默认项目不可删除） */
  isDefault: boolean;
  /** 是否展开显示会话列表 */
  expanded: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

// ============== 常量 ==============

/** 默认项目 ID */
export const DEFAULT_PROJECT_ID = "default";

/** 默认项目名称 */
export const DEFAULT_PROJECT_NAME = "默认项目";

// ============== 辅助函数 ==============

/**
 * 从目录路径生成项目 ID
 * 使用简单的 hash 算法
 */
export function generateProjectId(directory: string): string {
  // 规范化路径
  const normalized = directory.replace(/\\/g, "/").replace(/\/$/, "");

  // 简单的 hash 算法
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为 32 位整数
  }

  return `proj_${Math.abs(hash).toString(36)}`;
}

/**
 * 从目录路径提取项目名称
 */
export function getProjectNameFromDirectory(directory: string): string {
  const normalized = directory.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

/**
 * 创建一个新项目
 */
export function createProject(
  directory: string,
  options?: {
    id?: string;
    name?: string;
    isDefault?: boolean;
  },
): Project {
  const now = Date.now();
  const id = options?.id ?? generateProjectId(directory);
  const name = options?.name ?? getProjectNameFromDirectory(directory);

  return {
    id,
    name,
    directory,
    isDefault: options?.isDefault ?? false,
    expanded: true, // 默认展开
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 创建默认项目
 */
export function createDefaultProject(directory: string): Project {
  return createProject(directory, {
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    isDefault: true,
  });
}

/**
 * 规范化目录路径（用于比较）
 */
export function normalizeDirectory(directory: string): string {
  return directory.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
}

/**
 * 比较两个目录路径是否相同
 */
export function isSameDirectory(dir1: string, dir2: string): boolean {
  return normalizeDirectory(dir1) === normalizeDirectory(dir2);
}
