/**
 * Theme toggle button
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
        "hover:bg-accent text-muted-foreground hover:text-foreground"
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
