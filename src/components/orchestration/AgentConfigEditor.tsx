import { useState, useEffect, useMemo } from "react";
import {
  Bot,
  Brain,
  Search,
  BookOpen,
  Palette,
  FileText,
  Eye,
  Settings2,
  Loader2,
  ChevronDown,
  Check,
} from "lucide-react";
import { useProviders, useOpencode, useModelsRegistry } from "@/hooks";
import { getToolsSimple } from "@/services/opencode/tools";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import type {
  AgentConfig,
  AgentCategory,
  AgentCost,
  PermissionValue,
  ReasoningEffort,
  TextVerbosity,
} from "@/types/orchestration";

const ICON_MAP = {
  Bot,
  Brain,
  Search,
  BookOpen,
  Palette,
  FileText,
  Eye,
  Settings2,
};

const PRESET_COLORS = [
  { value: "#3B82F6", label: "蓝色" },
  { value: "#9333EA", label: "紫色" },
  { value: "#0EA5E9", label: "青色" },
  { value: "#10B981", label: "绿色" },
  { value: "#F59E0B", label: "琥珀" },
  { value: "#EF4444", label: "红色" },
  { value: "#6366F1", label: "靛蓝" },
  { value: "#EC4899", label: "粉色" },
];

interface AgentConfigEditorProps {
  config: AgentConfig;
  onChange: (config: Partial<AgentConfig>) => void;
  showBasicInfo?: boolean;
}

