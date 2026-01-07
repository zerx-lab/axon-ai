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
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("settings.aboutSettings.title")}</h2>
      </div>

      {/* 应用信息卡片 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* 应用图标 */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
              <span className="text-3xl font-bold text-primary">A</span>
            </div>
            
            {/* 应用名称和版本 */}
            <div className="space-y-1">
              <h3 className="text-2xl font-bold">{t("app.name")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("settings.aboutSettings.version")} {APP_VERSION}
              </p>
            </div>

            {/* 描述 */}
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              {t("settings.aboutSettings.description")}
            </p>
          </div>

          <Separator className="my-6" />

          {/* 链接列表 */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => handleOpenUrl(GITHUB_URL)}
            >
              <Github className="mr-3 h-5 w-5" />
              <span className="flex-1 text-left">{t("settings.aboutSettings.github")}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => handleOpenUrl(OPENCODE_DOCS_URL)}
            >
              <FileText className="mr-3 h-5 w-5" />
              <span className="flex-1 text-left">{t("settings.aboutSettings.documentation")}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => handleOpenUrl(`${GITHUB_URL}/blob/main/LICENSE`)}
            >
              <Scale className="mr-3 h-5 w-5" />
              <span className="flex-1 text-left">{t("settings.aboutSettings.license")}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <Separator className="my-6" />

          {/* 版权信息 */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Built with Tauri, React & OpenCode
            </p>
            <p className="text-xs text-muted-foreground">
              MIT License
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
