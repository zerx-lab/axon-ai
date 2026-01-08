/**
 * 应用加载状态组件
 * 
 * 在 Provider 初始化期间显示加载状态
 * 替代简单的白屏，提供更好的用户体验
 */

import { useOpencodeContext } from "@/providers";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface AppLoaderProps {
  children: ReactNode;
}

/**
 * 获取加载状态描述文本
 */
function getLoadingText(
  backendStatus: string,
  connectionStatus: string,
  isInitializing: boolean
): string {
  if (isInitializing) {
    return "正在初始化...";
  }
  
  switch (backendStatus) {
    case "initializing":
      return "正在检测 OpenCode...";
    case "downloading":
      return "正在下载 OpenCode...";
    case "starting":
      return "正在启动服务...";
    case "running":
      if (connectionStatus === "connecting") {
        return "正在连接服务...";
      }
      break;
    case "error":
      return "服务启动失败";
  }
  
  return "正在加载...";
}

/**
 * AppLoader 组件
 * 
 * 包装子组件，在服务未就绪时显示加载状态
 */
export function AppLoader({ children }: AppLoaderProps) {
  const { state, isInitializing, isConnected, error } = useOpencodeContext();
  
  const backendStatus = state.backendStatus.type;
  const connectionStatus = state.connectionState.status;
  
  // 服务已连接，直接显示子组件
  if (isConnected) {
    return <>{children}</>;
  }
  
  // 如果有错误但服务正在运行，也显示子组件（让子组件处理错误状态）
  if (backendStatus === "running" && connectionStatus !== "connecting") {
    return <>{children}</>;
  }
  
  // 如果已经初始化完成且不是正在连接，显示子组件
  if (!isInitializing && backendStatus !== "starting" && backendStatus !== "downloading") {
    return <>{children}</>;
  }
  
  // 显示加载状态
  const loadingText = getLoadingText(backendStatus, connectionStatus, isInitializing);
  
  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-4">
      {error ? (
        // 错误状态
        <div className="flex flex-col items-center gap-2 text-destructive">
          <span className="text-sm">{error}</span>
        </div>
      ) : (
        // 加载状态
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{loadingText}</span>
        </div>
      )}
    </div>
  );
}