export function AgentConfigEditor({
  config,
  onChange,
  showBasicInfo = true,
}: AgentConfigEditorProps) {
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  const { isConnected } = useOpencode();
  const { providers, isLoading: isLoadingModels } = useProviders();
  const { getCachedModelDefaults } = useModelsRegistry();

  const currentModelValue = useMemo(() => {
    if (!config.model.modelId) return "";
    if (config.model.modelId.includes("/")) {
      return config.model.modelId;
    }
    const provider = config.model.provider || "";
    return provider ? `${provider}/${config.model.modelId}` : config.model.modelId;
  }, [config.model.modelId, config.model.provider]);

  const currentModelDisplay = useMemo(() => {
    if (!currentModelValue) return "选择模型...";
    for (const provider of providers) {
      const model = provider.models.find(
        (m) => `${provider.id}/${m.id}` === currentModelValue
      );
      if (model) {
        return `${provider.name} / ${model.name}`;
      }
    }
    return currentModelValue;
  }, [currentModelValue, providers]);

  const currentModelCapabilities = useMemo(() => {
    if (!currentModelValue) return null;
    return getCachedModelDefaults(currentModelValue) ?? null;
  }, [currentModelValue, getCachedModelDefaults]);

  useEffect(() => {
    if (!isConnected) return;

    const loadTools = async () => {
      setIsLoadingTools(true);
      try {
        const tools = await getToolsSimple();
        setToolIds(tools.map((t) => t.id));
      } catch (e) {
        console.error("加载工具列表失败:", e);
      } finally {
        setIsLoadingTools(false);
      }
    };
    loadTools();
  }, [isConnected]);

  const updateField = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    onChange({ [key]: value });
  };

  const updateParameterField = <K extends keyof AgentConfig["parameters"]>(
    key: K,
    value: AgentConfig["parameters"][K]
  ) => {
    onChange({ parameters: { ...config.parameters, [key]: value } });
  };

  const updatePermissionField = <K extends keyof AgentConfig["permissions"]>(
    key: K,
    value: AgentConfig["permissions"][K]
  ) => {
    onChange({ permissions: { ...config.permissions, [key]: value } });
  };

  const updatePromptField = <K extends keyof AgentConfig["prompt"]>(
    key: K,
    value: AgentConfig["prompt"][K]
  ) => {
    onChange({ prompt: { ...config.prompt, [key]: value } });
  };

  const updateMetadataField = <K extends keyof AgentConfig["metadata"]>(
    key: K,
    value: AgentConfig["metadata"][K]
  ) => {
    onChange({ metadata: { ...config.metadata, [key]: value } });
  };

  const updateToolsField = <K extends keyof AgentConfig["tools"]>(
    key: K,
    value: AgentConfig["tools"][K]
  ) => {
    onChange({ tools: { ...config.tools, [key]: value } });
  };

  const handleModelSelect = (value: string, providerId: string) => {
    setModelPopoverOpen(false);
    const capabilities = getCachedModelDefaults(value);

    const newModel = {
      ...config.model,
      modelId: value,
      provider: providerId,
    };

    const newParams = { ...config.parameters };
    if (capabilities) {
      if (capabilities.supportsTemperature === false) {
        newParams.temperature = undefined;
      } else if (capabilities.defaultTemperature !== null) {
        newParams.temperature = capabilities.defaultTemperature;
      } else {
        newParams.temperature = 0.7;
      }

      if (capabilities.defaultTopP !== null) {
        newParams.topP = capabilities.defaultTopP;
      } else {
        newParams.topP = 1.0;
      }

      if (capabilities.defaultMaxTokens !== null) {
        newParams.maxTokens = capabilities.defaultMaxTokens;
      } else if (capabilities.maxOutputTokens > 0) {
        newParams.maxTokens = Math.min(16384, capabilities.maxOutputTokens);
      }

      newParams.thinking = {
        enabled: capabilities.supportsReasoning,
        budgetTokens: capabilities.supportsReasoning ? 10000 : undefined,
      };
    }

    onChange({
      model: newModel,
      parameters: newParams,
    });
  };

  return (
    <Tabs defaultValue={showBasicInfo ? "basic" : "model"} className="w-full">
      <TabsList className="grid w-full grid-cols-5 h-8 p-0.5 bg-muted/50">
        {showBasicInfo && (
          <TabsTrigger value="basic" className="text-xs">
            基本
          </TabsTrigger>
        )}
        <TabsTrigger value="model" className="text-xs">
          模型
        </TabsTrigger>
        <TabsTrigger value="params" className="text-xs">
          参数
        </TabsTrigger>
        <TabsTrigger value="perms" className="text-xs">
          权限
        </TabsTrigger>
        <TabsTrigger value="prompt" className="text-xs">
          提示词
        </TabsTrigger>
      </TabsList>

      {showBasicInfo && (
        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">名称</Label>
            <Input
              value={config.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Agent 名称"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">描述</Label>
            <Textarea
              value={config.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Agent 描述"
              className="min-h-[80px] text-sm resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">图标</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(ICON_MAP).map(([iconName, IconComponent]) => (
                <button
                  key={iconName}
                  onClick={() => updateField("icon", iconName)}
                  className={cn(
                    "h-10 flex items-center justify-center rounded border transition-colors duration-150",
                    config.icon === iconName
                      ? "border-border bg-accent"
                      : "border-border/60 hover:bg-accent/50"
                  )}
                >
                  <IconComponent
                    className="w-4 h-4"
                    style={{ color: config.color || "#3B82F6" }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">颜色</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateField("color", value)}
                  className={cn(
                    "h-10 flex items-center justify-center rounded border transition-colors duration-150",
                    config.color === value
                      ? "border-border ring-2 ring-offset-2 ring-offset-background"
                      : "border-border/60"
                  )}
                  style={{
                    backgroundColor: `${value}20`,
                    borderColor: config.color === value ? value : undefined,
                  }}
                  title={label}
                >
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: value }} />
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">类别</Label>
            <Select
              value={config.metadata.category}
              onValueChange={(value: AgentCategory) => updateMetadataField("category", value)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exploration">探索</SelectItem>
                <SelectItem value="specialist">专家</SelectItem>
                <SelectItem value="advisor">顾问</SelectItem>
                <SelectItem value="utility">工具</SelectItem>
                <SelectItem value="orchestrator">编排器</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">成本等级</Label>
            <Select
              value={config.metadata.cost}
              onValueChange={(value: AgentCost) => updateMetadataField("cost", value)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">免费</SelectItem>
                <SelectItem value="cheap">低成本</SelectItem>
                <SelectItem value="medium">中等成本</SelectItem>
                <SelectItem value="expensive">高成本</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      )}

      <TabsContent value="model" className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">模型</Label>
          {isLoadingModels ? (
            <div className="flex items-center gap-2 h-8 px-3 text-sm text-muted-foreground border border-input rounded-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : (
            <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-between w-full h-8 px-3",
                    "text-sm rounded-sm border border-input bg-background",
                    "hover:bg-accent/50 transition-colors",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  )}
                >
                  <span
                    className={cn("truncate", !currentModelValue && "text-muted-foreground")}
                  >
                    {currentModelDisplay}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索模型..." />
                  <CommandList>
                    <CommandEmpty>未找到模型</CommandEmpty>
                    {providers.map((provider) => (
                      <CommandGroup key={provider.id} heading={provider.name}>
                        {provider.models.map((model) => {
                          const value = `${provider.id}/${model.id}`;
                          const isSelected = currentModelValue === value;
                          return (
                            <CommandItem
                              key={value}
                              value={value}
                              onSelect={() => handleModelSelect(value, provider.id)}
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-center h-4 w-4 shrink-0 mr-2",
                                  "rounded-sm border",
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-input bg-transparent"
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span className="truncate">{model.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          <p className="text-[10px] text-muted-foreground/60">
            当前:{" "}
            <code className="bg-muted px-1 rounded">{currentModelValue || "未选择"}</code>
          </p>
        </div>
      </TabsContent>

      <TabsContent value="params" className="space-y-4 mt-4">
        {currentModelCapabilities && (
          <div className="p-2 rounded-md bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
              <span>上下文窗口</span>
              <span className="font-mono">
                {currentModelCapabilities.contextWindow.toLocaleString()} tokens
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
              <span>最大输出</span>
              <span className="font-mono">
                {currentModelCapabilities.maxOutputTokens.toLocaleString()} tokens
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              className={cn(
                "text-xs",
                currentModelCapabilities?.supportsTemperature === false
                  ? "text-muted-foreground/40"
                  : "text-muted-foreground/70"
              )}
            >
              Temperature
              {currentModelCapabilities?.supportsTemperature === false && (
                <span className="ml-1.5 text-[10px]">(不支持)</span>
              )}
            </Label>
            <span
              className={cn(
                "text-xs font-mono",
                currentModelCapabilities?.supportsTemperature === false
                  ? "text-muted-foreground/40"
                  : "text-muted-foreground/70"
              )}
            >
              {config.parameters.temperature?.toFixed(1) ?? "0.3"}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.parameters.temperature ?? 0.3}
            onChange={(e) => updateParameterField("temperature", parseFloat(e.target.value))}
            disabled={currentModelCapabilities?.supportsTemperature === false}
            className={cn(
              "w-full h-1.5 rounded-full appearance-none",
              currentModelCapabilities?.supportsTemperature === false
                ? "bg-muted/30 cursor-not-allowed opacity-50"
                : "bg-muted/50 cursor-pointer",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-3",
              "[&::-webkit-slider-thumb]:h-3",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-foreground"
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground/70">Top P</Label>
            <span className="text-xs text-muted-foreground/70 font-mono">
              {config.parameters.topP?.toFixed(1) ?? "—"}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.parameters.topP ?? 1}
            onChange={(e) => updateParameterField("topP", parseFloat(e.target.value))}
            className={cn(
              "w-full h-1.5 rounded-full appearance-none cursor-pointer bg-muted/50",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-3",
              "[&::-webkit-slider-thumb]:h-3",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-foreground"
            )}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground/70">Max Tokens</Label>
            {currentModelCapabilities && currentModelCapabilities.maxOutputTokens > 0 && (
              <span className="text-[10px] text-muted-foreground/50">
                上限 {currentModelCapabilities.maxOutputTokens.toLocaleString()}
              </span>
            )}
          </div>
          <Input
            type="number"
            value={config.parameters.maxTokens ?? ""}
            onChange={(e) =>
              updateParameterField(
                "maxTokens",
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
            placeholder={
              currentModelCapabilities?.maxOutputTokens
                ? `如 ${Math.min(4096, currentModelCapabilities.maxOutputTokens)}`
                : "如 4096"
            }
            max={currentModelCapabilities?.maxOutputTokens || undefined}
            className="h-8 text-sm font-mono"
          />
        </div>

        <Separator className="bg-border/50" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs text-muted-foreground/70">扩展思考</Label>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Claude 模型专用</p>
            </div>
            <Switch
              checked={config.parameters.thinking?.enabled ?? false}
              onCheckedChange={(checked) =>
                updateParameterField("thinking", {
                  enabled: checked,
                  budgetTokens: config.parameters.thinking?.budgetTokens,
                })
              }
            />
          </div>

          {config.parameters.thinking?.enabled && (
            <div className="space-y-2 pl-4 border-l-2 border-border/60">
              <Label className="text-xs text-muted-foreground/70">预算 Tokens</Label>
              <Input
                type="number"
                value={config.parameters.thinking?.budgetTokens ?? ""}
                onChange={(e) =>
                  updateParameterField("thinking", {
                    enabled: true,
                    budgetTokens: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="如 1000"
                className="h-8 text-sm font-mono"
              />
            </div>
          )}
        </div>

        <Separator className="bg-border/50" />

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground/70">GPT 模型专用</p>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">推理努力程度</Label>
            <Select
              value={config.parameters.reasoningEffort ?? "medium"}
              onValueChange={(value: ReasoningEffort) =>
                updateParameterField("reasoningEffort", value)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="high">高</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">输出详细程度</Label>
            <Select
              value={config.parameters.textVerbosity ?? "medium"}
              onValueChange={(value: TextVerbosity) =>
                updateParameterField("textVerbosity", value)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">低</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="high">高</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="perms" className="space-y-4 mt-4">
        {isLoadingTools ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">加载工具列表...</span>
          </div>
        ) : toolIds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground/60 text-sm">无可用工具</div>
        ) : (
          <div className="space-y-3">
            {toolIds.map((toolId) => {
              const permValue = config.permissions[toolId];
              const currentValue = typeof permValue === "string" ? permValue : "ask";
              return (
                <div key={toolId} className="flex items-center justify-between gap-4">
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex-1 min-w-0 truncate">
                    {toolId}
                  </code>
                  <Select
                    value={currentValue}
                    onValueChange={(value: PermissionValue) =>
                      updatePermissionField(toolId, value)
                    }
                  >
                    <SelectTrigger className="w-24 h-8 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ask">
                        <span className="text-yellow-600 dark:text-yellow-400">询问</span>
                      </SelectItem>
                      <SelectItem value="allow">
                        <span className="text-green-600 dark:text-green-400">允许</span>
                      </SelectItem>
                      <SelectItem value="deny">
                        <span className="text-red-600 dark:text-red-400">拒绝</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}

        <Separator className="bg-border/50" />

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground/70">工具访问模式</Label>
            <Select
              value={config.tools.mode}
              onValueChange={(value: "whitelist" | "blacklist" | "all") =>
                updateToolsField("mode", value)
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部允许</SelectItem>
                <SelectItem value="whitelist">白名单模式</SelectItem>
                <SelectItem value="blacklist">黑名单模式</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/60">
              白名单：仅允许列表中的工具；黑名单：禁用列表中的工具
            </p>
          </div>

          {config.tools.mode !== "all" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground/70">
                {config.tools.mode === "whitelist" ? "允许的工具" : "禁用的工具"}
              </Label>
              <div className="border border-input rounded-sm p-2 max-h-[150px] overflow-y-auto space-y-1">
                {toolIds.map((toolId) => {
                  const isSelected = config.tools.list.includes(toolId);
                  return (
                    <button
                      key={toolId}
                      type="button"
                      onClick={() => {
                        const newList = isSelected
                          ? config.tools.list.filter((t) => t !== toolId)
                          : [...config.tools.list, toolId];
                        updateToolsField("list", newList);
                      }}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm",
                        "hover:bg-accent transition-colors",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center h-4 w-4 shrink-0",
                          "rounded-sm border",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input bg-transparent"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <code className="text-xs">{toolId}</code>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/60">
                已选择 {config.tools.list.length} 个工具
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="prompt" className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">系统提示词</Label>
          <Textarea
            value={config.prompt.system || ""}
            onChange={(e) => updatePromptField("system", e.target.value || undefined)}
            placeholder="覆盖默认系统提示词..."
            className="min-h-[120px] text-sm font-mono resize-none"
          />
          <p className="text-[10px] text-muted-foreground/60">完全覆盖系统提示词</p>
        </div>

        <Separator className="bg-border/50" />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground/70">追加提示词</Label>
          <Textarea
            value={config.prompt.append || ""}
            onChange={(e) => updatePromptField("append", e.target.value || undefined)}
            placeholder="追加到系统提示词末尾..."
            className="min-h-[120px] text-sm font-mono resize-none"
          />
          <p className="text-[10px] text-muted-foreground/60">追加到默认提示词之后</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
