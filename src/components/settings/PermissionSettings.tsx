import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Check,
  X,
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Info,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOpencode } from "@/hooks";
import { getToolsSimple } from "@/services/opencode/tools";
import { settings as tauriSettings, fs as tauriFs, opencode as tauriOpencode } from "@/services/tauri";
import {
  type PermissionActionType,
  type PermissionConfig,
  KNOWN_PERMISSION_TYPES,
  PERMISSION_GROUPS,
  getPermissionDisplayName,
  getPermissionDescription,
  getActionDisplayName,
  getDefaultPermissionConfig,
  supportsSubRules,
} from "@/types/permission";

interface PermissionRule {
  type: string;
  action: PermissionActionType;
  subRules?: Array<{ pattern: string; action: PermissionActionType }>;
  /** 是否继承自默认权限（未在配置中显式设置） */
  isInherited?: boolean;
}

interface AddRuleDialogState {
  isOpen: boolean;
  type: string;
  action: PermissionActionType;
  isSubmitting: boolean;
}

const initialAddDialogState: AddRuleDialogState = {
  isOpen: false,
  type: "",
  action: "ask",
  isSubmitting: false,
};

interface SubRuleDialogState {
  isOpen: boolean;
  parentType: string;
  pattern: string;
  action: PermissionActionType;
  isSubmitting: boolean;
}

const initialSubRuleDialogState: SubRuleDialogState = {
  isOpen: false,
  parentType: "",
  pattern: "",
  action: "ask",
  isSubmitting: false,
};

