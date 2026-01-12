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
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t("settings.languageSettings.title")}</h2>
        <p className="text-[13px] text-muted-foreground/80">
          {t("settings.languageSettings.description")}
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("settings.language")}</CardTitle>
          <CardDescription className="text-xs">
            {t("settings.languageSettings.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
              <button
                key={code}
                onClick={() => handleLanguageChange(code as SupportedLanguage)}
                className={cn(
                  "relative flex items-center justify-between rounded-md border p-3 text-left transition-colors duration-150",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
                  currentLanguage === code
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/50"
                )}
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{nativeName}</p>
                  <p className="text-xs text-muted-foreground/70">
                    {t(`settings.languageSettings.${code === "zh" ? "chineseDesc" : "englishDesc"}`)}
                  </p>
                </div>
                {currentLanguage === code && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
