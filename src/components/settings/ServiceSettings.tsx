/**
 * 服务设置组件
 * 用于配置本地/远程服务模式
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpencode } from "@/hooks";
import type { ServiceMode } from "@/services/opencode/types";

export function ServiceSettings() {
  const { t } = useTranslation();
  const {
    state,
    isConnected,
    isLoading,
    setMode,
    connect,
    startBackend,
    stopBackend,
    restartBackend,
  } = useOpencode();

  // 本地状态
  const [selectedMode, setSelectedMode] = useState<"local" | "remote">(
    state.config.mode.type
  );
  const [remoteUrl, setRemoteUrl] = useState(
    state.config.mode.type === "remote" ? state.config.mode.url : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  // 同步状态
  useEffect(() => {
    setSelectedMode(state.config.mode.type);
    if (state.config.mode.type === "remote") {
      setRemoteUrl(state.config.mode.url);
    }
  }, [state.config.mode]);

  // 处理模式切换
  const handleModeChange = (value: string) => {
    setSelectedMode(value as "local" | "remote");
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      let mode: ServiceMode;
      
      if (selectedMode === "remote") {
        // 验证 URL
        if (!remoteUrl.trim()) {
          toast.error(t("errors.invalidUrl"));
          return;
        }
        
        // 简单 URL 验证
        try {
          new URL(remoteUrl);
        } catch {
          toast.error(t("errors.invalidUrl"));
          return;
        }
        
        mode = { type: "remote", url: remoteUrl.trim() };
      } else {
        mode = { type: "local" };
      }

      await setMode(mode);
      toast.success(t("notifications.settingsSaved"));
    } catch (error) {
      console.error("保存设置失败:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setIsSaving(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    try {
      await connect();
      if (isConnected) {
        toast.success(t("notifications.connectionSuccess"));
      }
    } catch {
      toast.error(t("notifications.connectionFailed"));
    }
  };

  // 获取连接状态显示
  const getConnectionStatus = () => {
    const { connectionState } = state;
    
    switch (connectionState.status) {
      case "connected":
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          text: t("settings.serviceSettings.connected"),
          color: "text-green-500",
        };
      case "connecting":
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />,
          text: t("settings.serviceSettings.connecting"),
          color: "text-yellow-500",
        };
      case "error":
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          text: connectionState.message || t("settings.serviceSettings.disconnected"),
          color: "text-red-500",
        };
      default:
        return {
          icon: <XCircle className="h-5 w-5 text-muted-foreground" />,
          text: t("settings.serviceSettings.disconnected"),
          color: "text-muted-foreground",
        };
    }
  };

  // 获取后端状态显示
  const getBackendStatus = () => {
    const { backendStatus } = state;
    
    switch (backendStatus.type) {
      case "running":
        return { text: t("settings.serviceSettings.backendRunning", { port: backendStatus.port }), canStart: false, canStop: true };
      case "starting":
        return { text: t("settings.serviceSettings.backendStarting"), canStart: false, canStop: false };
      case "downloading":
        return { text: t("settings.serviceSettings.backendDownloading", { progress: Math.round(backendStatus.progress * 100) }), canStart: false, canStop: false };
      case "ready":
        return { text: t("settings.serviceSettings.backendReady"), canStart: true, canStop: false };
      case "stopped":
        return { text: t("settings.serviceSettings.backendStopped"), canStart: true, canStop: false };
      case "error":
        return { text: t("settings.serviceSettings.backendError", { message: backendStatus.message }), canStart: true, canStop: false };
      default:
        return { text: t("settings.serviceSettings.backendNotInitialized"), canStart: false, canStop: false };
    }
  };

  const connectionStatus = getConnectionStatus();
  const backendStatus = getBackendStatus();

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("settings.serviceSettings.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.serviceSettings.description")}
        </p>
      </div>

      {/* 服务模式选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.serviceSettings.mode")}</CardTitle>
          <CardDescription>{t("settings.serviceSettings.modeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedMode} onValueChange={handleModeChange} className="space-y-4">
            {/* 本地服务 */}
            <label
              htmlFor="local"
              className="flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="local" id="local" className="mt-1" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {t("settings.serviceSettings.local")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("settings.serviceSettings.localDescription")}
                </p>
              </div>
            </label>

            {/* 远程服务 */}
            <label
              htmlFor="remote"
              className="flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="remote" id="remote" className="mt-1" />
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {t("settings.serviceSettings.remote")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("settings.serviceSettings.remoteDescription")}
                  </p>
                </div>
                
                {selectedMode === "remote" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="remoteUrl" className="text-sm">
                      {t("settings.serviceSettings.remoteUrl")}
                    </Label>
                    <Input
                      id="remoteUrl"
                      type="url"
                      placeholder={t("settings.serviceSettings.remoteUrlPlaceholder")}
                      value={remoteUrl}
                      onChange={(e) => setRemoteUrl(e.target.value)}
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("settings.serviceSettings.remoteUrlHint")}
                    </p>
                  </div>
                )}
              </div>
            </label>
          </RadioGroup>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 连接状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.serviceSettings.status")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 连接状态显示 */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              {connectionStatus.icon}
              <div>
                <p className={`font-medium ${connectionStatus.color}`}>
                  {connectionStatus.text}
                </p>
                {state.endpoint && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {state.endpoint}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("settings.serviceSettings.testConnection")}
            </Button>
          </div>

          {/* 本地服务控制（仅在本地模式下显示） */}
          {selectedMode === "local" && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("settings.serviceSettings.backendService")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {backendStatus.text}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startBackend}
                  disabled={!backendStatus.canStart || isLoading}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {t("settings.serviceSettings.startService")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopBackend}
                  disabled={!backendStatus.canStop || isLoading}
                >
                  <Square className="mr-2 h-4 w-4" />
                  {t("settings.serviceSettings.stopService")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={restartBackend}
                  disabled={!backendStatus.canStop || isLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("settings.serviceSettings.restartService")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
