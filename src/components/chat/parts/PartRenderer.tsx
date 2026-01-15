/**
 * Part 渲染组件
 * 根据消息 Part 类型渲染不同的 UI
 * 
 * 性能优化：
 * 1. DiffViewer 懒加载（仅在 edit 工具需要时加载）
 */

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Terminal,
  FileText,
  FileEdit,
  FilePlus,
  Search,
  FolderSearch,
  Globe,
  ListTodo,
  Bot,
  Brain,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Columns2,
  Rows2,
  ShieldAlert,
  Check,
  X,
  Zap,
} from "lucide-react";
import type {
  Part,
  TextPart,
  FilePart,
  ToolPart,
  ReasoningPart,
  StepStartPart,
  StepFinishPart,
  ToolStateCompleted,
  ToolStateError,
  ToolStateRunning,
  AssistantMessageInfo,
  PermissionRequest,
  PermissionReply,
} from "@/types/chat";
import { getToolDisplayName } from "@/types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useShallow } from "zustand/react/shallow";
import { usePermissionStore } from "@/stores/permission";
import { useQuestionStore } from "@/stores/question";
import { useSubagentPanelStore, type SubagentTab } from "@/stores/subagentPanel";
import { useOpencode } from "@/hooks/useOpencode";
import { QuestionPrompt } from "../QuestionPrompt";

const DiffViewer = lazy(() => import("@/components/diff").then(m => ({ default: m.DiffViewer })));
const DiffStatsDisplay = lazy(() => import("@/components/diff").then(m => ({ default: m.DiffStatsDisplay })));
const CodeBlock = lazy(() => import("./CodeBlock"));
const CollapsibleCodeViewer = lazy(() => import("./CollapsibleCodeViewer").then(m => ({ default: m.CollapsibleCodeViewer })));

// ============== Part 渲染器 ==============

interface PartRendererProps {
  part: Part;
  messageInfo: AssistantMessageInfo;
  isLast?: boolean;
}

/**
 * Part 渲染器 - 根据 Part 类型分发到具体组件
 */
export function PartRenderer({ part, messageInfo, isLast }: PartRendererProps) {
  switch (part.type) {
    case "text":
      return <TextPartView part={part} />;
    case "file":
      return <FilePartView part={part} />;
    case "reasoning":
      return <ReasoningPartView part={part} />;
    case "tool":
      return <ToolPartView part={part} messageInfo={messageInfo} />;
    case "step-start":
      return <StepStartPartView part={part} messageInfo={messageInfo} />;
    case "step-finish":
      return isLast ? <StepFinishPartView part={part} /> : null;
    default:
      return null;
  }
}

// ============== Text Part ==============

interface TextPartViewProps {
  part: TextPart;
}

function TextPartView({ part }: TextPartViewProps) {
  if (!part.text || part.ignored) return null;
  
  return <MarkdownRenderer content={part.text} />;
}

// ============== File Part ==============

interface FilePartViewProps {
  part: FilePart;
}

/**
 * 文件附件渲染组件
 * 支持图片预览和 PDF 文件显示
 */
function FilePartView({ part }: FilePartViewProps) {
  const isImage = part.mime.startsWith("image/");
  const isPdf = part.mime === "application/pdf";
  
  if (isImage) {
    return (
      <div className="my-2">
        <img
          src={part.url}
          alt={part.filename || "附件图片"}
          className="max-w-xs max-h-64 rounded-md border border-border object-contain"
        />
        {part.filename && (
          <div className="text-xs text-muted-foreground mt-1">{part.filename}</div>
        )}
      </div>
    );
  }
  
  if (isPdf) {
    return (
      <div className="my-2 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 w-fit">
        <FileText className="h-5 w-5 text-red-500 shrink-0" />
        <span className="text-sm">{part.filename || "PDF 文件"}</span>
      </div>
    );
  }
  
  // 其他文件类型
  return (
    <div className="my-2 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 w-fit">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <span className="text-sm">{part.filename || "附件"}</span>
      <span className="text-xs text-muted-foreground">({part.mime})</span>
    </div>
  );
}

// ============== Reasoning Part ==============

interface ReasoningPartViewProps {
  part: ReasoningPart;
}

function ReasoningPartView({ part }: ReasoningPartViewProps) {
  const [expanded, setExpanded] = useState(false);

  if (!part.text) return null;

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Brain className="h-4 w-4" />
        <span>思考中...</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 ml-auto" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
          {part.text}
        </div>
      )}
    </div>
  );
}

// ============== Step Start Part ==============

interface StepStartPartViewProps {
  part: StepStartPart;
  messageInfo: AssistantMessageInfo;
}

function StepStartPartView({ messageInfo }: StepStartPartViewProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
      <Sparkles className="h-3 w-3" />
      <span>{messageInfo.providerID}</span>
      <span className="text-muted-foreground/50">/</span>
      <span>{messageInfo.modelID}</span>
    </div>
  );
}

