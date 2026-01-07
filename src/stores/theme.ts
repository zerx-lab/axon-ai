/**
 * Theme store - manages application theme with persistence
 */

import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "axon-theme";

/**
 * Get the system preferred theme
 */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Get the stored theme preference
 */
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

  root.classList.remove("light", "dark");
  root.classList.add(effectiveTheme);
}

/**
 * Hook for managing theme state
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    theme === "system" ? getSystemTheme() : theme
  );

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(theme === "system" ? getSystemTheme() : theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
        setResolvedTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === "dark",
  };
}
