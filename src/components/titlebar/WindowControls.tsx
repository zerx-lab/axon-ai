/**
 * Window control buttons (minimize, maximize, close)
 * Zed-style flat design
 */

import { useCallback, useEffect, useState } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { window as tauriWindow } from "@/services/tauri";
import { cn } from "@/lib/utils";

interface WindowControlButtonProps {
  onClick: () => void;
  variant?: "default" | "close";
  children: React.ReactNode;
  title: string;
}

function WindowControlButton({
  onClick,
  variant = "default",
  children,
  title,
}: WindowControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-8 w-11 items-center justify-center transition-colors",
        variant === "default" && "hover:bg-accent",
        variant === "close" && "hover:bg-destructive hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  // Check maximized state on mount and after actions
  const checkMaximized = useCallback(async () => {
    try {
      const maximized = await tauriWindow.isMaximized();
      setIsMaximized(maximized);
    } catch {
      // Ignore errors in dev
    }
  }, []);

  useEffect(() => {
    checkMaximized();
  }, [checkMaximized]);

  const handleMinimize = useCallback(async () => {
    await tauriWindow.minimize();
  }, []);

  const handleMaximize = useCallback(async () => {
    await tauriWindow.maximize();
    // Small delay to let the window state update
    setTimeout(checkMaximized, 50);
  }, [checkMaximized]);

  const handleClose = useCallback(async () => {
    await tauriWindow.close();
  }, []);

  return (
    <div className="flex items-center">
      <WindowControlButton onClick={handleMinimize} title="Minimize">
        <Minus className="size-4" />
      </WindowControlButton>
      <WindowControlButton onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
        {isMaximized ? (
          <Maximize2 className="size-3.5" />
        ) : (
          <Square className="size-3.5" />
        )}
      </WindowControlButton>
      <WindowControlButton onClick={handleClose} variant="close" title="Close">
        <X className="size-4" />
      </WindowControlButton>
    </div>
  );
}