// ============== Step Finish Part ==============

interface StepFinishPartViewProps {
  part: StepFinishPart;
}

function StepFinishPartView({ part }: StepFinishPartViewProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 mt-2">
      <CheckCircle2 className="h-3 w-3 text-green-500" />
      <span>
        {part.tokens.input} 输入 / {part.tokens.output} 输出 tokens
      </span>
      {part.cost > 0 && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span>${part.cost.toFixed(4)}</span>
        </>
      )}
    </div>
  );
}

// ============== Tool Part ==============

interface ToolPartViewProps {
  part: ToolPart;
  messageInfo: AssistantMessageInfo;
}

function ToolPartView({ part, messageInfo }: ToolPartViewProps) {
  const { state } = part;
  const { client } = useOpencode();
  
  // 获取与当前工具调用相关的权限请求 - 使用 useShallow 避免无限循环
  const pendingRequests = usePermissionStore(
    useShallow((s) => s.pendingRequests[messageInfo.sessionID] || [])
  );
  
  // 获取与当前工具调用相关的 question 请求
  const pendingQuestions = useQuestionStore(
    useShallow((s) => s.pendingRequests[messageInfo.sessionID] || [])
  );
  
  // 查找匹配当前工具调用的权限请求
  const permission = pendingRequests.find(
    (p) => p.tool?.callID === part.callID
  );
  
  // 查找匹配当前工具调用的 question 请求
  const question = pendingQuestions.find(
    (q) => q.tool?.callID === part.callID
  );
  
  // 使用 useMemo 缓存 permission.id 和 question.id 避免不必要的重渲染
  const permissionId = permission?.id;
  const questionId = question?.id;
  
  // 延迟显示权限提示（避免闪烁）
  const [showPermission, setShowPermission] = useState(false);
  useEffect(() => {
    if (permissionId) {
      const timeout = setTimeout(() => setShowPermission(true), 50);
      return () => clearTimeout(timeout);
    } else {
      setShowPermission(false);
    }
  }, [permissionId]);
  
  // 延迟显示 question 提示（避免闪烁）
  const [showQuestion, setShowQuestion] = useState(false);
  useEffect(() => {
    if (questionId) {
      const timeout = setTimeout(() => setShowQuestion(true), 50);
      return () => clearTimeout(timeout);
    } else {
      setShowQuestion(false);
    }
  }, [questionId]);
  
  // 如果有权限请求或 question 请求，强制展开
  const [forceExpanded, setForceExpanded] = useState(false);
  useEffect(() => {
    if (permissionId || questionId) {
      setForceExpanded(true);
    }
  }, [permissionId, questionId]);
  
  // 默认收起状态（已完成的工具）
  const [expanded, setExpanded] = useState(state.status !== "completed");
  const isExpanded = expanded || forceExpanded;
  
  // 获取权限请求的 directory（用于权限回复）
  const permissionDirectory = permission?.directory;
  
  // 处理权限回复
  const handlePermissionRespond = useCallback(async (response: PermissionReply) => {
    if (!permissionId || !client) {
      console.warn("[Permission] 缺少必要参数:", { permissionId, hasClient: !!client });
      return;
    }
    
    const store = usePermissionStore.getState();
    if (store.hasResponded(permissionId)) {
      console.log("[Permission] 已响应过此请求:", permissionId);
      return;
    }
    
    store.markResponded(permissionId);
    
    console.log("[Permission] 发送权限回复:", { 
      requestID: permissionId, 
      reply: response,
      directory: permissionDirectory,
      sessionID: messageInfo.sessionID
    });
    
    try {
      const result = await client.permission.reply({
        requestID: permissionId,
        reply: response,
        directory: permissionDirectory,
      });
      
      console.log("[Permission] 回复成功:", result);
      
      store.removeRequest(permissionId, messageInfo.sessionID);
    } catch (error) {
      console.error("[Permission] 回复失败:", error);
    }
  }, [permissionId, client, messageInfo.sessionID, permissionDirectory]);
  
  const handleQuestionReply = useCallback(async (answers: import("@/types/chat").QuestionAnswer[]) => {
    if (!question || !client) {
      console.warn("[Question] 缺少必要参数:", { hasQuestion: !!question, hasClient: !!client });
      return;
    }
    
    const store = useQuestionStore.getState();
    if (store.hasResponded(question.id)) {
      console.log("[Question] 已响应过此请求:", question.id);
      return;
    }
    
    store.markResponded(question.id);
    
    // 立即隐藏 Question 组件，不等待服务器确认
    setShowQuestion(false);
    
    console.log("[Question] 发送回复:", {
      requestID: question.id,
      answers,
      sessionID: messageInfo.sessionID,
    });
    
    try {
      await client.question.reply({
        requestID: question.id,
        answers,
        directory: question.directory,
      });
      
      console.log("[Question] 回复成功");
      
      // 从 store 中移除请求（即使没有收到 SSE 确认）
      store.removeRequest(question.id, messageInfo.sessionID);
    } catch (error) {
      console.error("[Question] 回复失败:", error);
      // 恢复显示，允许重试
      setShowQuestion(true);
      // 清除已响应标记，允许重新提交
      store.clearResponded(question.id);
    }
  }, [question, client, messageInfo.sessionID]);
  
  const handleQuestionReject = useCallback(async () => {
    if (!question || !client) {
      console.warn("[Question] 缺少必要参数:", { hasQuestion: !!question, hasClient: !!client });
      return;
    }
    
    const store = useQuestionStore.getState();
    if (store.hasResponded(question.id)) {
      console.log("[Question] 已响应过此请求:", question.id);
      return;
    }
    
    store.markResponded(question.id);
    setShowQuestion(false);
    
    console.log("[Question] 拒绝请求:", {
      requestID: question.id,
      sessionID: messageInfo.sessionID,
    });
    
    try {
      await client.question.reject({
        requestID: question.id,
        directory: question.directory,
      });
      
      console.log("[Question] 拒绝成功");
      store.removeRequest(question.id, messageInfo.sessionID);
    } catch (error) {
      console.error("[Question] 拒绝失败:", error);
      setShowQuestion(true);
    }
  }, [question, client, messageInfo.sessionID]);
  
  const StatusIcon = getStatusIcon(state.status);
  const ToolIcon = getToolIcon(part.tool);
  
  // 判断是否可收起（只有已完成和错误状态才可收起）
  const canCollapse = state.status === "completed" || state.status === "error";
  
  return (
    <div className={cn(
      "rounded-md border bg-card my-2",
      permission ? "border-amber-500/50" : "border-border"
    )}>
      {/* 工具标题栏 - 可点击切换展开/收起 */}
      <button
        onClick={() => canCollapse && setExpanded(!expanded)}
        disabled={!canCollapse}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 bg-muted/30 text-left transition-colors",
          canCollapse && "hover:bg-muted/50 cursor-pointer",
          !canCollapse && "cursor-default",
          isExpanded && "border-b border-border"
        )}
      >
        {/* 展开/收起指示器 */}
        {canCollapse ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-3" /> // 占位保持对齐
        )}
        <ToolIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{getToolDisplayName(part.tool)}</span>
        <div className="ml-auto flex items-center gap-2">
          {permission && (
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          )}
          <StatusIcon
            className={cn(
              "h-4 w-4",
              state.status === "completed" && "text-green-500",
              state.status === "error" && "text-destructive",
              state.status === "running" && "text-blue-500 animate-spin",
              state.status === "pending" && "text-muted-foreground"
            )}
          />
        </div>
      </button>
      
      {/* 工具内容 - 根据展开状态显示 */}
      {isExpanded && (
        <div className="p-3">
          {state.status === "completed" && (
            <ToolCompletedContent tool={part.tool} state={state} messageInfo={messageInfo} />
          )}
          {state.status === "error" && (
            <ToolErrorContent state={state} />
          )}
          {state.status === "running" && (
            <ToolRunningContent tool={part.tool} state={state} messageInfo={messageInfo} />
          )}
          {state.status === "pending" && (
            <div className="text-sm text-muted-foreground">等待执行...</div>
          )}
        </div>
      )}
      
      {showPermission && permission && (
        <PermissionPromptBar 
          permission={permission} 
          onRespond={handlePermissionRespond}
        />
      )}
      
      {showQuestion && question && (
        <div className="border-t border-amber-500/30">
          <QuestionPrompt
            request={question}
            onReply={handleQuestionReply}
            onReject={handleQuestionReject}
          />
        </div>
      )}
    </div>
  );
}

