/**
 * 设置页面组件
 * 包含服务设置、AI 渠道商设置、MCP设置、语言设置、外观设置等
 * 采用左侧导航 + 右侧内容的双栏布局
 * Tab 状态通过 URL search params 记录，支持刷新保持状态
 * 
 * 性能优化：
 * 1. 所有设置子面板懒加载
 * 2. 仅当切换到对应 tab 时才加载组件
 */

import { lazy, Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Server, Globe, Palette, Info, Sparkles, Blocks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SettingsTab } from "@/routes/settings";

// 懒加载所有设置子面板（按需加载，减少首屏体积）
const ServiceSettings = lazy(() => import("./ServiceSettings").then(m => ({ default: m.ServiceSettings })));
const ProviderSettings = lazy(() => import("./ProviderSettings").then(m => ({ default: m.ProviderSettings })));
const McpSettings = lazy(() => import("./McpSettings").then(m => ({ default: m.McpSettings })));
const LanguageSettings = lazy(() => import("./LanguageSettings").then(m => ({ default: m.LanguageSettings })));
const AppearanceSettings = lazy(() => import("./AppearanceSettings").then(m => ({ default: m.AppearanceSettings })));
const AboutSettings = lazy(() => import("./AboutSettings").then(m => ({ default: m.AboutSettings })));

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: typeof Server;
}

/**
 * 设置面板加载占位符
 */
function SettingsLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // 从 URL search params 获取当前 tab，默认为 "service"
  const { tab } = useSearch({ from: "/settings" });
  const activeTab: SettingsTab = tab ?? "service";

  const handleBack = () => {
    navigate({ to: "/" });
  };

  // 切换 tab 时更新 URL search params
  const handleTabChange = (tabId: SettingsTab) => {
    navigate({
      to: "/settings",
      search: { tab: tabId },
      replace: true, // 使用 replace 避免产生过多历史记录
    });
  };

  const navItems: NavItem[] = [
    { id: "service", label: t("settings.service"), icon: Server },
    { id: "provider", label: t("settings.provider"), icon: Sparkles },
    { id: "mcp", label: t("settings.mcp"), icon: Blocks },
    { id: "language", label: t("settings.language"), icon: Globe },
    { id: "appearance", label: t("settings.appearance"), icon: Palette },
    { id: "about", label: t("settings.about"), icon: Info },
  ];

  const renderContent = () => {
    const content = (() => {
      switch (activeTab) {
        case "service":
          return <ServiceSettings />;
        case "provider":
          return <ProviderSettings />;
        case "mcp":
          return <McpSettings />;
        case "language":
          return <LanguageSettings />;
        case "appearance":
          return <AppearanceSettings />;
        case "about":
          return <AboutSettings />;
        default:
          return null;
      }
    })();

    return (
      <Suspense fallback={<SettingsLoadingFallback />}>
        {content}
      </Suspense>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* 头部 - 精致的导航栏 */}
      <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border/60 px-5 bg-background/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleBack}
          className="shrink-0 hover:bg-accent/80 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-4 w-px bg-border/60" />
        <h1 className="text-base font-semibold tracking-tight">{t("settings.title")}</h1>
      </div>

      {/* 主体区域 - 双栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏 - 精致的侧边导航 */}
        <nav className="w-56 shrink-0 border-r border-border/60 bg-surface-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1 p-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      "hover:bg-accent/80",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      isActive
                        ? "bg-accent text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </nav>

        {/* 右侧内容区域 */}
        <main className="flex-1 overflow-hidden bg-background">
          <ScrollArea className="h-full">
            <div className="min-h-full p-8 lg:p-10">
              <div className="mx-auto w-full max-w-3xl">
                {renderContent()}
              </div>
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
