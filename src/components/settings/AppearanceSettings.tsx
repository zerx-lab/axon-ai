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
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("settings.appearanceSettings.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.appearanceSettings.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.appearanceSettings.theme")}</CardTitle>
          <CardDescription>
            {t("settings.appearanceSettings.themeDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {themes.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex flex-col items-center gap-3 rounded-lg border p-6 text-center transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                {theme === value && (
                  <div className="absolute right-2 top-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  theme === value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
