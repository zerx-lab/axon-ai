/**
 * Part 渲染组件
 * 根据消息 Part 类型渲染不同的 UI
 * 
 * 性能优化：
 * 1. DiffViewer 懒加载（仅在 edit 工具需要时加载）
 */

import { useState, lazy, Suspense } from "react";
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
} from "lucide-react";
import type {
  Part,
  TextPart,
  ToolPart,
  ReasoningPart,
  StepStartPart,
  StepFinishPart,
  ToolStateCompleted,
  ToolStateError,
  ToolStateRunning,
  AssistantMessageInfo,
} from "@/types/chat";
import { getToolDisplayName } from "@/types/chat";
import { MarkdownRenderer } from "./MarkdownRenderer";
// 懒加载 DiffViewer（减少首屏体积）
const DiffViewer = lazy(() => import("@/components/diff").then(m => ({ default: m.DiffViewer })));
const DiffStatsDisplay = lazy(() => import("@/components/diff").then(m => ({ default: m.DiffStatsDisplay })));

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
  
  // 根据状态选择图标
  const StatusIcon = getStatusIcon(state.status);
  const ToolIcon = getToolIcon(part.tool);
  
  return (
    <div className="rounded-md border border-border bg-card my-2">
      {/* 工具标题栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <ToolIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{getToolDisplayName(part.tool)}</span>
        <div className="ml-auto flex items-center gap-2">
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
      </div>
      
      {/* 工具内容 */}
      <div className="p-3">
        {state.status === "completed" && (
          <ToolCompletedContent tool={part.tool} state={state} messageInfo={messageInfo} />
        )}
        {state.status === "error" && (
          <ToolErrorContent state={state} />
        )}
        {state.status === "running" && (
          <ToolRunningContent tool={part.tool} state={state} />
        )}
        {state.status === "pending" && (
          <div className="text-sm text-muted-foreground">等待执行...</div>
        )}
      </div>
    </div>
  );
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
        <TaskToolContent state={state} />
      );
    default:
      return (
        <DefaultToolContent state={state} showOutput={showOutput} setShowOutput={setShowOutput} />
      );
  }
}

// Bash 工具内容
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
      <div className="font-mono text-sm bg-muted/50 rounded px-2 py-1 overflow-x-auto">
        <span className="text-green-600 dark:text-green-400">$</span> {command}
      </div>
      {output && (
        <CollapsibleOutput
          output={output}
          showOutput={showOutput}
          setShowOutput={setShowOutput}
          label="输出"
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

// 文件工具内容
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
  
  // 去掉工作目录前缀
  const displayPath = filePath?.startsWith(cwd) 
    ? filePath.slice(cwd.length + 1) 
    : filePath;
  
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
      
      {/* 其他工具使用原来的折叠输出 */}
      {!hasFileDiff && content && (
        <CollapsibleOutput
          output={content}
          showOutput={showContent}
          setShowOutput={setShowContent}
          label={tool === "read" ? "预览" : tool === "write" ? "内容" : "差异"}
          isCode
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

// Task 工具内容
function TaskToolContent({ state }: { state: ToolStateCompleted }) {
  const [showOutput, setShowOutput] = useState(false);
  const description = state.input.description as string;
  const prompt = state.input.prompt as string;
  
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{description}</div>
      {prompt && (
        <div className="text-sm text-muted-foreground italic">
          &ldquo;{prompt}&rdquo;
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

// 默认工具内容
function DefaultToolContent({
  state,
  showOutput,
  setShowOutput,
}: {
  state: ToolStateCompleted;
  showOutput: boolean;
  setShowOutput: (v: boolean) => void;
}) {
  // 显示输入参数
  const inputEntries = Object.entries(state.input).filter(
    ([key]) => !["raw"].includes(key)
  );
  
  return (
    <div className="space-y-2">
      {inputEntries.length > 0 && (
        <div className="text-sm space-y-1">
          {inputEntries.slice(0, 3).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-mono truncate">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </span>
            </div>
          ))}
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

// 运行中内容
function ToolRunningContent({ tool, state }: { tool: string; state: ToolStateRunning }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{state.title || `正在执行 ${getToolDisplayName(tool)}...`}</span>
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
}

function CollapsibleOutput({
  output,
  showOutput,
  setShowOutput,
  label = "输出",
  isCode = false,
}: CollapsibleOutputProps) {
  const lines = output.split("\n").length;
  const shouldCollapse = lines > 5;
  
  if (!shouldCollapse) {
    return (
      <pre className={cn(
        "text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words",
        isCode && "font-mono"
      )}>
        {output}
      </pre>
    );
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
        <pre className={cn(
          "text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto",
          isCode && "font-mono"
        )}>
          {output}
        </pre>
      )}
    </div>
  );
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
