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
import { ArrowLeft, Server, Globe, Palette, Info, Sparkles, Blocks, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SettingsTab } from "@/routes/settings";

// 懒加载所有设置子面板（按需加载，减少首屏体积）
const ServiceSettings = lazy(() => import("./ServiceSettings").then(m => ({ default: m.ServiceSettings })));
const ProviderSettings = lazy(() => import("./ProviderSettings").then(m => ({ default: m.ProviderSettings })));
const McpSettings = lazy(() => import("./McpSettings").then(m => ({ default: m.McpSettings })));
const PermissionSettings = lazy(() => import("./PermissionSettings").then(m => ({ default: m.PermissionSettings })));
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
    { id: "permission", label: t("settings.permission"), icon: Shield },
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
        case "permission":
          return <PermissionSettings />;
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
      {/* 头部 - 精致简洁的导航栏 */}
      <header className="flex h-10 shrink-0 items-center gap-2.5 border-b border-border/50 px-3 bg-background">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleBack}
          className="shrink-0 h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-3.5 w-px bg-border/50" />
        <h1 className="text-sm font-medium text-foreground">{t("settings.title")}</h1>
      </header>

      {/* 主体区域 - 双栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏 - Zed 风格精致侧边导航 */}
        <nav className="w-52 shrink-0 border-r border-border/50 bg-surface-0/50">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-0.5 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                      "hover:bg-accent/50",
                      "focus-visible:outline-none",
                      isActive
                        ? "text-foreground bg-accent/60"
                        : "text-muted-foreground/80 hover:text-foreground"
                    )}
                  >
                    {/* 激活指示条 - 2px 宽主题色竖线 */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />
                    )}
                    <Icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors duration-150",
                      isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
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
            <div className="min-h-full p-6 lg:p-8">
              <div className="mx-auto w-full max-w-2xl">
                {renderContent()}
              </div>
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