// ============== 权限提示栏组件 ==============

interface PermissionPromptBarProps {
  permission: PermissionRequest;
  onRespond: (response: PermissionReply) => void;
}

/**
 * 权限提示栏 - 显示在工具卡片底部
 */
function PermissionPromptBar({ permission, onRespond }: PermissionPromptBarProps) {
  const [isResponding, setIsResponding] = useState(false);
  
  const handleRespond = useCallback((response: PermissionReply) => {
    if (isResponding) return;
    setIsResponding(true);
    onRespond(response);
  }, [isResponding, onRespond]);
  
  // 获取权限描述
  const permissionDescription = getPermissionDescription(permission);
  
  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        "bg-amber-500/10 border-t border-amber-500/30",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
    >
      {/* 权限图标和说明 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          {permissionDescription}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 拒绝 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => handleRespond("reject")}
          disabled={isResponding}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          拒绝
        </Button>

        {/* 总是允许 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => handleRespond("always")}
          disabled={isResponding}
        >
          <Zap className="h-3.5 w-3.5 mr-1" />
          总是允许
        </Button>

        {/* 允许一次 */}
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => handleRespond("once")}
          disabled={isResponding}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          允许一次
        </Button>
      </div>
    </div>
  );
}

/**
 * 获取权限请求的描述文本
 * patterns 数组通常包含具体的命令、文件路径等信息
 */
