/**
 * 设置页面路由
 * 使用 search params 记录当前激活的 tab 状态
 * 
 * 性能优化：使用 TanStack Router 的 lazy 加载
 */

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export type SettingsTab = "service" | "provider" | "mcp" | "permission" | "language" | "appearance" | "about";

export interface SettingsSearch {
  tab?: SettingsTab;
}

export const Route = createFileRoute("/settings")({
  component: lazyRouteComponent(
    () => import("@/components/settings/SettingsPage"),
    "SettingsPage"
  ),
  validateSearch: (search: Record<string, unknown>): SettingsSearch => {
    const validTabs: SettingsTab[] = ["service", "provider", "mcp", "permission", "language", "appearance", "about"];
    const tab = search.tab as string | undefined;
    return {
      tab: tab && validTabs.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined,
    };
  },
});
