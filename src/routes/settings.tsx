/**
 * 设置页面路由
 * 使用 search params 记录当前激活的 tab 状态
 * 
 * 性能优化：使用 TanStack Router 的 lazy 加载
 */

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

// 设置页面的 tab 类型
export type SettingsTab = "service" | "provider" | "mcp" | "language" | "appearance" | "about";

// search params 类型定义
export interface SettingsSearch {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/settings")({
  // 使用 lazyRouteComponent 懒加载设置页面
  component: lazyRouteComponent(
    () => import("@/components/settings/SettingsPage"),
    "SettingsPage"
  ),
  // 验证和解析 search params
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    const validTabs: SettingsTab[] = ["service", "provider", "mcp", "language", "appearance", "about"];
    const tab = search.tab as string | undefined;
    return {
      tab: tab && validTabs.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined,
    };
  },
});