function getPermissionDescription(permission: PermissionRequest): string {
  const { permission: permType, metadata, patterns } = permission;
  // patterns 数组的第一个元素通常是具体的命令/路径
  const firstPattern = patterns?.[0] || "";
  
  switch (permType) {
    case "edit":
      return `编辑文件: ${metadata?.filepath || firstPattern || ""}`;
    case "write":
      return `写入文件: ${metadata?.filepath || firstPattern || ""}`;
    case "read":
      return `读取文件: ${metadata?.filePath || firstPattern || ""}`;
    case "bash": {
      // bash 命令：优先使用 metadata 中的描述，其次是 patterns 中的命令
      const cmd = metadata?.description || metadata?.command || firstPattern || "";
      // 截断过长的命令
      const cmdStr = String(cmd);
      const displayCmd = cmdStr.length > 100 ? cmdStr.slice(0, 100) + "..." : cmdStr;
      return `执行命令: ${displayCmd}`;
    }
    case "glob":
      return `搜索文件: ${metadata?.pattern || firstPattern || ""}`;
    case "grep":
      return `搜索内容: ${metadata?.pattern || firstPattern || ""}`;
    case "webfetch":
      return `访问网址: ${metadata?.url || firstPattern || ""}`;
    case "websearch":
      return `网页搜索: ${metadata?.query || firstPattern || ""}`;
    case "task":
      return `执行任务: ${metadata?.description || firstPattern || ""}`;
    case "external_directory":
      return `访问外部目录: ${metadata?.parentDir || metadata?.filepath || metadata?.path || firstPattern || ""}`;
    case "doom_loop":
      return "继续执行（多次失败后）";
    default:
      // 对于未知权限类型，也尝试显示 patterns 内容
      return firstPattern ? `${permType}: ${firstPattern}` : `需要权限: ${permType}`;
  }
}

// ============== Tool Content Components ==============

interface ToolCompletedContentProps {
  tool: string;
  state: ToolStateCompleted;
  messageInfo: AssistantMessageInfo;
}

function ToolCompletedContent({ tool, state, messageInfo }: ToolCompletedContentProps) {
  const [showOutput, setShowOutput] = useState(false);
  
  // 根据工具类型渲染不同内容
  switch (tool) {
    case "bash":
      return (
        <BashToolContent state={state} />
      );
    case "read":
    case "write":
    case "edit":
      return (
        <FileToolContent tool={tool} state={state} messageInfo={messageInfo} />
      );
    case "glob":
    case "grep":
      return (
        <SearchToolContent state={state} />
      );
    case "todowrite":
      return (
        <TodoToolContent state={state} />
      );
    case "task":
      return (
        <TaskToolContent state={state} messageInfo={messageInfo} />
      );
    default:
      return (
        <DefaultToolContent state={state} showOutput={showOutput} setShowOutput={setShowOutput} />
      );
  }
}

function BashToolContent({ state }: { state: ToolStateCompleted }) {
  const [showOutput, setShowOutput] = useState(false);
  const command = state.input.command as string;
  const output = state.metadata?.output as string || state.output;
  const description = state.metadata?.description as string;
  
  return (
    <div className="space-y-2">
      {description && (
        <div className="text-sm text-muted-foreground">{description}</div>
      )}
      <Suspense
        fallback={
          <div className="font-mono text-sm bg-muted/50 rounded px-2 py-1 overflow-x-auto">
            <span className="text-green-600 dark:text-green-400">$</span> {command}
          </div>
        }
      >
        <CodeBlock code={`$ ${command}`} language="bash" />
      </Suspense>
      {output && (
        <CollapsibleOutput
          output={output}
          showOutput={showOutput}
          setShowOutput={setShowOutput}
          label="输出"
          language="bash"
        />
      )}
    </div>
  );
}

// 文件差异数据结构（与 opencode 一致）
interface FileDiffData {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
}

// multiedit 工具的单个 edit 结果
interface EditResultMetadata {
  diff?: string;
  filediff?: FileDiffData;
  diagnostics?: Record<string, unknown>;
}

// multiedit 工具的 metadata 结构
interface MultiEditMetadata {
  results: EditResultMetadata[];
}

// 从 multiedit 结果中提取合并的差异数据
function extractMultiEditDiff(metadata: MultiEditMetadata): FileDiffData | null {
  const results = metadata.results;
  if (!results || results.length === 0) return null;
  
  // 获取第一个有效的 filediff（作为 before 来源）
  const firstResult = results[0];
  // 获取最后一个有效的 filediff（作为 after 来源）
  const lastResult = results[results.length - 1];
  
  if (!firstResult?.filediff || !lastResult?.filediff) return null;
  
  // 累加所有的 additions 和 deletions
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const result of results) {
    if (result.filediff) {
      totalAdditions += result.filediff.additions;
      totalDeletions += result.filediff.deletions;
    }
  }
  
  return {
    file: firstResult.filediff.file,
    before: firstResult.filediff.before,
    after: lastResult.filediff.after,
    additions: totalAdditions,
    deletions: totalDeletions,
  };
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    html: "html", css: "css", scss: "scss", json: "json", xml: "xml",
    yaml: "yaml", yml: "yaml", toml: "toml", md: "markdown",
    rs: "rust", go: "go", py: "python", rb: "ruby", java: "java",
    c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
    sh: "bash", bash: "bash", zsh: "bash", sql: "sql",
  };
  return languageMap[ext] || "text";
}

