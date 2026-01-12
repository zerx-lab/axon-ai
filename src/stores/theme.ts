/**
 * Theme store - 使用 zustand 管理应用主题，确保所有组件共享同一状态
 */

import { create } from "zustand";
import { useEffect } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "axon-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

  root.classList.remove("light", "dark");
  root.classList.add(effectiveTheme);
}

function computeResolvedTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  _updateResolvedTheme: () => void;
}

const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getStoredTheme();
  const initialResolved = computeResolvedTheme(initialTheme);

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    isDark: initialResolved === "dark",

    setTheme: (newTheme: Theme) => {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      applyTheme(newTheme);
      const resolved = computeResolvedTheme(newTheme);
      set({
        theme: newTheme,
        resolvedTheme: resolved,
        isDark: resolved === "dark",
      });
    },

    toggleTheme: () => {
      const { resolvedTheme, setTheme } = get();
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    },

    _updateResolvedTheme: () => {
      const { theme } = get();
      if (theme === "system") {
        const resolved = getSystemTheme();
        applyTheme("system");
        set({
          resolvedTheme: resolved,
          isDark: resolved === "dark",
        });
      }
    },
  };
});

// 初始化时应用主题
if (typeof window !== "undefined") {
  applyTheme(useThemeStore.getState().theme);
}

export function useTheme() {
  const store = useThemeStore();

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      store._updateResolvedTheme();
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [store]);

  return {
    theme: store.theme,
    resolvedTheme: store.resolvedTheme,
    setTheme: store.setTheme,
    toggleTheme: store.toggleTheme,
    isDark: store.isDark,
  };
}
