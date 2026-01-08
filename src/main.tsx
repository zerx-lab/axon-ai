import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpencodeProvider } from "@/providers";
import { ChatProvider } from "@/providers/ChatProvider";
import { ProjectProvider } from "@/providers/ProjectProvider";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router";

// 初始化国际化
import "@/i18n";

import "./index.css";

// Create a query client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Render the application
// 注意：ChatProvider 必须在 OpencodeProvider 内部，因为 useChat 依赖 useOpencodeContext
// ProjectProvider 需要在 ChatProvider 之前，以便项目状态可以被聊天状态使用
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <OpencodeProvider autoStart={true}>
      <ProjectProvider>
        <ChatProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" richColors closeButton />
        </ChatProvider>
      </ProjectProvider>
    </OpencodeProvider>
  </QueryClientProvider>,
);
