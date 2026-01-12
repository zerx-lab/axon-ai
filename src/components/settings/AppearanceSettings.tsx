/**
 * 外观设置组件
 * 用于切换主题
 */

import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/stores/theme";

export function AppearanceSettings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      value: "light" as Theme,
      label: t("titlebar.theme.light"),
      description: t("settings.appearanceSettings.lightDescription"),
      icon: Sun,
    },
    {
      value: "dark" as Theme,
      label: t("titlebar.theme.dark"),
      description: t("settings.appearanceSettings.darkDescription"),
      icon: Moon,
    },
    {
      value: "system" as Theme,
      label: t("titlebar.theme.system"),
      description: t("settings.appearanceSettings.systemDescription"),
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t("settings.appearanceSettings.title")}</h2>
        <p className="text-[13px] text-muted-foreground/80">
          {t("settings.appearanceSettings.description")}
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("settings.appearanceSettings.theme")}</CardTitle>
          <CardDescription className="text-xs">
            {t("settings.appearanceSettings.themeDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {themes.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex flex-col items-center gap-2.5 rounded-md border p-4 text-center transition-colors duration-150",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
                  theme === value
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/50"
                )}
              >
                {theme === value && (
                  <div className="absolute right-1.5 top-1.5">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md",
                  theme === value ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                )}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground/70">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
