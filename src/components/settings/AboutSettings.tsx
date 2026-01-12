/**
 * 关于设置组件
 * 显示应用信息
 */

import { useTranslation } from "react-i18next";
import { ExternalLink, Github, FileText, Scale } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// 应用版本信息 (后续可以从 Tauri 获取)
const APP_VERSION = "0.1.0";
const OPENCODE_DOCS_URL = "https://opencode.ai/docs";
const GITHUB_URL = "https://github.com/anomalyco/opencode";

export function AboutSettings() {
  const { t } = useTranslation();

  const handleOpenUrl = async (url: string) => {
    // 使用 Tauri opener 插件打开外部浏览器
    try {
      await openUrl(url);
    } catch (error) {
      console.error("打开链接失败:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{t("settings.aboutSettings.title")}</h2>
      </div>

      {/* 应用信息卡片 */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <div className="flex flex-col items-center text-center space-y-3">
            {/* 应用图标 */}
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-xl font-semibold text-primary">A</span>
            </div>
            
            {/* 应用名称和版本 */}
            <div className="space-y-0.5">
              <h3 className="text-lg font-semibold">{t("app.name")}</h3>
              <p className="text-xs text-muted-foreground/70">
                {t("settings.aboutSettings.version")} {APP_VERSION}
              </p>
            </div>

            {/* 描述 */}
            <p className="max-w-sm text-[13px] text-muted-foreground/80 leading-relaxed">
              {t("settings.aboutSettings.description")}
            </p>
          </div>

          <Separator className="my-4" />

          {/* 链接列表 */}
          <div className="space-y-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start h-9 text-[13px] hover:bg-accent"
              onClick={() => handleOpenUrl(GITHUB_URL)}
            >
              <Github className="mr-2.5 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{t("settings.aboutSettings.github")}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-9 text-[13px] hover:bg-accent"
              onClick={() => handleOpenUrl(OPENCODE_DOCS_URL)}
            >
              <FileText className="mr-2.5 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{t("settings.aboutSettings.documentation")}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-9 text-[13px] hover:bg-accent"
              onClick={() => handleOpenUrl(`${GITHUB_URL}/blob/main/LICENSE`)}
            >
              <Scale className="mr-2.5 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{t("settings.aboutSettings.license")}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60" />
            </Button>
          </div>

          <Separator className="my-4" />

          {/* 版权信息 */}
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground/60">
              {t("settings.aboutSettings.builtWith")}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {t("settings.aboutSettings.mitLicense")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
