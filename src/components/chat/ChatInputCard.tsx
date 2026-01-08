/**
 * 聊天输入卡片组件
 * 参考 Claude 风格的输入框设计：圆角卡片，内嵌功能按钮
 */

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Clock,
  ArrowUp,
  Square,
  Loader2,
  ChevronDown,
  Cpu,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { Provider } from "@/stores/chat";

interface ChatInputCardProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  // 模型选择相关
  providers?: Provider[];
  selectedModel?: { providerId: string; modelId: string } | null;
  onSelectModel?: (providerId: string, modelId: string) => void;
  isLoadingModels?: boolean;
  // 是否为空状态（新会话）
  isEmptyState?: boolean;
}

/**
 * 创建模型过滤函数
 */
function createModelFilter(providers: Provider[]) {
  const searchIndex = new Map<string, string>();

  for (const provider of providers) {
    for (const model of provider.models) {
      const value = `${provider.id}/${model.id}`;
      const searchText = `${provider.name} ${model.name}`.toLowerCase();
      searchIndex.set(value, searchText);
    }
  }

  return (value: string, search: string): number => {
    if (!search) return 1;

    const searchText = searchIndex.get(value);
    if (!searchText) return 0;

    const searchLower = search.toLowerCase().trim();
    const keywords = searchLower.split(/\s+/).filter(Boolean);
    const allMatch = keywords.every((keyword) => searchText.includes(keyword));

    if (!allMatch) return 0;

    let score = 1;
    if (searchText.includes(searchLower)) score += 0.5;
    if (searchText.startsWith(searchLower)) score += 0.3;

    return score;
  };
}

export function ChatInputCard({
  onSend,
  onStop,
  isLoading = false,
  disabled = false,
  placeholder,
  providers = [],
  selectedModel,
  onSelectModel,
  isLoadingModels = false,
  isEmptyState = false,
}: ChatInputCardProps) {
  const { t } = useTranslation();
  const inputPlaceholder =
    placeholder ||
    (isEmptyState
      ? t("chat.inputPlaceholderCommands")
      : t("chat.inputPlaceholder"));
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 创建模型过滤函数
  const filterFn = createModelFilter(providers);

  // 构建当前选择的值
  const currentValue =
    selectedModel && selectedModel.providerId && selectedModel.modelId
      ? `${selectedModel.providerId}/${selectedModel.modelId}`
      : "";

  // 获取当前选中模型的显示名称
  const getModelDisplayName = () => {
    if (!selectedModel || !selectedModel.providerId || !selectedModel.modelId) {
      return t("chat.selectModel");
    }

    for (const provider of providers) {
      const model = provider.models.find(
        (m) =>
          m.id === selectedModel.modelId &&
          m.provider === selectedModel.providerId
      );
      if (model) {
        return model.name;
      }
    }

    return selectedModel.modelId;
  };

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;

    onSend(trimmed);
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, isLoading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const handleSelectModel = (modelValue: string) => {
    const [providerId, modelId] = modelValue.split("/");
    if (providerId && modelId && onSelectModel) {
      onSelectModel(providerId, modelId);
      setModelOpen(false);
    }
  };

  // 是否显示模型选择器
  const showModelSelector =
    providers.length > 0 && onSelectModel && !isLoadingModels;

  return (
    <div
      className={cn(
        "border border-border rounded-xl bg-background shadow-sm",
        "transition-shadow duration-200",
        "focus-within:shadow-md focus-within:border-border/80"
      )}
    >
      {/* 输入区域 */}
      <div className="p-3 pb-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={inputPlaceholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "min-h-[24px] max-h-[200px] resize-none",
            "border-0 p-0 shadow-none",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/60",
            "text-base"
          )}
        />
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between px-2 pb-2">
        {/* 左侧按钮组 */}
        <div className="flex items-center gap-1">
          {/* 附件按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            title={t("chat.attachFile")}
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* 历史按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            title={t("chat.history")}
          >
            <Clock className="h-4 w-4" />
          </Button>
        </div>

        {/* 右侧：模型选择器 + 发送按钮 */}
        <div className="flex items-center gap-2">
          {/* 模型选择器 */}
          {showModelSelector && (
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    "h-8 px-2.5 rounded-lg",
                    "text-sm text-muted-foreground",
                    "hover:bg-muted/50 hover:text-foreground",
                    "transition-colors duration-100",
                    "focus:outline-none focus:ring-1 focus:ring-ring",
                    disabled && "pointer-events-none opacity-50"
                  )}
                  disabled={disabled}
                >
                  <span className="max-w-[120px] truncate">
                    {getModelDisplayName()}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      modelOpen && "rotate-180"
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[300px] p-0 rounded-lg shadow-lg border border-border"
                align="end"
                sideOffset={8}
              >
                <Command className="rounded-lg" filter={filterFn}>
                  <CommandInput placeholder={t("chat.searchModel")} />
                  <CommandList>
                    <CommandEmpty>{t("chat.noModelFound")}</CommandEmpty>
                    {providers.map((provider) => (
                      <CommandGroup key={provider.id} heading={provider.name}>
                        {provider.models.map((model) => {
                          const modelValue = `${provider.id}/${model.id}`;
                          const isSelected = currentValue === modelValue;
                          return (
                            <CommandItem
                              key={modelValue}
                              value={modelValue}
                              onSelect={handleSelectModel}
                              className="gap-2"
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

          {/* 加载模型状态 */}
          {isLoadingModels && (
            <div className="flex items-center gap-1.5 h-8 px-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("chat.loadingModels")}</span>
            </div>
          )}

          {/* 无模型状态 */}
          {!isLoadingModels && providers.length === 0 && onSelectModel && (
            <div className="flex items-center gap-1.5 h-8 px-2.5 text-sm text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              <span>{t("chat.noModels")}</span>
            </div>
          )}

          {/* 发送/停止按钮 */}
          {isLoading ? (
            <Button
              variant="destructive"
              size="icon"
              onClick={onStop}
              className="h-8 w-8 rounded-lg shrink-0"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              size="icon"
              className={cn(
                "h-8 w-8 rounded-lg shrink-0",
                "bg-primary hover:bg-primary/90",
                "disabled:bg-muted disabled:text-muted-foreground"
              )}
            >
              {disabled && !isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