function FileToolContent({ 
  tool, 
  state, 
  messageInfo 
}: { 
  tool: string; 
  state: ToolStateCompleted;
  messageInfo: AssistantMessageInfo;
}) {
  const [showContent, setShowContent] = useState(false);
  const [diffMode, setDiffMode] = useState<"split" | "unified">("split");
  const filePath = state.input.filePath as string;
  const cwd = messageInfo.path?.cwd || "";
  
  const displayPath = filePath?.startsWith(cwd) 
    ? filePath.slice(cwd.length + 1) 
    : filePath;
  
  const fileLanguage = filePath ? getLanguageFromPath(filePath) : "text";
  
  // 获取 filediff 数据
  // - edit 工具: 直接从 metadata.filediff 获取
  // - multiedit 工具: 从 metadata.results 数组中提取合并的差异
  const fileDiff = tool === "edit" 
    ? (state.metadata?.filediff as FileDiffData | undefined)
    : tool === "multiedit"
    ? extractMultiEditDiff(state.metadata as unknown as MultiEditMetadata)
    : undefined;
  
  // 判断是否有完整的差异数据
  const hasFileDiff = (tool === "edit" || tool === "multiedit") && 
    fileDiff && 
    typeof fileDiff.before === "string" && 
    typeof fileDiff.after === "string";
  
  // 对于非 edit/multiedit 工具，使用原来的内容
  const content = tool === "read" 
    ? (state.metadata?.preview as string || state.output)
    : tool === "write"
    ? (state.input.content as string)
    : (state.metadata?.diff as string);
  
  return (
    <div className="space-y-2">
      {/* 文件路径和差异统计 */}
      <div className="flex items-center gap-2 justify-between">
        <span className="text-sm font-medium text-muted-foreground truncate">
          {displayPath}
        </span>
        {hasFileDiff && (
          <div className="flex items-center gap-2">
            <Suspense fallback={<span className="text-xs text-muted-foreground">...</span>}>
              <DiffStatsDisplay 
                additions={fileDiff.additions} 
                deletions={fileDiff.deletions} 
              />
            </Suspense>
            {/* 视图模式切换 */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 rounded-none text-xs",
                  diffMode === "split" && "bg-accent"
                )}
                onClick={() => setDiffMode("split")}
                title="分栏视图"
              >
                <Columns2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 px-2 rounded-none text-xs",
                  diffMode === "unified" && "bg-accent"
                )}
                onClick={() => setDiffMode("unified")}
                title="统一视图"
              >
                <Rows2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* edit 工具使用 DiffViewer */}
      {hasFileDiff && (
        <Suspense fallback={
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            加载差异视图...
          </div>
        }>
          <DiffViewer
            oldText={fileDiff.before}
            newText={fileDiff.after}
            fileName={displayPath}
            mode={diffMode}
            showHeader={false}
            showLineNumbers={true}
            contextLines={3}
          />
        </Suspense>
      )}
      
      {!hasFileDiff && content && (
        <CollapsibleOutput
          output={content}
          showOutput={showContent}
          setShowOutput={setShowContent}
          label={tool === "read" ? "预览" : tool === "write" ? "内容" : "差异"}
          language={fileLanguage}
        />
      )}
    </div>
  );
}

// 搜索工具内容
function SearchToolContent({ state }: { state: ToolStateCompleted }) {
  const [showResults, setShowResults] = useState(false);
  const pattern = state.input.pattern as string;
  const count = (state.metadata?.matches || state.metadata?.count || 0) as number;
  
  return (
    <div className="space-y-2">
      <div className="text-sm">
        <span className="text-muted-foreground">搜索: </span>
        <span className="font-mono">&ldquo;{pattern}&rdquo;</span>
        <span className="text-muted-foreground ml-2">
          ({count} {count === 1 ? "个结果" : "个结果"})
        </span>
      </div>
      {state.output && count > 0 && (
        <CollapsibleOutput
          output={state.output}
          showOutput={showResults}
          setShowOutput={setShowResults}
          label="结果"
        />
      )}
    </div>
  );
}

// Todo 工具内容
interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
}

