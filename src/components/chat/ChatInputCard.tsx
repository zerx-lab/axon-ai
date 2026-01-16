/**
 * 聊天输入卡片组件
 * 参考 Claude 风格的输入框设计：圆角卡片，内嵌功能按钮
 * 
 * 性能优化：SessionSearchDialog 懒加载
 */

import { useState, useRef, useCallback, useEffect, lazy, Suspense, useMemo, type KeyboardEvent, type ClipboardEvent, type DragEvent } from "react";
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
  Folder,
  File,
  Bot,
  Plug,
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
import { AgentSelector } from "./AgentSelector";
import type { Provider } from "@/stores/chat";
import type { Session, Agent } from "@/types/chat";
import {
  useAttachments,
  useTriggerDetection,
  useCommands,
  useFileSearch,
  useMcpResources,
  useMentions,
  useFileReader,
  toAbsolutePath,
  type Attachment,
  type SlashCommand,
  type MentionPart,
  SUPPORTED_ATTACHMENT_TYPES,
  isSupportedAttachmentType,
} from "@/hooks";

// SlashCommand 类型已从 @/hooks 导入

/**
 * @ 提及选项类型
 */
type AtOption =
  | { type: "agent"; name: string; display: string }
  | { type: "file"; path: string; display: string; isDirectory: boolean }
  | { type: "resource"; uri: string; name: string; display: string; description?: string; client: string };

interface ChatInputCardProps {
  onSend: (message: string, attachments?: Attachment[], mentionParts?: MentionPart[]) => void;
  /** SDK 命令发送回调（/commandName args） */
  onSendCommand?: (commandName: string, args: string) => void;
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
  agents?: Agent[];
  currentAgent?: Agent | null;
  onSelectAgent?: (agentName: string) => void;
  isEmptyState?: boolean;
  sessions?: Session[];
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  fillValue?: string;
  onFillValueConsumed?: () => void;
  /** 项目路径（用于 SDK 请求） */
  projectPath?: string;
  /** 命令执行回调 */
  onCommand?: (command: SlashCommand) => void;
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
  onSendCommand,
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
  agents = [],
  currentAgent = null,
  onSelectAgent,
  isEmptyState = false,
  sessions = [],
  activeSessionId = null,
  onSelectSession,
  fillValue,
  onFillValueConsumed,
  projectPath = "",
  onCommand,
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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // 触发检测
  const {
    trigger,
    showMention,
    showCommand,
    detectTrigger,
    closeTrigger,
    replaceWithSelection,
  } = useTriggerDetection();

  // 从 SDK 获取命令列表
  const { filterCommands, isLoading: isLoadingCommands } = useCommands({
    directory: projectPath,
  });

  // 从 SDK 搜索文件
  const {
    results: fileResults,
    isLoading: isLoadingFiles,
    search: searchFiles,
    clearResults: clearFileResults,
  } = useFileSearch({ directory: projectPath });

  // 从 SDK 获取 MCP 资源
  const { filterResources } = useMcpResources({ directory: projectPath });

  // @ 提及管理
  const {
    mentions,
    hasMentions,
    addFileMention,
    addAgentMention,
    addResourceMention,
    removeMention,
    clearMentions,
    buildParts: buildMentionParts,
  } = useMentions();

  // 文件读取
  const { readFile, isReading: isReadingFile } = useFileReader();

  // 触发文件搜索
  useEffect(() => {
    if (showMention && trigger?.searchText) {
      searchFiles(trigger.searchText);
    } else {
      clearFileResults();
    }
  }, [showMention, trigger?.searchText, searchFiles, clearFileResults]);

  // 过滤后的命令列表
  const filteredCommands = useMemo(() => {
    return filterCommands(trigger?.searchText || "");
  }, [filterCommands, trigger?.searchText]);

  // 过滤后的 @ 提及选项（agents + files + resources）
  const filteredAtOptions = useMemo(() => {
    const search = trigger?.searchText?.toLowerCase() || "";
    const result: AtOption[] = [];

    // 1. Agents（优先显示）
    for (const agent of agents) {
      const display = agent.name;
      if (!search || display.toLowerCase().includes(search)) {
        result.push({ type: "agent", name: agent.name, display });
      }
    }

    // 2. Files（来自 SDK 搜索）
    for (const file of fileResults) {
      result.push({
        type: "file",
        path: file.path,
        display: file.display,
        isDirectory: file.isDirectory,
      });
    }

    // 3. MCP Resources
    const filteredRes = filterResources(search);
    for (const res of filteredRes) {
      result.push({
        type: "resource",
        uri: res.uri,
        name: res.name,
        display: `${res.name} (${res.client})`,
        description: res.description,
        client: res.client,
      });
    }

    return result.slice(0, 30); // 限制显示数量
  }, [agents, fileResults, filterResources, trigger?.searchText]);
  
