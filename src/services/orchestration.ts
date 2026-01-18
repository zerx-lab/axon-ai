/**
 * 编排组服务层
 *
 * 提供 OrchestrationGroup 的读写操作，调用 Tauri 后端命令
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  OrchestrationGroup,
  OrchestrationGroupSummary,
} from "@/types/orchestration";
import { toOrchestrationGroupSummary } from "@/types/orchestration";

// ============================================================================
// 服务函数
// ============================================================================

/**
 * 获取编排组配置存储目录
 */
export async function getOrchestrationsDirectory(): Promise<string> {
  return await invoke<string>("get_orchestrations_directory");
}

/**
 * 列出所有编排组摘要
 */
export async function listOrchestrations(): Promise<OrchestrationGroupSummary[]> {
  try {
    const result = await invoke<string>("list_orchestrations");
    const groups = JSON.parse(result) as OrchestrationGroup[];
    return groups.map(toOrchestrationGroupSummary);
  } catch (error) {
    // 如果后端命令不存在，返回空数组（兼容旧版本）
    console.warn("list_orchestrations 命令不可用，返回空数组:", error);
    return [];
  }
}

/**
 * 读取单个编排组完整配置
 */
export async function readOrchestration(
  orchestrationId: string
): Promise<OrchestrationGroup> {
  const jsonStr = await invoke<string>("read_orchestration", { orchestrationId });
  return JSON.parse(jsonStr) as OrchestrationGroup;
}

/**
 * 保存编排组配置
 */
export async function saveOrchestration(group: OrchestrationGroup): Promise<void> {
  const config = JSON.stringify(group);
  await invoke("save_orchestration", { orchestrationId: group.id, config });
}

/**
 * 删除编排组配置
 */
export async function deleteOrchestration(orchestrationId: string): Promise<void> {
  await invoke("delete_orchestration", { orchestrationId });
}

/**
 * 批量保存编排组配置
 */
export async function saveOrchestrationsBatch(
  groups: OrchestrationGroup[]
): Promise<void> {
  const pairs: [string, string][] = groups.map((group) => [
    group.id,
    JSON.stringify(group),
  ]);
  await invoke("save_orchestrations_batch", { orchestrations: pairs });
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 读取所有编排组完整配置
 */
export async function readAllOrchestrations(): Promise<OrchestrationGroup[]> {
  try {
    const result = await invoke<string>("list_orchestrations");
    return JSON.parse(result) as OrchestrationGroup[];
  } catch {
    return [];
  }
}

/**
 * 创建或更新编排组
 */
export async function upsertOrchestration(group: OrchestrationGroup): Promise<void> {
  group.updatedAt = Date.now();
  await saveOrchestration(group);
}

/**
 * 检查编排组是否存在
 */
export async function orchestrationExists(orchestrationId: string): Promise<boolean> {
  try {
    await readOrchestration(orchestrationId);
    return true;
  } catch {
    return false;
  }
}

/**
 * 复制编排组
 */
export async function duplicateOrchestration(
  orchestrationId: string,
  newName?: string
): Promise<OrchestrationGroup> {
  const original = await readOrchestration(orchestrationId);
  const now = Date.now();

  const duplicate: OrchestrationGroup = {
    ...original,
    id: `orch-${now}-${Math.random().toString(36).slice(2, 9)}`,
    name: newName || `${original.name} (副本)`,
    createdAt: now,
    updatedAt: now,
  };

  await saveOrchestration(duplicate);
  return duplicate;
}