function TodoToolContent({ state }: { state: ToolStateCompleted }) {
  const todos = (state.input.todos || []) as TodoItem[];
  
  if (todos.length === 0) return null;
  
  return (
    <ul className="space-y-1">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className={cn(
            "flex items-center gap-2 text-sm",
            todo.status === "completed" && "text-muted-foreground line-through",
            todo.status === "in_progress" && "text-blue-600 dark:text-blue-400"
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              todo.status === "completed" && "bg-green-500",
              todo.status === "in_progress" && "bg-blue-500",
              todo.status === "pending" && "bg-muted-foreground"
            )}
          />
          {todo.content}
        </li>
      ))}
    </ul>
  );
}

// Task 工具内容 - 增强版，支持点击打开 Subagent 面板
function TaskToolContent({
  state,
  messageInfo
}: {
  state: ToolStateCompleted;
  messageInfo: AssistantMessageInfo;
}) {
  const [showOutput, setShowOutput] = useState(false);
  const { openPanel, activeTabId, hasTab, updateTabStatus, tabs } = useSubagentPanelStore();

  const description = state.input.description as string;
  const prompt = state.input.prompt as string;
  const subagentType = (state.input.subagent_type as string) || "general";
  const sessionId = state.metadata?.sessionId as string | undefined;
  const summary = state.metadata?.summary as Array<{
    id: string;
    tool: string;
    state: { status: string; title?: string };
  }> | undefined;

  // 获取当前执行的工具（最后一个非 pending 的）
  const currentTool = summary?.filter((s: { state: { status: string } }) => s.state.status !== "pending").pop();
  const toolCallCount = summary?.length ?? 0;

  // 获取 tab 中的状态（如果存在）
  // 这允许我们通过 SSE session.status 事件更新状态
  const tabInfo = sessionId ? tabs.find(t => t.sessionId === sessionId) : null;

  // 判断任务状态
  // 优先使用 tab 的状态（如果 tab 显示已完成或出错）
  // 然后使用 metadata.completed 或最后一个工具的状态
  const isCompletedFromTab = tabInfo?.status === "completed";
  const hasErrorFromTab = tabInfo?.status === "error";
  const isCompleted = isCompletedFromTab || state.metadata?.completed === true || currentTool?.state.status === "completed";
  const hasError = hasErrorFromTab || summary?.some((s) => s.state.status === "error");
  const taskStatus: "running" | "completed" | "error" = hasError
    ? "error"
    : isCompleted
      ? "completed"
      : "running";

  // 是否是当前激活的标签
  const isActive = sessionId ? activeTabId === sessionId : false;

  // 同步状态到 subagentPanel store（实时更新面板中的 tab 状态）
  useEffect(() => {
    if (sessionId && hasTab(sessionId)) {
      updateTabStatus(sessionId, taskStatus, toolCallCount);
    }
  }, [sessionId, taskStatus, toolCallCount, hasTab, updateTabStatus]);

  // 预计算标签数据，减少 handleClick 的依赖项
  const tabData = useMemo((): SubagentTab | null => {
    if (!sessionId) return null;
    return {
      sessionId,
      parentSessionId: messageInfo.sessionID,
      description,
      subagentType,
      status: taskStatus,
      toolCallCount,
      createdAt: Date.now(),
    };
  }, [sessionId, messageInfo.sessionID, description, subagentType, taskStatus, toolCallCount]);

  // 点击打开面板
  const handleClick = useCallback(() => {
    if (tabData) {
      openPanel(tabData);
    }
  }, [tabData, openPanel]);

  // 格式化工具名称
  const formatToolName = (tool: string) => {
    return tool.charAt(0).toUpperCase() + tool.slice(1);
  };

  return (
    <div
      onClick={sessionId ? handleClick : undefined}
      className={cn(
        "space-y-2 p-3 -mx-3 -my-2 rounded-md transition-colors duration-150",
        sessionId && "cursor-pointer",
        sessionId && (isActive
          ? "bg-primary/5 border border-primary/30"
          : "hover:bg-accent/30")
      )}
    >
      {/* 头部：描述 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className={cn(
            "h-4 w-4",
            taskStatus === "running" && "text-blue-500",
            taskStatus === "completed" && "text-green-500",
            taskStatus === "error" && "text-destructive"
          )} />
          <span className="text-sm font-medium">{description}</span>
        </div>

        {/* 状态指示 */}
        {taskStatus === "running" ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        ) : taskStatus === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </div>

      {/* 提示词 */}
      {prompt && (
        <div className="text-sm text-muted-foreground italic pl-6">
          &ldquo;{prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt}&rdquo;
        </div>
      )}

      {/* 当前执行的工具 */}
      {currentTool && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
          <span className="text-muted-foreground/70">└</span>
          <span className={cn(
            currentTool.state.status === "error" && "text-destructive"
          )}>
            {formatToolName(currentTool.tool)}
          </span>
          {currentTool.state.title && (
            <span className="truncate max-w-[200px]">{currentTool.state.title}</span>
          )}
        </div>
      )}

      {/* 底部统计 + 查看详情 */}
      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground pl-6">
        <span>
          {toolCallCount} 工具调用
          <span className="mx-1.5 text-muted-foreground/50">·</span>
          {taskStatus === "completed" ? "已完成" : taskStatus === "error" ? "出错" : "执行中"}
        </span>
        {sessionId && (
          <span className={cn(
            "text-primary/70",
            isActive && "text-primary"
          )}>
            查看详情 →
          </span>
        )}
      </div>

      {/* 输出（如果没有 sessionId，显示原有的输出） */}
      {!sessionId && state.output && (
        <div className="mt-2">
          <CollapsibleOutput
            output={state.output}
            showOutput={showOutput}
            setShowOutput={setShowOutput}
            label="输出"
          />
        </div>
      )}
    </div>
  );
}