  // 计算当前弹窗的项目数量（用于键盘导航）
  const currentItemCount = useMemo(() => {
    if (showCommand) return filteredCommands.length;
    if (showMention) return filteredAtOptions.length;
    return 0;
  }, [showCommand, showMention, filteredCommands.length, filteredAtOptions.length]);

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
    const hasContent = trimmed || hasAttachments || hasMentions;
    if (!hasContent || isLoading || disabled) return;

    // 检测是否是 SDK 命令（以 / 开头）
    // 格式: /commandName [args]
    const commandMatch = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/);
    if (commandMatch && onSendCommand) {
      const commandName = commandMatch[1];
      const args = commandMatch[2]?.trim() || "";
      onSendCommand(commandName, args);
      setValue("");
      clearAttachments();
      clearMentions();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      focusInput();
      return;
    }

    // 构建 mention parts
    const mentionParts = hasMentions ? buildMentionParts() : undefined;

    onSend(
      trimmed,
      attachments.length > 0 ? attachments : undefined,
      mentionParts
    );
    setValue("");
    clearAttachments();
    clearMentions();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    focusInput();
  }, [value, isLoading, disabled, onSend, onSendCommand, focusInput, attachments, hasAttachments, hasMentions, clearAttachments, clearMentions, buildMentionParts]);

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

  // 处理输入变化（包含触发检测）
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      // 检测触发字符
      detectTrigger(newValue, e.target.selectionStart || 0);
      // 重置高亮索引
      setHighlightedIndex(0);
    },
    [detectTrigger]
  );

  // 处理 @ 提及选择（仅更新输入框文本）
  const handleMentionTextReplace = useCallback(
    (displayText: string) => {
      const { newValue, newCursorPosition } = replaceWithSelection(value, displayText);
      setValue(newValue);
      // 设置光标位置
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPosition;
          textareaRef.current.selectionEnd = newCursorPosition;
          textareaRef.current.focus();
          handleInput();
        }
      });
    },
    [value, replaceWithSelection, handleInput]
  );

  // 处理 @ 文件选择（读取内容并添加 mention）
  const handleFileMentionSelect = useCallback(
    async (option: AtOption & { type: "file" }) => {
      // 目录不读取内容，仅用于继续搜索
      if (option.isDirectory) {
        handleMentionTextReplace(`@${option.display}/`);
        return;
      }

      // 构建绝对路径
      const absolutePath = toAbsolutePath(option.path, projectPath);

      // 读取文件内容
      const content = await readFile(absolutePath);

      if (content !== null) {
        // 添加文件提及
        addFileMention({
          path: option.path,
          absolutePath,
          content,
          displayText: `@${option.display}`,
        });
      }

      // 替换输入框文本（不论是否读取成功，都显示 @filename）
      handleMentionTextReplace(`@${option.display} `);
    },
    [handleMentionTextReplace, projectPath, readFile, addFileMention]
  );

  // 处理 @ Agent 选择
  const handleAgentSelect = useCallback(
    (option: AtOption & { type: "agent" }) => {
      addAgentMention({
        name: option.name,
        displayText: `@${option.name}`,
      });
      handleMentionTextReplace(`@${option.name} `);
    },
    [handleMentionTextReplace, addAgentMention]
  );

  // 处理 @ MCP 资源选择
  const handleResourceSelect = useCallback(
    (option: AtOption & { type: "resource" }) => {
      addResourceMention({
        uri: option.uri,
        clientName: option.client,
        name: option.name,
        displayText: `@${option.name}`,
      });
      handleMentionTextReplace(`@${option.name} `);
    },
    [handleMentionTextReplace, addResourceMention]
  );

  // 统一的 @ 选择处理
  const handleAtOptionSelect = useCallback(
    (option: AtOption) => {
      if (option.type === "agent") {
        handleAgentSelect(option);
      } else if (option.type === "file") {
        handleFileMentionSelect(option);
      } else if (option.type === "resource") {
        handleResourceSelect(option);
      }
    },
    [handleAgentSelect, handleFileMentionSelect, handleResourceSelect]
  );

  // 处理 / 命令选择
  const handleCommandSelect = useCallback(
    (command: SlashCommand) => {
      // 关闭弹窗
      closeTrigger();

      if (command.type === "action") {
        // action 类型：直接执行，清空输入框
        setValue("");
        onCommand?.(command);
        focusInput();
      } else {
        // prompt 类型：写入命令名到输入框，用户继续输入参数
        // SDK 命令和内置命令行为一致：只显示 /commandName
        // template 在发送时由后端处理
        const text = `/${command.name} `;

        setValue(text);
        // 将光标移到末尾
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = text.length;
            textareaRef.current.selectionEnd = text.length;
            textareaRef.current.focus();
            handleInput();
          }
        });
      }
    },
    [closeTrigger, onCommand, focusInput, handleInput]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // 当弹窗打开时，处理键盘导航
      if (showMention || showCommand) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightedIndex((prev) => 
            prev < currentItemCount - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightedIndex((prev) => 
            prev > 0 ? prev - 1 : currentItemCount - 1
          );
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeTrigger();
          return;
        }
        // Enter 键选择当前高亮项
        if (e.key === "Enter") {
          e.preventDefault();
          if (showMention && filteredAtOptions[highlightedIndex]) {
            handleAtOptionSelect(filteredAtOptions[highlightedIndex]);
          } else if (showCommand && filteredCommands[highlightedIndex]) {
            handleCommandSelect(filteredCommands[highlightedIndex]);
          }
          return;
        }
      }
      
      // 正常的 Enter 提交
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, showMention, showCommand, currentItemCount, closeTrigger, filteredAtOptions, filteredCommands, highlightedIndex, handleAtOptionSelect, handleCommandSelect]
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
        "relative border border-border/60 rounded-2xl bg-card shadow-sm",
        "transition-all duration-200",
        "focus-within:shadow-md focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10",
        isDragging && "border-primary/50 bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 命令/提及弹窗 - opencode 风格，在输入框上方 */}
      {(showCommand || showMention) && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute inset-x-0 -top-2 -translate-y-full z-50",
            "max-h-80 min-h-10 overflow-auto",
            "flex flex-col p-1.5 rounded-lg",
            "border border-border/60 bg-popover/95 backdrop-blur-sm shadow-lg"
          )}
          onMouseDown={(e) => e.preventDefault()}
        >
          {showCommand && (
            filteredCommands.length > 0 ? (
              filteredCommands.map((cmd, index) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left",
                      "transition-colors duration-100",
                      index === highlightedIndex ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => handleCommandSelect(cmd)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">
                        /{cmd.name}
                        {cmd.source === "sdk" && cmd.sdkCommand?.mcp && (
                          <span className="ml-1 text-xs text-muted-foreground">(MCP)</span>
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground truncate">
                        {cmd.description}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground px-2.5 py-1.5">
                {isLoadingCommands ? t("common.loading") : t("chat.command.noCommandFound")}
              </div>
            )
          )}
          
          {showMention && (
            isLoadingFiles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-2.5 py-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("common.loading")}</span>
              </div>
            ) : filteredAtOptions.length > 0 ? (
              filteredAtOptions.map((option, index) => {
                // 生成唯一 key
                const key =
                  option.type === "agent"
                    ? `agent:${option.name}`
                    : option.type === "file"
                      ? `file:${option.path}`
                      : `resource:${option.uri}`;

                return (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left",
                      "transition-colors duration-100",
                      index === highlightedIndex ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => handleAtOptionSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.type === "agent" ? (
                      <>
                        <Bot className="h-4 w-4 text-blue-500 shrink-0" />
                        <span className="text-sm text-foreground">@{option.name}</span>
                      </>
                    ) : option.type === "file" ? (
                      <>
                        {option.isDirectory ? (
                          <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm text-foreground truncate">{option.display}</span>
                      </>
                    ) : (
                      <>
                        <Plug className="h-4 w-4 text-purple-500 shrink-0" />
                        <span className="text-sm text-foreground truncate">{option.display}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground truncate ml-auto">
                            {option.description}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-muted-foreground px-2.5 py-1.5">
                {t("chat.mention.noFilesFound")}
              </div>
            )
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* 附件预览区域 */}
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

      {/* @ 提及标签区域 */}
      {hasMentions && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {mentions.map((mention) => (
            <div
              key={mention.id}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md",
                "text-xs font-medium",
                "border border-border/60 bg-muted/50",
                "group"
              )}
            >
              {mention.type === "file" && (
                <>
                  <File className="h-3 w-3 text-blue-500" />
                  <span className="text-foreground truncate max-w-[120px]">
                    {mention.displayText}
                  </span>
                </>
              )}
              {mention.type === "agent" && (
                <>
                  <Bot className="h-3 w-3 text-purple-500" />
                  <span className="text-foreground">{mention.displayText}</span>
                </>
              )}
              {mention.type === "resource" && (
                <>
                  <Plug className="h-3 w-3 text-green-500" />
                  <span className="text-foreground truncate max-w-[120px]">
                    {mention.displayText}
                  </span>
                </>
              )}
              <button
                type="button"
                onClick={() => removeMention(mention.id)}
                className={cn(
                  "h-3.5 w-3.5 rounded-full",
                  "flex items-center justify-center",
                  "text-muted-foreground hover:text-destructive",
                  "opacity-0 group-hover:opacity-100",
                  "transition-opacity duration-150"
                )}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {isReadingFile && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{t("common.loading")}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-4 pb-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
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

          {agents.length > 0 && onSelectAgent && (
            <AgentSelector
              agents={agents}
              currentAgent={currentAgent}
              onSelectAgent={onSelectAgent}
              onAfterSelect={() => textareaRef.current?.focus()}
              disabled={disabled}
            />
          )}
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
              disabled={(!value.trim() && !hasAttachments && !hasMentions) || disabled}
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
