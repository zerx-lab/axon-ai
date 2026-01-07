import type { ReactNode } from "react";
import { Titlebar } from "@/components/titlebar";

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Root layout component - Zed-style application shell
 * Provides the main application structure with:
 * - Custom title bar (draggable for Tauri)
 * - Main content area
 */
export function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <Titlebar />
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
