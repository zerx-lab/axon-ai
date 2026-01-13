/**
 * 聊天输入卡片组件
 * 参考 Claude 风格的输入框设计：圆角卡片，内嵌功能按钮
 * 
 * 性能优化：SessionSearchDialog 懒加载
 */

import { useState, useRef, useCallback, useEffect, lazy, Suspense, type KeyboardEvent, type ClipboardEvent, type DragEvent } from "react";
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
  X,
  FileText,
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
const SessionSearchDialog = lazy(() => import("./SessionSearchDialog").then(m => ({ default: m.SessionSearchDialog })));
import { VariantSelector } from "./VariantSelector";
import type { Provider } from "@/stores/chat";
import type { Session } from "@/types/chat";
import {
  useAttachments,
  type Attachment,
  SUPPORTED_ATTACHMENT_TYPES,
  isSupportedAttachmentType,
} from "@/hooks";

interface ChatInputCardProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  providers?: Provider[];
  selectedModel?: { providerId: string; modelId: string } | null;
  onSelectModel?: (providerId: string, modelId: string) => void;
  isLoadingModels?: boolean;
  currentVariants?: string[];
  selectedVariant?: string | undefined;
  onSelectVariant?: (variant: string | undefined) => void;
  onCycleVariant?: () => void;
  isEmptyState?: boolean;
  sessions?: Session[];
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  fillValue?: string;
  onFillValueConsumed?: () => void;
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
  currentVariants = [],
  selectedVariant,
  onSelectVariant,
  onCycleVariant,
  isEmptyState = false,
  sessions = [],
  activeSessionId = null,
  onSelectSession,
  fillValue,
  onFillValueConsumed,
}: ChatInputCardProps) {
  const { t } = useTranslation();
  const inputPlaceholder =
    placeholder ||
    (isEmptyState
      ? t("chat.inputPlaceholderCommands")
      : t("chat.inputPlaceholder"));
  const [value, setValue] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    attachments,
    addAttachmentFromFile,
    addAttachmentFromBlob,
    removeAttachment,
    clearAttachments,
    isMaxAttachments,
    hasAttachments,
  } = useAttachments();

  const filterFn = createModelFilter(providers);

  const currentValue =
    selectedModel && selectedModel.providerId && selectedModel.modelId
      ? `${selectedModel.providerId}/${selectedModel.modelId}`
      : "";

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

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    });
  }, []);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (fillValue !== undefined && fillValue !== "") {
      setValue(fillValue);
      onFillValueConsumed?.();
      focusInput();
      requestAnimationFrame(() => {
        handleInput();
      });
    }
  }, [fillValue, onFillValueConsumed, focusInput, handleInput]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    const hasContent = trimmed || hasAttachments;
    if (!hasContent || isLoading || disabled) return;

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    clearAttachments();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    focusInput();
  }, [value, isLoading, disabled, onSend, focusInput, attachments, hasAttachments, clearAttachments]);

  const handlePaste = useCallback(
    async (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (isSupportedAttachmentType(item.type)) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await addAttachmentFromBlob(blob);
          }
          return;
        }
      }
    },
    [addAttachmentFromBlob]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const hasFiles = e.dataTransfer?.types.includes("Files");
    if (hasFiles) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (const file of files) {
        if (isSupportedAttachmentType(file.type)) {
          await addAttachmentFromFile(file);
        }
      }
    },
    [addAttachmentFromFile]
  );

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of files) {
        await addAttachmentFromFile(file);
      }
      e.target.value = "";
    },
    [addAttachmentFromFile]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleSelectModel = (modelValue: string) => {
    const [providerId, modelId] = modelValue.split("/");
    if (providerId && modelId && onSelectModel) {
      onSelectModel(providerId, modelId);
      setModelOpen(false);
      // 选择模型后聚焦输入框
      focusInput();
    }
  };

  // 处理选择推理深度
  const handleSelectVariant = useCallback(
    (variant: string | undefined) => {
      onSelectVariant?.(variant);
      // 选择推理深度后聚焦输入框
      focusInput();
    },
    [onSelectVariant, focusInput]
  );

  // 处理选择历史会话
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      onSelectSession?.(sessionId);
      // 选择会话后聚焦输入框（Dialog 关闭由 SessionSearchDialog 内部处理）
      focusInput();
    },
    [onSelectSession, focusInput]
  );

  const showModelSelector =
    providers.length > 0 && onSelectModel && !isLoadingModels;

  const acceptTypes = SUPPORTED_ATTACHMENT_TYPES.join(",");

  return (
    <div
      className={cn(
        "border border-border/60 rounded-2xl bg-card shadow-sm",
        "transition-all duration-200",
        "focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10",
        isDragging && "border-primary/50 bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {hasAttachments && (
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative group"
            >
              <div
                className={cn(
                  "rounded-lg overflow-hidden",
                  "border border-border/60 bg-muted/30",
                  "flex items-center gap-2"
                )}
              >
                {attachment.type === "image" ? (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.filename}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 flex items-center justify-center bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className={cn(
                  "absolute -top-1.5 -right-1.5 z-10",
                  "h-5 w-5 rounded-full",
                  "bg-destructive text-destructive-foreground",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-150",
                  "shadow-sm"
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 pb-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          placeholder={inputPlaceholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "min-h-[28px] max-h-[200px] resize-none",
            "border-0 p-0 shadow-none bg-transparent",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/50",
            "text-base leading-relaxed"
          )}
        />
      </div>

      <div className="flex items-center justify-between px-3 pb-3">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80"
            disabled={disabled || isMaxAttachments}
            title={t("chat.attachFile")}
            onClick={handleFileSelect}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80"
            disabled={disabled || sessions.length === 0}
            title={t("chat.history")}
            onClick={() => setHistoryOpen(true)}
          >
            <Clock className="h-4 w-4" />
          </Button>
        </div>

        {/* 右侧：模型选择器 + 发送按钮 */}
        <div className="flex items-center gap-2">
          {/* 模型选择器 - 精致设计 */}
          {showModelSelector && (
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    "h-8 px-3 rounded-lg",
                    "text-sm text-muted-foreground font-medium",
                    "bg-accent/50 hover:bg-accent hover:text-foreground",
                    "transition-all duration-150",
                    "focus:outline-none focus:ring-2 focus:ring-ring/40",
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
                className="w-[320px] p-0 rounded-xl shadow-xl border border-border/60 bg-popover/95 backdrop-blur-sm"
                align="end"
                sideOffset={8}
              >
                <Command className="rounded-xl" filter={filterFn}>
                  <CommandInput placeholder={t("chat.searchModel")} className="h-10" />
                  <CommandList className="max-h-[300px]">
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
                              className="gap-2.5 py-2.5 rounded-lg mx-1"
                            >
                              <div
                                className={cn(
                                  "flex items-center justify-center h-4 w-4 shrink-0",
                                  "rounded border transition-colors",
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border/60 bg-transparent"
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

          {/* Variant（推理深度）选择器 */}
          {currentVariants.length > 0 && onSelectVariant && (
            <VariantSelector
              variants={currentVariants}
              selectedVariant={selectedVariant}
              onSelectVariant={handleSelectVariant}
              onCycleVariant={onCycleVariant}
              disabled={disabled}
              mode="dropdown"
            />
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

          {isLoading ? (
            <Button
              variant="destructive"
              size="icon"
              onClick={onStop}
              className="h-9 w-9 rounded-xl shrink-0 shadow-sm"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={(!value.trim() && !hasAttachments) || disabled}
              size="icon"
              className={cn(
                "h-9 w-9 rounded-xl shrink-0 shadow-sm",
                "bg-primary hover:bg-primary/90",
                "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
                "transition-all duration-150"
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

      {/* 会话搜索弹窗 */}
      {onSelectSession && (
        <Suspense fallback={null}>
          <SessionSearchDialog
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
          />
        </Suspense>
      )}
    </div>
  );
}