function DefaultToolContent({
  state,
  showOutput,
  setShowOutput,
}: {
  state: ToolStateCompleted;
  showOutput: boolean;
  setShowOutput: (v: boolean) => void;
}) {
  const inputEntries = Object.entries(state.input).filter(
    ([key]) => !["raw"].includes(key)
  );

  const isComplexValue = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null) return false;
    const jsonStr = JSON.stringify(value);
    return jsonStr.length > 80 || Array.isArray(value);
  };
  
  return (
    <div className="space-y-2">
      {inputEntries.length > 0 && (
        <div className="text-sm space-y-2">
          {inputEntries.slice(0, 5).map(([key, value]) => {
            if (isComplexValue(value)) {
              return (
                <div key={key} className="space-y-1">
                  <span className="text-muted-foreground">{key}:</span>
                  <Suspense
                    fallback={
                      <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto font-mono">
                        {JSON.stringify(value, null, 2).slice(0, 200)}...
                      </pre>
                    }
                  >
                    <CollapsibleCodeViewer
                      content={JSON.stringify(value, null, 2)}
                      language="json"
                      maxCollapsedLines={6}
                    />
                  </Suspense>
                </div>
              );
            }
            return (
              <div key={key} className="flex gap-2">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-mono break-all">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {state.output && (
        <CollapsibleOutput
          output={state.output}
          showOutput={showOutput}
          setShowOutput={setShowOutput}
          label="输出"
        />
      )}
    </div>
  );
}

// 错误内容
function ToolErrorContent({ state }: { state: ToolStateError }) {
  return (
    <div className="flex items-start gap-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span className="break-words">{state.error}</span>
    </div>
  );
}

/**
 * 从工具 input 中提取有意义的描述信息
 * 根据不同工具类型返回具体的命令/文件路径等
 */
function getToolInputDescription(tool: string, input: Record<string, unknown>): string | null {
  switch (tool) {
    case "bash":
      // bash 工具显示具体命令或描述
      if (input.description && typeof input.description === "string") {
        return input.description;
      }
      if (input.command && typeof input.command === "string") {
        // 截断过长的命令
        const cmd = input.command as string;
        return cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd;
      }
      break;
    case "read":
    case "write":
    case "edit":
    case "multiedit":
    case "patch":
      // 文件操作显示文件路径
      if (input.filePath && typeof input.filePath === "string") {
        return input.filePath as string;
      }
      if (input.path && typeof input.path === "string") {
        return input.path as string;
      }
      break;
    case "glob":
      // 文件搜索显示模式
      if (input.pattern && typeof input.pattern === "string") {
        return `模式: ${input.pattern}`;
      }
      break;
    case "grep":
      // 内容搜索显示模式
      if (input.pattern && typeof input.pattern === "string") {
        return `搜索: ${input.pattern}`;
      }
      break;
    case "task":
      // 子任务显示描述
      if (input.description && typeof input.description === "string") {
        return input.description as string;
      }
      if (input.prompt && typeof input.prompt === "string") {
        const prompt = input.prompt as string;
        return prompt.length > 60 ? prompt.slice(0, 60) + "..." : prompt;
      }
      break;
    case "webfetch":
    case "websearch":
      // 网页获取显示 URL
      if (input.url && typeof input.url === "string") {
        return input.url as string;
      }
      if (input.query && typeof input.query === "string") {
        return input.query as string;
      }
      break;
    case "list":
      // 列出目录
      if (input.path && typeof input.path === "string") {
        return input.path as string;
      }
      break;
  }
  return null;
}

// 运行中内容
function ToolRunningContent({
  tool,
  state,
  messageInfo,
}: {
  tool: string;
  state: ToolStateRunning;
  messageInfo: AssistantMessageInfo;
}) {
  // Task 工具使用专门的组件
  if (tool === "task") {
    return <TaskToolRunningContent state={state} messageInfo={messageInfo} />;
  }

  // 优先使用 title，否则从 input 中提取具体描述
  const inputDescription = getToolInputDescription(tool, state.input);
  const displayText = state.title || inputDescription
    ? `${state.title || inputDescription}`
    : `正在执行 ${getToolDisplayName(tool)}...`;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="truncate">{displayText}</span>
    </div>
  );
}

// Task 工具运行中内容 - 支持点击打开 Subagent 面板
function TaskToolRunningContent({
  state,
  messageInfo
}: {
  state: ToolStateRunning;
  messageInfo: AssistantMessageInfo;
}) {
  const { openPanel, activeTabId } = useSubagentPanelStore();

  const description = state.input.description as string;
  const prompt = state.input.prompt as string;
  const subagentType = (state.input.subagent_type as string) || "general";
  // running 状态下 sessionId 可能在 metadata 中
  const sessionId = state.metadata?.sessionId as string | undefined;

  // 是否是当前激活的标签
  const isActive = sessionId ? activeTabId === sessionId : false;

  // 预计算标签数据，减少 handleClick 的依赖项
  const tabData = useMemo((): SubagentTab | null => {
    if (!sessionId) return null;
    return {
      sessionId,
      parentSessionId: messageInfo.sessionID,
      description,
      subagentType,
      status: "running" as const,
      toolCallCount: 0,
      createdAt: Date.now(),
    };
  }, [sessionId, messageInfo.sessionID, description, subagentType]);

  // 点击打开面板
  const handleClick = useCallback(() => {
    if (tabData) {
      openPanel(tabData);
    }
  }, [tabData, openPanel]);

  return (
    <div
      onClick={sessionId ? handleClick : undefined}
      className={cn(
        "space-y-2 p-3 -mx-3 -my-2 rounded-md transition-colors duration-150",
        sessionId && "cursor-pointer",
        sessionId && (isActive
          ? "bg-primary/5 border border-primary/30"
          : "hover:bg-accent/30")
      )}
    >
      {/* 头部：描述 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{description}</span>
        </div>
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      </div>

      {/* 提示词 */}
      {prompt && (
        <div className="text-sm text-muted-foreground italic pl-6">
          &ldquo;{prompt.length > 100 ? prompt.slice(0, 100) + "..." : prompt}&rdquo;
        </div>
      )}

      {/* 底部统计 + 查看详情 */}
      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground pl-6">
        <span>执行中...</span>
        {sessionId && (
          <span className={cn(
            "text-primary/70",
            isActive && "text-primary"
          )}>
            查看详情 →
          </span>
        )}
      </div>
    </div>
  );
}

// ============== 可折叠输出组件 ==============

interface CollapsibleOutputProps {
  output: string;
  showOutput: boolean;
  setShowOutput: (v: boolean) => void;
  label?: string;
  isCode?: boolean;
  language?: string;
}

function CollapsibleOutput({
  output,
  showOutput,
  setShowOutput,
  label = "输出",
  isCode = false,
  language,
}: CollapsibleOutputProps) {
  const lines = output.split("\n").length;
  const shouldCollapse = lines > 5;
  
  const isJsonContent = language === "json" || language === "json5" || isLikelyJson(output);
  const effectiveLanguage = isJsonContent ? "json" : language;
  
  if (effectiveLanguage || isJsonContent) {
    return (
      <Suspense
        fallback={
          <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
            {output.slice(0, 500)}...
          </pre>
        }
      >
        <CollapsibleCodeViewer
          content={output}
          language={effectiveLanguage}
          maxCollapsedLines={8}
          defaultExpanded={showOutput}
          title={label !== "输出" ? label : undefined}
        />
      </Suspense>
    );
  }
  
  const renderContent = (content: string) => {
    return (
      <pre className={cn(
        "text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words",
        isCode && "font-mono"
      )}>
        {content}
      </pre>
    );
  };
  
  if (!shouldCollapse) {
    return renderContent(output);
  }
  
  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setShowOutput(!showOutput)}
      >
        {showOutput ? (
          <>
            <ChevronDown className="h-3 w-3 mr-1" />
            隐藏{label}
          </>
        ) : (
          <>
            <ChevronRight className="h-3 w-3 mr-1" />
            显示{label} ({lines} 行)
          </>
        )}
      </Button>
      {showOutput && (
        <div className="max-h-96 overflow-y-auto">
          {renderContent(output)}
        </div>
      )}
    </div>
  );
}

function isLikelyJson(content: string): boolean {
  const trimmed = content.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// ============== 辅助函数 ==============

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    case "running":
      return Loader2;
    case "pending":
    default:
      return Clock;
  }
}

function getToolIcon(tool: string) {
  switch (tool) {
    case "bash":
      return Terminal;
    case "read":
      return FileText;
    case "write":
      return FilePlus;
    case "edit":
    case "multiedit":
      return FileEdit;
    case "glob":
      return FolderSearch;
    case "grep":
      return Search;
    case "webfetch":
    case "websearch":
      return Globe;
    case "todowrite":
    case "todoread":
      return ListTodo;
    case "task":
      return Bot;
    default:
      return Sparkles;
  }
}

export {
  TextPartView,
  ReasoningPartView,
  ToolPartView,
  StepStartPartView,
  StepFinishPartView,
};