export function PermissionSettings() {
  const { t } = useTranslation();
  const { client, isConnected, state } = useOpencode();

  const connectionStatus = state.connectionState.status;
  const backendStatus = state.backendStatus.type;

  const isInitializing =
    backendStatus === "uninitialized" ||
    backendStatus === "downloading" ||
    backendStatus === "starting" ||
    connectionStatus === "connecting";

  const hasError =
    (connectionStatus === "error" || backendStatus === "error") &&
    !isInitializing;
  const errorMessage =
    connectionStatus === "error"
      ? state.connectionState.message
      : backendStatus === "error"
        ? (state.backendStatus as { message: string }).message
        : null;

  const [permissionConfig, setPermissionConfig] = useState<PermissionConfig>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [addDialog, setAddDialog] = useState<AddRuleDialogState>(initialAddDialogState);
  const [subRuleDialog, setSubRuleDialog] = useState<SubRuleDialogState>(initialSubRuleDialogState);
  // 从 API 获取的所有工具列表
  const [allToolIds, setAllToolIds] = useState<string[]>([]);

  const permissionRules = useMemo((): PermissionRule[] => {
    const rules: PermissionRule[] = [];
    const configuredTypes = new Set<string>();
    
    // 1. 从配置中生成已配置的规则
    for (const [type, value] of Object.entries(permissionConfig)) {
      configuredTypes.add(type);
      if (typeof value === "string") {
        rules.push({ type, action: value, isInherited: false });
      } else if (typeof value === "object" && value !== null) {
        const defaultAction = (value["*"] || "ask") as PermissionActionType;
        const subRules = Object.entries(value)
          .filter(([k]) => k !== "*")
          .map(([pattern, action]) => ({ 
            pattern, 
            action: action as PermissionActionType 
          }));
        rules.push({
          type,
          action: defaultAction,
          subRules: subRules.length > 0 ? subRules : undefined,
          isInherited: false,
        });
      }
    }
    
    // 2. 添加 API 工具列表中未配置的工具（继承默认权限）
    // OpenCode 默认权限是 "allow"（参见 opencode/packages/opencode/src/agent/agent.ts）
    const defaultAction = (permissionConfig["*"] as PermissionActionType) || "allow";
    for (const toolId of allToolIds) {
      if (!configuredTypes.has(toolId) && toolId !== "*") {
        rules.push({
          type: toolId,
          action: defaultAction,
          isInherited: true,
        });
      }
    }
    
    // 排序：默认规则在最前，其他按字母顺序
    rules.sort((a, b) => {
      if (a.type === "*") return -1;
      if (b.type === "*") return 1;
      return a.type.localeCompare(b.type);
    });
    
    return rules;
  }, [permissionConfig, allToolIds]);

  const availableTypes = useMemo(() => {
    const usedTypes = new Set(permissionRules.map((r) => r.type));
    // 优先使用从 API 获取的工具列表，否则使用已知权限类型列表
    const baseTypes = allToolIds.length > 0 ? allToolIds : [...KNOWN_PERMISSION_TYPES];
    return baseTypes.filter((toolId) => !usedTypes.has(toolId));
  }, [permissionRules, allToolIds]);

  const loadPermissionConfig = useCallback(async () => {
    if (!client || !isConnected) return;

    setIsLoading(true);
    try {
      const [configResult, tools] = await Promise.all([
        client.config.get(),
        getToolsSimple(),
      ]);
      
      if (configResult.data) {
        const config = configResult.data as unknown as { permission?: PermissionConfig };
        setPermissionConfig(config.permission || {});
      }
      
      if (tools.length > 0) {
        setAllToolIds(tools.map(tool => tool.id));
      }
    } catch (error) {
      console.error("加载权限配置失败:", error);
      toast.error(t("settings.permissionSettings.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [client, isConnected, t]);

  const savePermissionConfig = useCallback(async (newConfig: PermissionConfig) => {
    if (!client) return false;

    try {
      // 直接读写 opencode.json 文件，绕过 SDK 的 config.update API
      // 因为 SDK 会写入 config.json，而 OpenCode 启动时只加载 opencode.json
      const configPath = await tauriSettings.getOpencodeConfigPath();
      
      let existingConfig: Record<string, unknown> = {};
      try {
        const content = await tauriFs.readFileContent(configPath);
        existingConfig = JSON.parse(content);
      } catch {
        // 文件不存在或解析失败
      }
      
      const mergedConfig = {
        ...existingConfig,
        permission: newConfig,
      };
      
      await tauriFs.writeFileContent(configPath, JSON.stringify(mergedConfig, null, 2));
      setPermissionConfig(newConfig);
      
      // 先清理 SDK 缓存
      await client.instance.dispose();
      
      // 重启后端服务以使权限配置生效
      // 权限配置在 opencode 启动时加载，修改后需要重启才能生效
      toast.info(t("settings.permissionSettings.restartingService"));
      try {
        await tauriOpencode.restart();
        toast.success(t("settings.permissionSettings.restartSuccess"));
      } catch (restartError) {
        console.error("重启服务失败:", restartError);
        toast.warning(t("settings.permissionSettings.restartFailed"));
      }
      
      return true;
    } catch (error) {
      console.error("保存权限配置失败:", error);
      toast.error(t("settings.permissionSettings.saveFailed"));
      return false;
    }
  }, [client, t]);

  useEffect(() => {
    loadPermissionConfig();
  }, [loadPermissionConfig]);

  const handleRefresh = async () => {
    if (!client || !isConnected) return;

    setIsLoading(true);
    try {
      await client.instance.dispose();
      await loadPermissionConfig();
      toast.success(t("settings.permissionSettings.refreshSuccess"));
    } catch (error) {
      console.error("刷新权限配置失败:", error);
      toast.error(t("settings.permissionSettings.refreshFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionChange = async (type: string, newAction: PermissionActionType) => {
    const currentValue = permissionConfig[type];
    let newConfig: PermissionConfig;

    if (typeof currentValue === "object" && currentValue !== null) {
      newConfig = {
        ...permissionConfig,
        [type]: {
          ...currentValue,
          "*": newAction,
        },
      };
    } else {
      newConfig = {
        ...permissionConfig,
        [type]: newAction,
      };
    }

    const success = await savePermissionConfig(newConfig);
    if (success) {
      toast.success(t("settings.permissionSettings.updateSuccess"));
    }
  };

  const handleAddRule = async () => {
    if (!addDialog.type) return;

    setAddDialog((prev) => ({ ...prev, isSubmitting: true }));
    
    const newConfig: PermissionConfig = {
      ...permissionConfig,
      [addDialog.type]: addDialog.action,
    };

    const success = await savePermissionConfig(newConfig);
    if (success) {
      toast.success(t("settings.permissionSettings.addSuccess"));
      setAddDialog(initialAddDialogState);
    } else {
      setAddDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleAddSubRule = async () => {
    if (!subRuleDialog.parentType || !subRuleDialog.pattern.trim()) return;

    setSubRuleDialog((prev) => ({ ...prev, isSubmitting: true }));
    
    const currentValue = permissionConfig[subRuleDialog.parentType];
    let baseObj: Record<string, PermissionActionType>;
    
    if (typeof currentValue === "object" && currentValue !== null) {
      baseObj = { ...currentValue } as Record<string, PermissionActionType>;
    } else {
      baseObj = { "*": (currentValue as PermissionActionType) || "ask" };
    }
    
    baseObj[subRuleDialog.pattern.trim()] = subRuleDialog.action;
    
    const newConfig: PermissionConfig = {
      ...permissionConfig,
      [subRuleDialog.parentType]: baseObj,
    };

    const success = await savePermissionConfig(newConfig);
    if (success) {
      toast.success(t("settings.permissionSettings.addSubRuleSuccess"));
      setSubRuleDialog(initialSubRuleDialogState);
      setExpandedRules((prev) => new Set([...prev, subRuleDialog.parentType]));
    } else {
      setSubRuleDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleDeleteSubRule = async (parentType: string, pattern: string) => {
    const currentValue = permissionConfig[parentType];
    if (typeof currentValue !== "object" || currentValue === null) return;

    const newObj = { ...currentValue } as Record<string, PermissionActionType>;
    delete newObj[pattern];

    const remainingSubRules = Object.keys(newObj).filter((k) => k !== "*");
    
    let newConfig: PermissionConfig;
    if (remainingSubRules.length === 0) {
      newConfig = {
        ...permissionConfig,
        [parentType]: newObj["*"] || "ask",
      };
    } else {
      newConfig = {
        ...permissionConfig,
        [parentType]: newObj,
      };
    }

    const success = await savePermissionConfig(newConfig);
    if (success) {
      toast.success(t("settings.permissionSettings.deleteSubRuleSuccess"));
    }
  };

  const handleResetToDefault = async () => {
    const defaultConfig = getDefaultPermissionConfig();
    const success = await savePermissionConfig(defaultConfig);
    if (success) {
      toast.success(t("settings.permissionSettings.resetSuccess"));
    }
  };

  const toggleExpanded = (type: string) => {
    setExpandedRules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const renderActionBadge = (action: PermissionActionType) => {
    const colorClass = {
      allow: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      ask: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
      deny: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    }[action];

    return (
      <span className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        colorClass
      )}>
        {getActionDisplayName(action, t)}
      </span>
    );
  };

  const isContentLoading = isInitializing || isLoading;

  const renderContent = () => {
    if (isContentLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {isInitializing 
              ? t("settings.permissionSettings.initializing")
              : t("common.loading")
            }
          </p>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-6 w-6 text-destructive mb-3" />
          <p className="text-sm text-destructive mb-4">
            {errorMessage || t("settings.permissionSettings.connectionError")}
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.retry")}
          </Button>
        </div>
      );
    }

    if (permissionRules.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.permissionSettings.noRules")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
          >
            {t("settings.permissionSettings.useDefault")}
          </Button>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border/60">
        {permissionRules.map((rule) => {
          const hasSubRules = rule.subRules && rule.subRules.length > 0;
          const isExpanded = expandedRules.has(rule.type);
          const description = getPermissionDescription(rule.type, t);

          return (
            <div key={rule.type} className="group">
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                {hasSubRules ? (
                  <button
                    onClick={() => toggleExpanded(rule.type)}
                    className="p-0.5 hover:bg-accent rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ) : (
                  <div className="w-5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium text-sm",
                      rule.type === "*" && "text-primary",
                      rule.isInherited && "text-muted-foreground"
                    )}>
                      {getPermissionDisplayName(rule.type, t)}
                    </span>
                    {rule.type !== "*" && (
                      <code className={cn(
                        "text-xs bg-muted px-1.5 py-0.5 rounded",
                        rule.isInherited ? "text-muted-foreground/60" : "text-muted-foreground"
                      )}>
                        {rule.type}
                      </code>
                    )}
                    {rule.isInherited && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground/60 italic cursor-help">
                            ({t("settings.permissionSettings.inherited")})
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">{t("settings.permissionSettings.inheritedTooltip")}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {description && !rule.isInherited && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">{description}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <Select
                    value={rule.action}
                    onValueChange={(value) => handleActionChange(rule.type, value as PermissionActionType)}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">
                        <span className="text-green-600 dark:text-green-400">
                          {getActionDisplayName("allow", t)}
                        </span>
                      </SelectItem>
                      <SelectItem value="ask">
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {getActionDisplayName("ask", t)}
                        </span>
                      </SelectItem>
                      <SelectItem value="deny">
                        <span className="text-red-600 dark:text-red-400">
                          {getActionDisplayName("deny", t)}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* 子规则按钮占位容器 - 保持对齐 */}
                  <div className="w-7 flex items-center justify-center">
                    {rule.type !== "*" && supportsSubRules(rule.type) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSubRuleDialog({
                              isOpen: true,
                              parentType: rule.type,
                              pattern: "",
                              action: "ask",
                              isSubmitting: false,
                            })}
                            className="text-muted-foreground/60 hover:text-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("settings.permissionSettings.addSubRule")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              {hasSubRules && isExpanded && (
                <div className="border-t border-border/40 bg-muted/30">
                  {rule.subRules!.map((subRule) => (
                    <div
                      key={subRule.pattern}
                      className="flex items-center gap-3 px-4 py-2.5 pl-12 hover:bg-accent/30 transition-colors group/sub"
                    >
                      <code className="flex-1 text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded border border-border/60">
                        {subRule.pattern}
                      </code>
                      
                      {renderActionBadge(subRule.action)}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteSubRule(rule.type, subRule.pattern)}
                        className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-destructive hover:text-destructive h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Shield className="h-4.5 w-4.5 text-primary" />
              {t("settings.permissionSettings.title")}
            </h2>
            <p className="text-[13px] text-muted-foreground/80">
              {t("settings.permissionSettings.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              disabled={isContentLoading || hasError}
            >
              {t("settings.permissionSettings.resetToDefault")}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={isContentLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isContentLoading && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              onClick={() => setAddDialog({ ...initialAddDialogState, isOpen: true })}
              disabled={isContentLoading || hasError || availableTypes.length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("settings.permissionSettings.addRule")}
            </Button>
          </div>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-0 min-h-[200px]">
            {renderContent()}
          </CardContent>
        </Card>

        {!isContentLoading && !hasError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/40">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t("settings.permissionSettings.hint1")}</p>
              <p>{t("settings.permissionSettings.hint2")}</p>
            </div>
          </div>
        )}

        <Dialog open={addDialog.isOpen} onOpenChange={(open) => !addDialog.isSubmitting && setAddDialog({ ...initialAddDialogState, isOpen: open })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.permissionSettings.addRuleTitle")}</DialogTitle>
              <DialogDescription>
                {t("settings.permissionSettings.addRuleDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("settings.permissionSettings.permissionType")}</Label>
                <Select
                  value={addDialog.type}
                  onValueChange={(value) => setAddDialog((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("settings.permissionSettings.selectType")} />
                  </SelectTrigger>
                  <SelectContent>
                    {!permissionConfig["*"] && (
                      <SelectItem value="*">
                        {getPermissionDisplayName("*", t)}
                      </SelectItem>
                    )}
                    {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
                      <div key={groupKey}>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          {t(group.labelKey)}
                        </div>
                        {group.permissions
                          .filter((p) => availableTypes.includes(p))
                          .map((permission) => (
                            <SelectItem key={permission} value={permission}>
                              {getPermissionDisplayName(permission, t)}
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("settings.permissionSettings.action")}</Label>
                <Select
                  value={addDialog.action}
                  onValueChange={(value) => setAddDialog((prev) => ({ ...prev, action: value as PermissionActionType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span>{getActionDisplayName("allow", t)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ask">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>{getActionDisplayName("ask", t)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="deny">
                      <div className="flex items-center gap-2">
                        <X className="h-3.5 w-3.5 text-red-500" />
                        <span>{getActionDisplayName("deny", t)}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddDialog(initialAddDialogState)}
                disabled={addDialog.isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleAddRule}
                disabled={!addDialog.type || addDialog.isSubmitting}
              >
                {addDialog.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("common.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={subRuleDialog.isOpen} onOpenChange={(open) => !subRuleDialog.isSubmitting && setSubRuleDialog({ ...initialSubRuleDialogState, isOpen: open })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.permissionSettings.addSubRuleTitle")}</DialogTitle>
              <DialogDescription>
                {t("settings.permissionSettings.addSubRuleDescription", { type: getPermissionDisplayName(subRuleDialog.parentType, t) })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("settings.permissionSettings.pattern")}</Label>
                <Input
                  value={subRuleDialog.pattern}
                  onChange={(e) => setSubRuleDialog((prev) => ({ ...prev, pattern: e.target.value }))}
                  placeholder={subRuleDialog.parentType === "bash" ? "git *" : "*.ts"}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.permissionSettings.patternHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("settings.permissionSettings.action")}</Label>
                <Select
                  value={subRuleDialog.action}
                  onValueChange={(value) => setSubRuleDialog((prev) => ({ ...prev, action: value as PermissionActionType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        <span>{getActionDisplayName("allow", t)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ask">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-3.5 w-3.5 text-yellow-500" />
                        <span>{getActionDisplayName("ask", t)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="deny">
                      <div className="flex items-center gap-2">
                        <X className="h-3.5 w-3.5 text-red-500" />
                        <span>{getActionDisplayName("deny", t)}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSubRuleDialog(initialSubRuleDialogState)}
                disabled={subRuleDialog.isSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleAddSubRule}
                disabled={!subRuleDialog.pattern.trim() || subRuleDialog.isSubmitting}
              >
                {subRuleDialog.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("common.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
