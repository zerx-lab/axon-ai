import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpencodeProvider } from "@/providers";
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
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <OpencodeProvider autoStart={true}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors closeButton />
      </OpencodeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
