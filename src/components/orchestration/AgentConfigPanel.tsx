/**
 * Agent 配置编辑面板
 * 
 * 右侧抽屉式配置面板，支持编辑所有 AgentDefinition 属性
 * 遵循 Zed 风格极简设计
 */

import { useState, useEffect, useMemo } from "react";
import { X, Trash2, Save, Bot, Brain, Search, BookOpen, Palette, FileText, Eye, Settings2, Loader2, ChevronDown, Check } from "lucide-react";
import { useProviders, useOpencode, useModelsRegistry } from "@/hooks";
import { getToolsSimple } from "@/services/opencode/tools";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentDefinition, AgentCategory, AgentCost, AgentMode, PermissionValue, ReasoningEffort, TextVerbosity } from "@/types/agent";

// 图标映射
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

// 预设颜色
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

interface AgentConfigPanelProps {
  agent: AgentDefinition | null;
  onSave: (agent: AgentDefinition) => void;
  onDelete: (agentId: string) => void;
  onClose: () => void;
}

export function AgentConfigPanel({ agent, onSave, onDelete, onClose }: AgentConfigPanelProps) {
  const [editedAgent, setEditedAgent] = useState<AgentDefinition | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  const { isConnected } = useOpencode();
  const { providers, isLoading: isLoadingModels } = useProviders();
  const { getCachedModelDefaults } = useModelsRegistry();

  // 构建模型选择的当前值
  const currentModelValue = useMemo(() => {
    if (!editedAgent?.model.modelId) return "";
    // 如果 modelId 已经包含 provider，直接返回
    if (editedAgent.model.modelId.includes("/")) {
      return editedAgent.model.modelId;
    }
    // 否则拼接 provider 和 modelId
    const provider = editedAgent.model.provider || "";
    return provider ? `${provider}/${editedAgent.model.modelId}` : editedAgent.model.modelId;
  }, [editedAgent?.model.modelId, editedAgent?.model.provider]);

  // 获取当前模型的显示名称
  const currentModelDisplay = useMemo(() => {
    if (!currentModelValue) return "选择模型...";
    for (const provider of providers) {
      const model = provider.models.find(m => `${provider.id}/${m.id}` === currentModelValue);
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

  // 当传入的 agent 变化时更新本地状态
  useEffect(() => {
    setEditedAgent(agent ? { ...agent } : null);
  }, [agent]);

  useEffect(() => {
    if (!isConnected) return;
    
    const loadTools = async () => {
      setIsLoadingTools(true);
      try {
        const tools = await getToolsSimple();
        setToolIds(tools.map(t => t.id));
      } catch (e) {
        console.error("加载工具列表失败:", e);
      } finally {
        setIsLoadingTools(false);
      }
    };
    loadTools();
  }, [isConnected]);

  if (!editedAgent) return null;

  // 更新字段的辅助函数
  const updateField = <K extends keyof AgentDefinition>(key: K, value: AgentDefinition[K]) => {
    setEditedAgent((prev) => prev ? { ...prev, [key]: value, updatedAt: Date.now() } : null);
  };

  const updateParameterField = <K extends keyof AgentDefinition["parameters"]>(key: K, value: AgentDefinition["parameters"][K]) => {
    setEditedAgent((prev) => prev ? { ...prev, parameters: { ...prev.parameters, [key]: value }, updatedAt: Date.now() } : null);
  };

  const updateRuntimeField = <K extends keyof AgentDefinition["runtime"]>(key: K, value: AgentDefinition["runtime"][K]) => {
    setEditedAgent((prev) => prev ? { ...prev, runtime: { ...prev.runtime, [key]: value }, updatedAt: Date.now() } : null);
  };

  const updatePermissionField = <K extends keyof AgentDefinition["permissions"]>(key: K, value: AgentDefinition["permissions"][K]) => {
    setEditedAgent((prev) => prev ? { ...prev, permissions: { ...prev.permissions, [key]: value }, updatedAt: Date.now() } : null);
  };

  const updatePromptField = <K extends keyof AgentDefinition["prompt"]>(key: K, value: AgentDefinition["prompt"][K]) => {
    setEditedAgent((prev) => prev ? { ...prev, prompt: { ...prev.prompt, [key]: value }, updatedAt: Date.now() } : null);
  };

  const updateMetadataField = <K extends keyof AgentDefinition["metadata"]>(key: K, value: AgentDefinition["metadata"][K]) => {
    setEditedAgent((prev) => prev ? { ...prev, metadata: { ...prev.metadata, [key]: value }, updatedAt: Date.now() } : null);
  };

  const updateToolsField = <K extends keyof AgentDefinition["tools"]>(key: K, value: AgentDefinition["tools"][K]) => {
    setEditedAgent((prev) => prev ? { ...prev, tools: { ...prev.tools, [key]: value }, updatedAt: Date.now() } : null);
  };

  const handleSave = () => {
    onSave(editedAgent);
  };

  // 删除确认
  const handleDeleteConfirm = () => {
    onDelete(editedAgent.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      {/* 主面板 */}
      <div className="fixed right-0 top-0 h-full w-[400px] bg-sidebar border-l border-sidebar-border/50 flex flex-col z-40">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-sidebar-border/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {editedAgent.icon && ICON_MAP[editedAgent.icon as keyof typeof ICON_MAP] ? (
              (() => {
                const IconComponent = ICON_MAP[editedAgent.icon as keyof typeof ICON_MAP];
                return <IconComponent className="w-4 h-4 shrink-0" style={{ color: editedAgent.color || "#3B82F6" }} />;
              })()
            ) : (
              <Bot className="w-4 h-4 shrink-0" style={{ color: editedAgent.color || "#3B82F6" }} />
            )}
            <span className="text-sm font-medium truncate">{editedAgent.name}</span>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded shrink-0",
              "text-muted-foreground/70 hover:text-foreground",
              "hover:bg-accent transition-colors duration-150"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 配置内容 */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5 h-8 p-0.5 bg-muted/50">
                <TabsTrigger value="basic" className="text-xs">基本</TabsTrigger>
                <TabsTrigger value="model" className="text-xs">模型</TabsTrigger>
                <TabsTrigger value="params" className="text-xs">参数</TabsTrigger>
                <TabsTrigger value="perms" className="text-xs">权限</TabsTrigger>
                <TabsTrigger value="prompt" className="text-xs">提示词</TabsTrigger>
              </TabsList>

              {/* 基本信息 Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* 名称 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">名称</Label>
                  <Input
                    value={editedAgent.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Agent 名称"
                    className="h-8 text-sm"
                  />
                </div>

                {/* 描述 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">描述</Label>
                  <Textarea
                    value={editedAgent.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Agent 描述"
                    className="min-h-[80px] text-sm resize-none"
                  />
                </div>

                {/* 图标选择 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">图标</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(ICON_MAP).map(([iconName, IconComponent]) => (
                      <button
                        key={iconName}
                        onClick={() => updateField("icon", iconName)}
                        className={cn(
                          "h-10 flex items-center justify-center rounded border transition-colors duration-150",
                          editedAgent.icon === iconName
                            ? "border-border bg-accent"
                            : "border-border/60 hover:bg-accent/50"
                        )}
                      >
                        <IconComponent className="w-4 h-4" style={{ color: editedAgent.color || "#3B82F6" }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 颜色选择 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">颜色</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_COLORS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => updateField("color", value)}
                        className={cn(
                          "h-10 flex items-center justify-center rounded border transition-colors duration-150",
                          editedAgent.color === value
                            ? "border-border ring-2 ring-offset-2 ring-offset-background"
                            : "border-border/60"
                        )}
                        style={{ 
                          backgroundColor: `${value}20`,
                          borderColor: editedAgent.color === value ? value : undefined,
                        }}
                        title={label}
                      >
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: value }} />
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* 类别 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">类别</Label>
                  <Select
                    value={editedAgent.metadata.category}
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

                {/* 成本等级 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">成本等级</Label>
                  <Select
                    value={editedAgent.metadata.cost}
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

              {/* 模型 Tab */}
              <TabsContent value="model" className="space-y-4 mt-4">
                {/* 模型选择 */}
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
                          <span className={cn(
                            "truncate",
                            !currentModelValue && "text-muted-foreground"
                          )}>
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
                                      onSelect={() => {
                                        setModelPopoverOpen(false);
                                        const capabilities = getCachedModelDefaults(value);
                                        
                                        setEditedAgent((prev) => {
                                          if (!prev) return null;
                                          
                                          const newModel = {
                                            ...prev.model,
                                            modelId: value,
                                            provider: provider.id,
                                          };
                                          
                                          const newParams = { ...prev.parameters };
                                          if (capabilities) {
                                            // Temperature: 当模型不支持时设为 undefined
                                            if (capabilities.supportsTemperature === false) {
                                              newParams.temperature = undefined;
                                            } else if (capabilities.defaultTemperature !== null) {
                                              newParams.temperature = capabilities.defaultTemperature;
                                            } else {
                                              newParams.temperature = 0.7;
                                            }
                                            
                                            // Top P: 与 Temperature 保持一致的处理逻辑
                                            // 注意：当前 models.dev API 未提供 supportsTopP 字段
                                            // 因此当 defaultTopP 为 null 时使用默认值 1.0
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
                                          
                                          return {
                                            ...prev,
                                            model: newModel,
                                            parameters: newParams,
                                            updatedAt: Date.now(),
                                          };
                                        });
                                      }}
                                    >
                                      <div className={cn(
                                        "flex items-center justify-center h-4 w-4 shrink-0 mr-2",
                                        "rounded-sm border",
                                        isSelected
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-input bg-transparent"
                                      )}>
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
                    当前: <code className="bg-muted px-1 rounded">{currentModelValue || "未选择"}</code>
                  </p>
                </div>


              </TabsContent>

              {/* 参数 Tab */}
              <TabsContent value="params" className="space-y-4 mt-4">
                {/* 模型能力信息 */}
                {currentModelCapabilities && (
                  <div className="p-2 rounded-md bg-muted/30 border border-border/40 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                      <span>上下文窗口</span>
                      <span className="font-mono">{currentModelCapabilities.contextWindow.toLocaleString()} tokens</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                      <span>最大输出</span>
                      <span className="font-mono">{currentModelCapabilities.maxOutputTokens.toLocaleString()} tokens</span>
                    </div>
                  </div>
                )}

                {/* Temperature */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={cn(
                      "text-xs",
                      currentModelCapabilities?.supportsTemperature === false 
                        ? "text-muted-foreground/40" 
                        : "text-muted-foreground/70"
                    )}>
                      Temperature
                      {currentModelCapabilities?.supportsTemperature === false && (
                        <span className="ml-1.5 text-[10px]">(不支持)</span>
                      )}
                    </Label>
                    <span className={cn(
                      "text-xs font-mono",
                      currentModelCapabilities?.supportsTemperature === false 
                        ? "text-muted-foreground/40" 
                        : "text-muted-foreground/70"
                    )}>
                      {editedAgent.parameters.temperature?.toFixed(1) ?? "0.3"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={editedAgent.parameters.temperature ?? 0.3}
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
                      "[&::-webkit-slider-thumb]:bg-foreground",
                      currentModelCapabilities?.supportsTemperature === false 
                        ? "[&::-webkit-slider-thumb]:cursor-not-allowed [&::-webkit-slider-thumb]:opacity-50"
                        : "[&::-webkit-slider-thumb]:cursor-pointer",
                      "[&::-moz-range-thumb]:w-3",
                      "[&::-moz-range-thumb]:h-3",
                      "[&::-moz-range-thumb]:rounded-full",
                      "[&::-moz-range-thumb]:bg-foreground",
                      "[&::-moz-range-thumb]:border-0",
                      currentModelCapabilities?.supportsTemperature === false 
                        ? "[&::-moz-range-thumb]:cursor-not-allowed"
                        : "[&::-moz-range-thumb]:cursor-pointer"
                    )}
                  />
                </div>

                {/* Top P */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground/70">Top P</Label>
                    <span className="text-xs text-muted-foreground/70 font-mono">
                      {editedAgent.parameters.topP?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={editedAgent.parameters.topP ?? 1}
                    onChange={(e) => updateParameterField("topP", parseFloat(e.target.value))}
                    className={cn(
                      "w-full h-1.5 rounded-full appearance-none cursor-pointer",
                      "bg-muted/50",
                      "[&::-webkit-slider-thumb]:appearance-none",
                      "[&::-webkit-slider-thumb]:w-3",
                      "[&::-webkit-slider-thumb]:h-3",
                      "[&::-webkit-slider-thumb]:rounded-full",
                      "[&::-webkit-slider-thumb]:bg-foreground",
                      "[&::-webkit-slider-thumb]:cursor-pointer",
                      "[&::-moz-range-thumb]:w-3",
                      "[&::-moz-range-thumb]:h-3",
                      "[&::-moz-range-thumb]:rounded-full",
                      "[&::-moz-range-thumb]:bg-foreground",
                      "[&::-moz-range-thumb]:border-0",
                      "[&::-moz-range-thumb]:cursor-pointer"
                    )}
                  />
                </div>

                {/* Max Tokens */}
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
                    value={editedAgent.parameters.maxTokens ?? ""}
                    onChange={(e) => updateParameterField("maxTokens", e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder={currentModelCapabilities?.maxOutputTokens 
                      ? `如 ${Math.min(4096, currentModelCapabilities.maxOutputTokens)}` 
                      : "如 4096"}
                    max={currentModelCapabilities?.maxOutputTokens || undefined}
                    className="h-8 text-sm font-mono"
                  />
                </div>

                <Separator className="bg-border/50" />

                {/* 扩展思考（Claude） */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs text-muted-foreground/70">扩展思考</Label>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Claude 模型专用</p>
                    </div>
                    <Switch
                      checked={editedAgent.parameters.thinking?.enabled ?? false}
                      onCheckedChange={(checked) =>
                        updateParameterField("thinking", { 
                          enabled: checked,
                          budgetTokens: editedAgent.parameters.thinking?.budgetTokens,
                        })
                      }
                    />
                  </div>

                  {editedAgent.parameters.thinking?.enabled && (
                    <div className="space-y-2 pl-4 border-l-2 border-border/60">
                      <Label className="text-xs text-muted-foreground/70">预算 Tokens</Label>
                      <Input
                        type="number"
                        value={editedAgent.parameters.thinking?.budgetTokens ?? ""}
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

                {/* 运行模式 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">运行模式</Label>
                  <Select
                    value={editedAgent.runtime.mode}
                    onValueChange={(value: AgentMode) => updateRuntimeField("mode", value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">主 Agent</SelectItem>
                      <SelectItem value="subagent">子 Agent</SelectItem>
                      <SelectItem value="all">全部</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* GPT 特定参数 */}
                <Separator className="bg-border/50" />
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground/70">GPT 模型专用</p>

                  {/* Reasoning Effort */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground/70">推理努力程度</Label>
                    <Select
                      value={editedAgent.parameters.reasoningEffort ?? "medium"}
                      onValueChange={(value: ReasoningEffort) => updateParameterField("reasoningEffort", value)}
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

                  {/* Text Verbosity */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground/70">输出详细程度</Label>
                    <Select
                      value={editedAgent.parameters.textVerbosity ?? "medium"}
                      onValueChange={(value: TextVerbosity) => updateParameterField("textVerbosity", value)}
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

              {/* 权限 Tab */}
              <TabsContent value="perms" className="space-y-4 mt-4">
                {isLoadingTools ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">加载工具列表...</span>
                  </div>
                ) : toolIds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground/60 text-sm">
                    无可用工具
                  </div>
                ) : (
                  <div className="space-y-3">
                    {toolIds.map((toolId) => {
                      const permValue = editedAgent.permissions[toolId];
                      const currentValue = typeof permValue === "string" ? permValue : "ask";
                      return (
                        <div key={toolId} className="flex items-center justify-between gap-4">
                          <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex-1 min-w-0 truncate">
                            {toolId}
                          </code>
                          <Select
                            value={currentValue}
                            onValueChange={(value: PermissionValue) => updatePermissionField(toolId, value)}
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

                {/* 工具访问模式 */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground/70">工具访问模式</Label>
                    <Select
                      value={editedAgent.tools.mode}
                      onValueChange={(value: "whitelist" | "blacklist" | "all") => updateToolsField("mode", value)}
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

                  {editedAgent.tools.mode !== "all" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground/70">
                        {editedAgent.tools.mode === "whitelist" ? "允许的工具" : "禁用的工具"}
                      </Label>
                      <div className="border border-input rounded-sm p-2 max-h-[150px] overflow-y-auto space-y-1">
                        {toolIds.map((toolId) => {
                          const isSelected = editedAgent.tools.list.includes(toolId);
                          return (
                            <button
                              key={toolId}
                              type="button"
                              onClick={() => {
                                const newList = isSelected
                                  ? editedAgent.tools.list.filter((t) => t !== toolId)
                                  : [...editedAgent.tools.list, toolId];
                                updateToolsField("list", newList);
                              }}
                              className={cn(
                                "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm",
                                "hover:bg-accent transition-colors",
                                isSelected && "bg-accent"
                              )}
                            >
                              <div className={cn(
                                "flex items-center justify-center h-4 w-4 shrink-0",
                                "rounded-sm border",
                                isSelected
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-input bg-transparent"
                              )}>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <code className="text-xs">{toolId}</code>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60">
                        已选择 {editedAgent.tools.list.length} 个工具
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 提示词 Tab */}
              <TabsContent value="prompt" className="space-y-4 mt-4">
                {/* 系统提示词 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">系统提示词</Label>
                  <Textarea
                    value={editedAgent.prompt.system || ""}
                    onChange={(e) => updatePromptField("system", e.target.value || undefined)}
                    placeholder="覆盖默认系统提示词..."
                    className="min-h-[120px] text-sm font-mono resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground/60">
                    完全覆盖系统提示词
                  </p>
                </div>

                <Separator className="bg-border/50" />

                {/* 追加提示词 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground/70">追加提示词</Label>
                  <Textarea
                    value={editedAgent.prompt.append || ""}
                    onChange={(e) => updatePromptField("append", e.target.value || undefined)}
                    placeholder="追加到系统提示词末尾..."
                    className="min-h-[120px] text-sm font-mono resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground/60">
                    追加到默认提示词之后
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* 底部操作按钮 */}
        <div className="border-t border-sidebar-border/50 p-4 space-y-2 shrink-0">
          <Button
            onClick={handleSave}
            className="w-full h-9"
          >
            <Save className="w-4 h-4 mr-2" />
            保存修改
          </Button>
          
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="outline"
            className="w-full h-9 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除 Agent
          </Button>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除 Agent "{editedAgent.name}" 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="w-4 h-4 mr-2" />
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
