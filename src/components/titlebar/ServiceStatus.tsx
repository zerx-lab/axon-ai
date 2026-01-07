/**
 * 服务状态指示器组件
 * 显示 OpenCode 服务的连接状态
 */

import { cn } from "@/lib/utils";
import { useOpencodeContext } from "@/providers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Download,
  Radio,
  WifiOff,
} from "lucide-react";

/**
 * 获取状态图标和样式
 */
function getStatusDisplay(
  backendStatus: string,
  connectionStatus: string,
  downloadProgress?: number
): {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  pulse: boolean;
} {
  // 优先显示后端状态（下载、启动中等）
  switch (backendStatus) {
    case "uninitialized":
      return {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        label: "未初始化",
        description: "服务尚未初始化",
        color: "text-muted-foreground",
        pulse: false,
      };
    
    case "downloading":
      return {
        icon: <Download className="h-3.5 w-3.5" />,
        label: "下载中",
        description: `正在下载 OpenCode... ${downloadProgress ? `${Math.round(downloadProgress)}%` : ""}`,
        color: "text-blue-500",
        pulse: true,
      };
    
    case "starting":
      return {
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        label: "启动中",
        description: "正在启动 OpenCode 服务...",
        color: "text-yellow-500",
        pulse: false,
      };
    
    case "ready":
      // 服务已就绪但尚未启动
      return {
        icon: <Radio className="h-3.5 w-3.5" />,
        label: "就绪",
        description: "服务已就绪，等待启动",
        color: "text-yellow-500",
        pulse: false,
      };
    
    case "stopped":
      return {
        icon: <WifiOff className="h-3.5 w-3.5" />,
        label: "已停止",
        description: "服务已停止",
        color: "text-muted-foreground",
        pulse: false,
      };
    
    case "error":
      return {
        icon: <XCircle className="h-3.5 w-3.5" />,
        label: "错误",
        description: "服务发生错误",
        color: "text-destructive",
        pulse: false,
      };
    
    case "running":
      // 后端运行中，检查前端连接状态
      switch (connectionStatus) {
        case "connecting":
          return {
            icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
            label: "连接中",
            description: "正在连接到服务...",
            color: "text-yellow-500",
            pulse: false,
          };
        
        case "connected":
          return {
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            label: "已连接",
            description: "服务运行正常",
            color: "text-green-500",
            pulse: false,
          };
        
        case "error":
          return {
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            label: "连接失败",
            description: "无法连接到服务",
            color: "text-destructive",
            pulse: false,
          };
        
        default:
          return {
            icon: <Radio className="h-3.5 w-3.5" />,
            label: "运行中",
            description: "服务正在运行",
            color: "text-green-500",
            pulse: true,
          };
      }
    
    default:
      return {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        label: "未知",
        description: "未知状态",
        color: "text-muted-foreground",
        pulse: false,
      };
  }
}

export function ServiceStatus() {
  const { state } = useOpencodeContext();
  
  // 提取状态类型
  const backendStatus = state.backendStatus.type;
  const connectionStatus = state.connectionState.status;
  const downloadProgress = state.backendStatus.type === "downloading" 
    ? (state.backendStatus as { type: "downloading"; progress: number }).progress 
    : undefined;
  const endpoint = state.endpoint;
  
  const { icon, label, description, color, pulse } = getStatusDisplay(
    backendStatus,
    connectionStatus,
    downloadProgress
  );

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-sm",
              "hover:bg-accent transition-colors",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            )}
          >
            {/* 状态指示点 */}
            <span className="relative flex h-2 w-2">
              {pulse && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    color === "text-green-500" && "bg-green-500",
                    color === "text-yellow-500" && "bg-yellow-500",
                    color === "text-blue-500" && "bg-blue-500"
                  )}
                />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  color === "text-green-500" && "bg-green-500",
                  color === "text-yellow-500" && "bg-yellow-500",
                  color === "text-blue-500" && "bg-blue-500",
                  color === "text-destructive" && "bg-destructive",
                  color === "text-muted-foreground" && "bg-muted-foreground"
                )}
              />
            </span>
            
            {/* 图标 */}
            <span className={cn(color)}>{icon}</span>
            
            {/* 标签 */}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          <div className="flex flex-col gap-1">
            <p className="font-medium">{description}</p>
            {endpoint && connectionStatus === "connected" && (
              <p className="text-xs text-muted-foreground">
                端点: {endpoint}
              </p>
            )}
            {state.connectionState.status === "connected" && 
             "version" in state.connectionState && (
              <p className="text-xs text-muted-foreground">
                版本: {state.connectionState.version}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
