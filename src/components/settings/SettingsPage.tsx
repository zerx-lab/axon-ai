/**
 * 设置页面组件
 * 包含服务设置、AI 渠道商设置、语言设置、外观设置等
 * 采用左侧导航 + 右侧内容的双栏布局
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Server, Globe, Palette, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ServiceSettings } from "./ServiceSettings";
import { ProviderSettings } from "./ProviderSettings";
import { LanguageSettings } from "./LanguageSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { AboutSettings } from "./AboutSettings";

type SettingsTab = "service" | "provider" | "language" | "appearance" | "about";

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: typeof Server;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("service");

  const handleBack = () => {
    navigate({ to: "/" });
  };

  const navItems: NavItem[] = [
    { id: "service", label: t("settings.service"), icon: Server },
    { id: "provider", label: "AI 服务商", icon: Sparkles },
    { id: "language", label: t("settings.language"), icon: Globe },
    { id: "appearance", label: t("settings.appearance"), icon: Palette },
    { id: "about", label: t("settings.about"), icon: Info },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "service":
        return <ServiceSettings />;
      case "provider":
        return <ProviderSettings />;
      case "language":
        return <LanguageSettings />;
      case "appearance":
        return <AppearanceSettings />;
      case "about":
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* 头部 */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">{t("settings.title")}</h1>
      </div>

      {/* 主体区域 - 双栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧导航栏 */}
        <nav className="w-48 shrink-0 border-r border-border bg-muted/30">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-1 p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      activeTab === item.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </nav>

        {/* 右侧内容区域 */}
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="min-h-full p-6 lg:p-8">
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
