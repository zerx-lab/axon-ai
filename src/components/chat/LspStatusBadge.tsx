/**
 * LSP 状态徽章组件
 * 
 * 在聊天区域显示当前项目的 LSP 服务器状态
 * 设计为紧凑的内联徽章，适合放在输入框上方
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Code2, CheckCircle2, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLspStatus, type LspServer } from "@/hooks";

/**
 * 获取语言显示名和颜色
 */
function getLanguageInfo(name: string): { displayName: string; color: string; bgColor: string } {
  const lowerName = name.toLowerCase();
  
  // 常见语言配置
  const languages: Record<string, { displayName: string; color: string; bgColor: string }> = {
    typescript: { displayName: "TS", color: "text-blue-600", bgColor: "bg-blue-500/10" },
    tsserver: { displayName: "TS", color: "text-blue-600", bgColor: "bg-blue-500/10" },
    javascript: { displayName: "JS", color: "text-yellow-600", bgColor: "bg-yellow-500/10" },
    go: { displayName: "Go", color: "text-cyan-600", bgColor: "bg-cyan-500/10" },
    gopls: { displayName: "Go", color: "text-cyan-600", bgColor: "bg-cyan-500/10" },
    rust: { displayName: "Rust", color: "text-orange-600", bgColor: "bg-orange-500/10" },
    python: { displayName: "Py", color: "text-green-600", bgColor: "bg-green-500/10" },
    pyright: { displayName: "Py", color: "text-green-600", bgColor: "bg-green-500/10" },
    pylsp: { displayName: "Py", color: "text-green-600", bgColor: "bg-green-500/10" },
    clang: { displayName: "C++", color: "text-purple-600", bgColor: "bg-purple-500/10" },
    lua: { displayName: "Lua", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    json: { displayName: "JSON", color: "text-amber-600", bgColor: "bg-amber-500/10" },
    css: { displayName: "CSS", color: "text-pink-600", bgColor: "bg-pink-500/10" },
    html: { displayName: "HTML", color: "text-red-600", bgColor: "bg-red-500/10" },
    yaml: { displayName: "YAML", color: "text-rose-600", bgColor: "bg-rose-500/10" },
  };

  // 尝试匹配
  for (const [key, info] of Object.entries(languages)) {
    if (lowerName.includes(key)) {
      return info;
    }
  }

  // 默认
  return { 
    displayName: name.slice(0, 2).toUpperCase(), 
    color: "text-muted-foreground", 
    bgColor: "bg-muted/50" 
  };
}

interface LspBadgeProps {
  server: LspServer;
}

/**
 * 单个 LSP 徽章
 */
function LspBadge({ server }: LspBadgeProps) {
  const { t } = useTranslation();
  const langInfo = getLanguageInfo(server.name);
  const isConnected = server.status === "connected";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
              "text-[10px] font-medium cursor-default",
              "border transition-colors duration-150",
              isConnected 
                ? [langInfo.bgColor, langInfo.color, "border-transparent"]
                : "bg-red-500/10 text-red-500 border-red-500/20"
            )}
          >
            {/* 状态指示点 */}
            <span
              className={cn(
                "w-1 h-1 rounded-full",
                isConnected ? "bg-green-500" : "bg-red-500"
              )}
            />
            {/* 语言名 */}
            <span>{langInfo.displayName}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              <span className="font-medium">{server.name}</span>
            </div>
            <div className="text-muted-foreground text-[10px] font-mono truncate max-w-[200px]">
              {server.root}
            </div>
            <div className={cn(
              "text-[10px]",
              isConnected ? "text-green-500" : "text-red-500"
            )}>
              {isConnected 
                ? t("statusBar.lspConnectedHint", "已连接") 
                : t("statusBar.lspErrorHint", "连接失败")}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LspStatusBadgeProps {
  /** 项目目录，用于筛选 LSP */
  directory?: string;
  /** 自定义类名 */
  className?: string;
  /** 最大显示数量 */
  maxDisplay?: number;
}

/**
 * LSP 状态徽章组
 * 
 * 显示当前项目的 LSP 服务器状态
 */
export function LspStatusBadge({ 
  directory, 
  className,
  maxDisplay = 5,
}: LspStatusBadgeProps) {
  const { t } = useTranslation();
  const { servers, stats } = useLspStatus(directory);

  // 按状态排序：连接的在前，错误的在后
  const sortedServers = useMemo(() => {
    return [...servers].sort((a, b) => {
      if (a.status === "connected" && b.status !== "connected") return -1;
      if (a.status !== "connected" && b.status === "connected") return 1;
      return 0;
    });
  }, [servers]);

  // 截取显示
  const displayServers = sortedServers.slice(0, maxDisplay);
  const hiddenCount = servers.length - displayServers.length;

  // 如果没有 LSP 服务器，不显示
  if (stats.total === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {/* LSP 图标标签 */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mr-1">
        <Code2 className="h-3 w-3" />
        <span>LSP</span>
      </div>

      {/* 服务器徽章 */}
      {displayServers.map((server) => (
        <LspBadge key={server.id} server={server} />
      ))}

      {/* 隐藏数量提示 */}
      {hiddenCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground/50 px-1">
                +{hiddenCount}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("statusBar.lspMoreServers", "还有 {{count}} 个服务器", { count: hiddenCount })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
