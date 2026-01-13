/**
 * 服务设置组件
 * 用于配置本地/远程服务模式
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  Square,
  Download,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpencode } from "@/hooks";
import { opencode as tauriOpencode, settings as tauriSettings } from "@/services/tauri";
import type { ServiceMode, VersionInfo, AppSettings, DownloadProgress } from "@/services/opencode/types";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  return `${(bytes / Math.pow(k, safeIndex)).toFixed(1)} ${sizes[safeIndex]}`;
}

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
  const [isSaving, setIsSaving] = useState(false);
  
  // 版本和设置状态
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // 加载版本信息和设置
  const loadVersionAndSettings = useCallback(async () => {
    try {
      const [version, settings] = await Promise.all([
        tauriOpencode.getVersionInfo(),
        tauriSettings.get(),
      ]);
      setVersionInfo(version);
      setAppSettings(settings);
    } catch (error) {
      console.error("Failed to load version info:", error);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadVersionAndSettings();
  }, [loadVersionAndSettings]);

  // 监听下载进度事件
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let isMounted = true;
    
    const setupListener = async () => {
      unlisten = await listen<DownloadProgress>("service:download-progress", (event) => {
        if (isMounted) {
          setDownloadProgress(event.payload);
        }
      });
    };
    
    setupListener();
    
    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 同步状态
  useEffect(() => {
    setSelectedMode(state.config.mode.type);
  }, [state.config.mode]);

  // 处理模式切换
  const handleModeChange = (value: string) => {
    setSelectedMode(value as "local" | "remote");
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const mode: ServiceMode = { type: "local" };
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

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const info = await tauriOpencode.checkForUpdate();
      setVersionInfo(info);
      if (info.updateAvailable) {
        toast.info(t("settings.serviceSettings.updateAvailable", { version: info.latest }));
      } else {
        toast.success(t("settings.serviceSettings.upToDate"));
      }
    } catch (error) {
      console.error("Check update failed:", error);
      toast.error(t("errors.unknownError"));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setDownloadProgress(null);
    try {
      await tauriOpencode.updateOpencode();
      await loadVersionAndSettings();
      toast.success(t("settings.serviceSettings.updateSuccess"));
    } catch (error) {
      console.error("Update failed:", error);
      toast.error(t("settings.serviceSettings.updateFailed"));
    } finally {
      setIsUpdating(false);
      setDownloadProgress(null);
    }
  };

  const handleAutoUpdateChange = async (enabled: boolean) => {
    try {
      await tauriSettings.setAutoUpdate(enabled);
      setAppSettings((prev) => prev ? { ...prev, autoUpdate: enabled } : null);
      toast.success(t("notifications.settingsSaved"));
    } catch (error) {
      console.error("Failed to save auto update setting:", error);
      toast.error(t("errors.unknownError"));
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">{t("settings.serviceSettings.title")}</h2>
        <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
          {t("settings.serviceSettings.description")}
        </p>
      </div>

      {/* 服务模式选择 */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("settings.serviceSettings.mode")}</CardTitle>
          <CardDescription className="text-[13px]">{t("settings.serviceSettings.modeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={selectedMode} onValueChange={handleModeChange} className="space-y-2">
            {/* 本地服务 */}
            <label
              htmlFor="local"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3.5 transition-all duration-150 hover:bg-accent/40 hover:border-border/80 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="local" id="local" className="mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                    <Server className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">
                    {t("settings.serviceSettings.local")}
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground/80 leading-relaxed pl-8">
                  {t("settings.serviceSettings.localDescription")}
                </p>
              </div>
            </label>

            {/* 远程服务（暂不支持，禁用状态） */}
            <div
              className="flex items-start gap-3 rounded-lg border border-border/30 p-3.5 opacity-50 cursor-not-allowed bg-muted/20"
              title={t("settings.serviceSettings.remoteNotSupported")}
            >
              <RadioGroupItem value="remote" id="remote" className="mt-0.5" disabled />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                    <Cloud className="h-3.5 w-3.5 text-blue-500/50" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("settings.serviceSettings.remote")}
                  </span>
                  <span className="text-xs bg-muted/50 text-muted-foreground/70 px-1.5 py-0.5 rounded">
                    {t("settings.serviceSettings.comingSoon")}
                  </span>
                </div>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed pl-8">
                  {t("settings.serviceSettings.remoteNotSupported")}
                </p>
              </div>
            </div>
          </RadioGroup>

          <div className="flex justify-end pt-1">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isLoading}
              size="sm"
              className="rounded-md px-4"
            >
              {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 连接状态 */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t("settings.serviceSettings.status")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 连接状态显示 */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-1/50 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/50">
                {connectionStatus.icon}
              </div>
              <div>
                <p className={`text-sm font-medium ${connectionStatus.color}`}>
                  {connectionStatus.text}
                </p>
                {state.endpoint && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">
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
              className="rounded-md h-8 text-[13px]"
            >
              {isLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("settings.serviceSettings.testConnection")}
            </Button>
          </div>

          {/* 本地服务控制（仅在本地模式下显示） */}
          {selectedMode === "local" && (
            <div className="space-y-3 rounded-lg border border-border/50 p-3.5 bg-surface-1/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("settings.serviceSettings.backendService")}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {backendStatus.text}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startBackend}
                  disabled={!backendStatus.canStart || isLoading}
                  className="rounded-md h-7 text-xs px-2.5"
                >
                  <Play className="mr-1 h-3 w-3" />
                  {t("settings.serviceSettings.startService")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopBackend}
                  disabled={!backendStatus.canStop || isLoading}
                  className="rounded-md h-7 text-xs px-2.5"
                >
                  <Square className="mr-1 h-3 w-3" />
                  {t("settings.serviceSettings.stopService")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={restartBackend}
                  disabled={!backendStatus.canStop || isLoading}
                  className="rounded-md h-7 text-xs px-2.5"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {t("settings.serviceSettings.restartService")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 版本和更新设置（仅在本地模式下显示） */}
      {selectedMode === "local" && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t("settings.serviceSettings.versionTitle")}</CardTitle>
            <CardDescription className="text-[13px]">{t("settings.serviceSettings.versionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 版本信息 */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-1/50 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background border border-border/50">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {versionInfo?.installed
                      ? t("settings.serviceSettings.installedVersion", { version: versionInfo.installed })
                      : t("settings.serviceSettings.notInstalled")}
                  </p>
                  {versionInfo?.latest && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {t("settings.serviceSettings.latestVersion", { version: versionInfo.latest })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate || isUpdating}
                  className="rounded-md h-8 text-[13px]"
                >
                  {isCheckingUpdate ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("settings.serviceSettings.checkUpdate")}
                </Button>
                {versionInfo?.updateAvailable && (
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="rounded-md h-8 text-[13px]"
                  >
                    {isUpdating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {t("settings.serviceSettings.updateNow")}
                  </Button>
                )}
              </div>
            </div>

            {/* 下载进度条 */}
            {isUpdating && downloadProgress && (
              <div className="rounded-lg border border-border/50 bg-surface-1/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">
                    {t("settings.serviceSettings.downloading")}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {formatBytes(downloadProgress.downloaded)}{downloadProgress.total ? ` / ${formatBytes(downloadProgress.total)}` : ""}
                  </span>
                </div>
                <Progress value={downloadProgress.percentage} className="h-1.5" />
                <div className="text-right text-xs text-muted-foreground/70">
                  {Math.round(downloadProgress.percentage)}%
                </div>
              </div>
            )}

            {/* 自动更新设置 */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3.5 bg-surface-1/50">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t("settings.serviceSettings.autoUpdate")}</p>
                <p className="text-xs text-muted-foreground/70">
                  {t("settings.serviceSettings.autoUpdateDescription")}
                </p>
              </div>
              <Switch
                checked={appSettings?.autoUpdate ?? false}
                onCheckedChange={handleAutoUpdateChange}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
