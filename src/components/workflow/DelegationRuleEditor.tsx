/**
 * 委托规则编辑器
 * 
 * 用于编辑工作流中的委托规则，定义何时将任务委托给哪个子 Agent
 * 支持规则的增删改、优先级设置、启用/禁用
 */

import { useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Check,
  AlertCircle,
  Zap,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type {
  DelegationRule,
  DelegationRuleset,
  DelegationPriority,
  SubagentConfig,
} from "@/types/workflow";
import { createDefaultDelegationRule } from "@/types/workflow";

// ============================================================================
// 类型定义
// ============================================================================

interface DelegationRuleEditorProps {
  /** 委托规则集 */
  ruleset: DelegationRuleset;
  /** 可用的子 Agent 列表 */
  subagents: SubagentConfig[];
  /** 规则集变更回调 */
  onChange: (ruleset: DelegationRuleset) => void;
  /** 是否只读 */
  readonly?: boolean;
}

// ============================================================================
// 常量
// ============================================================================

/** 优先级配置 */
const PRIORITY_CONFIG: Record<DelegationPriority, { label: string; color: string; icon: typeof Zap }> = {
  critical: { label: "紧急", color: "text-red-500", icon: AlertCircle },
  high: { label: "高", color: "text-orange-500", icon: Zap },
  medium: { label: "中", color: "text-blue-500", icon: ArrowRight },
  low: { label: "低", color: "text-muted-foreground", icon: Clock },
};

/** 默认行为选项 */
const DEFAULT_BEHAVIOR_OPTIONS = [
  { value: "handle-self", label: "自己处理", description: "主 Agent 自己处理任务" },
  { value: "ask-user", label: "询问用户", description: "询问用户如何处理" },
  { value: "delegate-to", label: "委托给", description: "委托给指定的子 Agent" },
] as const;

// ============================================================================
// 主组件
// ============================================================================

export function DelegationRuleEditor({
  ruleset,
  subagents,
  onChange,
  readonly = false,
}: DelegationRuleEditorProps) {
  // 添加新规则
  const handleAddRule = useCallback(() => {
    if (subagents.length === 0) return;
    
    const newRule = createDefaultDelegationRule(subagents[0].id);
    onChange({
      ...ruleset,
      rules: [...ruleset.rules, newRule],
    });
  }, [ruleset, subagents, onChange]);

  // 更新规则
  const handleUpdateRule = useCallback(
    (ruleId: string, updates: Partial<DelegationRule>) => {
      onChange({
        ...ruleset,
        rules: ruleset.rules.map((rule) =>
          rule.id === ruleId ? { ...rule, ...updates } : rule
        ),
      });
    },
    [ruleset, onChange]
  );

  // 删除规则
  const handleDeleteRule = useCallback(
    (ruleId: string) => {
      onChange({
        ...ruleset,
        rules: ruleset.rules.filter((rule) => rule.id !== ruleId),
      });
    },
    [ruleset, onChange]
  );

  // 更新默认行为
  const handleUpdateDefaultBehavior = useCallback(
    (behavior: DelegationRuleset["defaultBehavior"]) => {
      onChange({
        ...ruleset,
        defaultBehavior: behavior,
        // 如果切换到非 "delegate-to"，清除默认目标
        defaultSubagentId: behavior === "delegate-to" ? ruleset.defaultSubagentId : undefined,
      });
    },
    [ruleset, onChange]
  );

  // 更新默认委托目标
  const handleUpdateDefaultSubagent = useCallback(
    (subagentId: string) => {
      onChange({
        ...ruleset,
        defaultSubagentId: subagentId,
      });
    },
    [ruleset, onChange]
  );

  // 更新自定义指南
  const handleUpdateGuidelines = useCallback(
    (guidelines: string) => {
      onChange({
        ...ruleset,
        customGuidelines: guidelines || undefined,
      });
    },
    [ruleset, onChange]
  );

  // 获取子 Agent 名称
  const getSubagentName = useCallback(
    (subagentId: string): string => {
      const subagent = subagents.find((s) => s.id === subagentId);
      return subagent?.name || subagent?.agentId || "未知 Agent";
    },
    [subagents]
  );

  return (
    <div className="space-y-6">
      {/* 规则列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground/70">委托规则</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5"
            onClick={handleAddRule}
            disabled={readonly || subagents.length === 0}
          >
            <Plus className="w-3.5 h-3.5" />
            添加规则
          </Button>
        </div>

        {subagents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-border/60 rounded-md">
            <AlertCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground/60 text-center">
              请先添加子 Agent
            </p>
          </div>
        ) : ruleset.rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 border border-dashed border-border/60 rounded-md">
            <p className="text-sm text-muted-foreground/60 text-center mb-3">
              暂无委托规则
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleAddRule}
              disabled={readonly}
            >
              <Plus className="w-3.5 h-3.5" />
              创建第一条规则
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {ruleset.rules.map((rule, index) => (
              <RuleItem
                key={rule.id}
                rule={rule}
                index={index}
                subagents={subagents}
                getSubagentName={getSubagentName}
                onUpdate={(updates) => handleUpdateRule(rule.id, updates)}
                onDelete={() => handleDeleteRule(rule.id)}
                readonly={readonly}
              />
            ))}
          </div>
        )}
      </div>

      <Separator className="bg-border/50" />

      {/* 默认行为 */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground/70">默认行为</Label>
        <p className="text-[10px] text-muted-foreground/50">
          当没有规则匹配时的处理方式
        </p>

        <Select
          value={ruleset.defaultBehavior}
          onValueChange={(value) =>
            handleUpdateDefaultBehavior(value as DelegationRuleset["defaultBehavior"])
          }
          disabled={readonly}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_BEHAVIOR_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {ruleset.defaultBehavior === "delegate-to" && (
          <div className="space-y-2 pl-4 border-l-2 border-border/60">
            <Label className="text-xs text-muted-foreground/70">默认委托目标</Label>
            <SubagentSelector
              value={ruleset.defaultSubagentId}
              subagents={subagents}
              getSubagentName={getSubagentName}
              onChange={handleUpdateDefaultSubagent}
              disabled={readonly}
            />
          </div>
        )}
      </div>

      <Separator className="bg-border/50" />

      {/* 自定义指南 */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground/70">委托指南</Label>
        <Textarea
          value={ruleset.customGuidelines || ""}
          onChange={(e) => handleUpdateGuidelines(e.target.value)}
          placeholder="自定义委托指南（Markdown 格式），会注入到主 Agent 的系统提示词中..."
          className="min-h-[100px] text-sm font-mono resize-none"
          disabled={readonly}
        />
        <p className="text-[10px] text-muted-foreground/50">
          提供额外的委托决策指南
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// 规则项组件
// ============================================================================

interface RuleItemProps {
  rule: DelegationRule;
  index: number;
  subagents: SubagentConfig[];
  getSubagentName: (id: string) => string;
  onUpdate: (updates: Partial<DelegationRule>) => void;
  onDelete: () => void;
  readonly: boolean;
}

function RuleItem({
  rule,
  index,
  subagents,
  getSubagentName,
  onUpdate,
  onDelete,
  readonly,
}: RuleItemProps) {
  const priorityConfig = PRIORITY_CONFIG[rule.priority];
  const PriorityIcon = priorityConfig.icon;

  return (
    <div
      className={cn(
        "group relative border border-border/60 rounded-md p-3",
        "transition-colors duration-150",
        !rule.enabled && "opacity-60",
        "hover:border-border"
      )}
    >
      {/* 拖拽手柄（保留，后续可实现拖拽排序） */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="w-3 h-3 text-muted-foreground/50" />
      </div>

      <div className="space-y-3 ml-3">
        {/* 顶部：启用开关 + 删除 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50 font-mono">
              #{index + 1}
            </span>
            <Switch
              checked={rule.enabled}
              onCheckedChange={(enabled) => onUpdate({ enabled })}
              disabled={readonly}
              className="scale-75"
            />
            <span className="text-[10px] text-muted-foreground/60">
              {rule.enabled ? "启用" : "禁用"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
            disabled={readonly}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>

        {/* 目标子 Agent */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground/60">委托给</Label>
          <SubagentSelector
            value={rule.subagentId}
            subagents={subagents}
            getSubagentName={getSubagentName}
            onChange={(subagentId) => onUpdate({ subagentId })}
            disabled={readonly}
          />
        </div>

        {/* 领域 */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground/60">触发领域</Label>
          <Input
            value={rule.domain}
            onChange={(e) => onUpdate({ domain: e.target.value })}
            placeholder="如：前端、后端、测试、文档..."
            className="h-7 text-xs"
            disabled={readonly}
          />
        </div>

        {/* 触发条件 */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground/60">触发条件</Label>
          <Textarea
            value={rule.condition}
            onChange={(e) => onUpdate({ condition: e.target.value })}
            placeholder="描述何时触发此规则..."
            className="min-h-[60px] text-xs resize-none"
            disabled={readonly}
          />
        </div>

        {/* 底部：优先级 + 后台执行 */}
        <div className="flex items-center gap-4">
          {/* 优先级 */}
          <div className="flex items-center gap-2">
            <PriorityIcon className={cn("w-3 h-3", priorityConfig.color)} />
            <Select
              value={rule.priority}
              onValueChange={(value: DelegationPriority) =>
                onUpdate({ priority: value })
              }
              disabled={readonly}
            >
              <SelectTrigger className="h-6 text-[10px] w-20 border-0 bg-transparent p-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PRIORITY_CONFIG) as [DelegationPriority, typeof priorityConfig][]).map(
                  ([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className={config.color}>{config.label}</span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 后台执行 */}
          <div className="flex items-center gap-1.5">
            <Switch
              checked={rule.runInBackground ?? false}
              onCheckedChange={(runInBackground) => onUpdate({ runInBackground })}
              disabled={readonly}
              className="scale-75"
            />
            <span className="text-[10px] text-muted-foreground/60">后台执行</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 子 Agent 选择器
// ============================================================================

interface SubagentSelectorProps {
  value?: string;
  subagents: SubagentConfig[];
  getSubagentName: (id: string) => string;
  onChange: (subagentId: string) => void;
  disabled?: boolean;
}

function SubagentSelector({
  value,
  subagents,
  getSubagentName,
  onChange,
  disabled,
}: SubagentSelectorProps) {
  const selectedName = value ? getSubagentName(value) : "选择子 Agent...";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center justify-between w-full h-7 px-2",
            "text-xs rounded-sm border border-input bg-background",
            "hover:bg-accent/50 transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selectedName}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索子 Agent..." />
          <CommandList>
            <CommandEmpty>未找到子 Agent</CommandEmpty>
            <CommandGroup>
              {subagents.map((subagent) => {
                const isSelected = value === subagent.id;
                const name = subagent.name || subagent.agentId;
                return (
                  <CommandItem
                    key={subagent.id}
                    value={subagent.id}
                    onSelect={() => {
                      onChange(subagent.id);
                    }}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center h-3.5 w-3.5 shrink-0 mr-2",
                        "rounded-sm border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs">{name}</span>
                      {subagent.description && (
                        <span className="text-[10px] text-muted-foreground/60 truncate">
                          {subagent.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
