/**
 * 语言设置组件
 * 用于切换应用语言
 */

import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { changeLanguage, supportedLanguages, type SupportedLanguage } from "@/i18n";

export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    if (lang === currentLanguage) return;
    
    try {
      await changeLanguage(lang);
      toast.success(t("notifications.languageChanged"));
    } catch (error) {
      console.error("切换语言失败:", error);
    }
  };

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("settings.languageSettings.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.languageSettings.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.language")}</CardTitle>
          <CardDescription>
            {t("settings.languageSettings.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
              <button
                key={code}
                onClick={() => handleLanguageChange(code as SupportedLanguage)}
                className={cn(
                  "relative flex items-center justify-between rounded-lg border p-4 text-left transition-colors",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  currentLanguage === code
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="space-y-1">
                  <p className="font-medium">{nativeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {code === "zh" ? "简体中文" : "English (US)"}
                  </p>
                </div>
                {currentLanguage === code && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
