/**
 * LSP 状态按钮组件
 * 
 * 在状态栏显示 LSP 服务器连接状态
 * 点击展开详细列表
 * 设计风格：Zed-style 极简
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Code2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FolderCode,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLspStatus, type LspServer } from "@/hooks";

/**
 * 获取 LSP 服务器状态显示信息
 */
function getLspStatusInfo(server: LspServer) {
  switch (server.status) {
    case "connected":
      return {
        color: "text-green-500",
        bgColor: "bg-green-500",
        icon: CheckCircle2,
        text: "已连接",
      };
    case "error":
      return {
        color: "text-red-500",
        bgColor: "bg-red-500",
        icon: XCircle,
        text: "连接失败",
      };
    default:
      return {
        color: "text-muted-foreground",
        bgColor: "bg-muted-foreground/50",
        icon: XCircle,
        text: "未知状态",
      };
  }
}

/**
 * 获取总体状态指示器颜色
 */
function getOverallStatusColor(stats: { total: number; connected: number; error: number }) {
  if (stats.total === 0) return "bg-muted-foreground/50";
  if (stats.error > 0) return "bg-yellow-500";
  if (stats.connected === 0) return "bg-muted-foreground/50";
  return "bg-green-500";
}

/**
 * 从 LSP 名称提取简短显示名
 * 例如: "typescript-language-server" -> "TypeScript"
 *       "gopls" -> "Go"
 */
function getDisplayName(name: string): string {
  const lowerName = name.toLowerCase();
  
  // 常见 LSP 服务器映射
  const nameMap: Record<string, string> = {
    "typescript-language-server": "TypeScript",
    "tsserver": "TypeScript",
    "gopls": "Go",
    "rust-analyzer": "Rust",
    "pyright": "Python",
    "pylsp": "Python",
    "clangd": "C/C++",
    "lua-language-server": "Lua",
    "vscode-json-languageserver": "JSON",
    "vscode-css-languageserver": "CSS",
    "vscode-html-languageserver": "HTML",
    "tailwindcss-language-server": "Tailwind",
    "eslint-language-server": "ESLint",
    "yaml-language-server": "YAML",
  };

  // 尝试匹配
  for (const [key, displayName] of Object.entries(nameMap)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return displayName;
    }
  }

  // 默认：首字母大写
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * 获取 LSP 服务器图标颜色（基于语言类型）
 */
function getLanguageColor(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes("typescript") || lowerName.includes("tsserver")) {
    return "text-blue-500";
  }
  if (lowerName.includes("go")) {
    return "text-cyan-500";
  }
  if (lowerName.includes("rust")) {
    return "text-orange-500";
  }
  if (lowerName.includes("python") || lowerName.includes("py")) {
    return "text-yellow-500";
  }
  if (lowerName.includes("clang") || lowerName.includes("cpp")) {
    return "text-purple-500";
  }
  if (lowerName.includes("lua")) {
    return "text-indigo-500";
  }
  
  return "text-muted-foreground";
}

export function LspStatusButton() {
  const { t } = useTranslation();
  const { servers, stats, isLoading, refresh } = useLspStatus();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2 h-full",
            "text-muted-foreground/70 hover:text-foreground",
            "hover:bg-accent/50",
            "transition-colors duration-150"
          )}
        >
          {/* 状态指示点 */}
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              getOverallStatusColor(stats)
            )}
          />
          {/* LSP 图标 */}
          <Code2 className={cn("h-3.5 w-3.5", stats.error > 0 && "text-yellow-500")} />
          {/* 统计文本 */}
          <span className="tabular-nums">
            {stats.total > 0 ? stats.connected : 0} LSP
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={4}
        className="w-80 p-0"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
              <Code2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">
                {t("statusBar.lspServers", "Language Servers")}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {stats.connected}/{stats.total} {t("statusBar.lspConnected", "已连接")}
                </span>
                {stats.error > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-500">
                    {stats.error} {t("statusBar.lspError", "错误")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* 服务器列表 */}
        <ScrollArea className="max-h-64">
          {servers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Code2 className="h-8 w-8 mb-2 opacity-30" />
              <span className="text-xs text-center px-4">
                {t("statusBar.lspHint", "LSP 将在读取文件时自动激活")}
              </span>
            </div>
          ) : (
            <div className="py-1">
              {servers.map((server) => {
                const statusInfo = getLspStatusInfo(server);
                const displayName = getDisplayName(server.name);
                const langColor = getLanguageColor(server.name);
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={server.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      "hover:bg-accent/50 transition-colors"
                    )}
                  >
                    {/* 语言图标 */}
                    <div className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-md shrink-0",
                      "bg-muted/50 border border-border/50"
                    )}>
                      <Code2 className={cn("h-4 w-4", langColor)} />
                    </div>

                    {/* 服务器信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {displayName}
                        </span>
                        <StatusIcon className={cn("h-3 w-3", statusInfo.color)} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <FolderCode className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-[10px] text-muted-foreground/70 truncate font-mono">
                          {server.root}
                        </span>
                      </div>
                    </div>

                    {/* 状态文本 */}
                    <span className={cn(
                      "text-[10px] shrink-0 px-1.5 py-0.5 rounded",
                      server.status === "connected" 
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500"
                    )}>
                      {statusInfo.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* 底部提示 */}
        {servers.length > 0 && (
          <div className="px-3 py-2 border-t border-border/50 bg-muted/20">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t("statusBar.lspConnectedHint", "已连接")}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {t("statusBar.lspErrorHint", "连接失败")}
              </span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
