/**
 * 设置页面路由
 */

import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
