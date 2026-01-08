/**
 * 应用入口
 * 
 * 性能优化：
 * 1. 使用 startTransition 降低初始化阻塞
 * 2. i18n 按需加载非默认语言
 * 3. QueryClient 使用更激进的缓存策略
 */

import { startTransition, StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpencodeProvider } from "@/providers";
import { ChatProvider } from "@/providers/ChatProvider";
import { ProjectProvider } from "@/providers/ProjectProvider";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router";

// 初始化国际化（仅加载默认语言）
import "@/i18n";

import "./index.css";

// 创建 QueryClient 实例（优化缓存配置）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 更长的 stale time 减少重复请求
      staleTime: 1000 * 60 * 5, // 5 分钟
      // 更长的 cache time 
      gcTime: 1000 * 60 * 30, // 30 分钟
      retry: 1,
      // 禁用 refetch on window focus（桌面应用不需要）
      refetchOnWindowFocus: false,
    },
  },
});

// 获取 root 元素
const rootElement = document.getElementById("root") as HTMLElement;

// 移除首屏加载动画
const loadingElement = rootElement.querySelector(".app-loading");
if (loadingElement) {
  loadingElement.remove();
}

// 使用 startTransition 渲染应用，降低首屏阻塞
// 注意：ChatProvider 必须在 OpencodeProvider 内部，因为 useChat 依赖 useOpencodeContext
// ProjectProvider 需要在 ChatProvider 之前，以便项目状态可以被聊天状态使用
const root = ReactDOM.createRoot(rootElement);

startTransition(() => {
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <OpencodeProvider autoStart={true}>
          <ProjectProvider>
            <ChatProvider>
              <RouterProvider router={router} />
              <Toaster position="bottom-right" richColors closeButton />
            </ChatProvider>
          </ProjectProvider>
        </OpencodeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
});
