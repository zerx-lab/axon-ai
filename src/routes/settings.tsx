/**
 * 设置页面路由
 * 使用 search params 记录当前激活的 tab 状态
 */

import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";

// 设置页面的 tab 类型
export type SettingsTab = "service" | "provider" | "mcp" | "language" | "appearance" | "about";

// search params 类型定义
export interface SettingsSearch {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  // 验证和解析 search params
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    const validTabs: SettingsTab[] = ["service", "provider", "mcp", "language", "appearance", "about"];
    const tab = search.tab as string | undefined;
    return {
      tab: tab && validTabs.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined,
    };
  },
});
