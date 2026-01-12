/**
 * 代码块渲染组件 - 高性能懒加载版本
 * 
 * 优化策略：
 * 1. 懒加载 react-syntax-highlighter（减少首屏 ~500KB）
 * 2. 使用轻量级 Light 版本的高亮器
 * 3. 仅注册常用语言，按需加载其他语言
 * 4. 首屏显示简洁的代码块，后台加载高亮器
 * 5. 支持亮色/暗色主题切换
 */

import { useState, useEffect, memo, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/stores/theme";

// 懒加载语法高亮器
const SyntaxHighlighter = lazy(() => 
  import("react-syntax-highlighter/dist/esm/prism-light").then(mod => ({
    default: mod.default
  }))
);

const themeCache = {
  dark: null as Record<string, React.CSSProperties> | null,
  light: null as Record<string, React.CSSProperties> | null,
};

const loadDarkTheme = async () => {
  if (!themeCache.dark) {
    const mod = await import("react-syntax-highlighter/dist/esm/styles/prism/one-dark");
    themeCache.dark = mod.default;
  }
  return themeCache.dark;
};

const loadLightTheme = async () => {
  if (!themeCache.light) {
    const mod = await import("react-syntax-highlighter/dist/esm/styles/prism/one-light");
    themeCache.light = mod.default;
  }
  return themeCache.light;
};

// 懒加载语言支持（仅加载常用语言）
const languageLoaders: Record<string, () => Promise<unknown>> = {
  javascript: () => import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
  typescript: () => import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
  jsx: () => import("react-syntax-highlighter/dist/esm/languages/prism/jsx"),
  tsx: () => import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
  python: () => import("react-syntax-highlighter/dist/esm/languages/prism/python"),
  rust: () => import("react-syntax-highlighter/dist/esm/languages/prism/rust"),
  go: () => import("react-syntax-highlighter/dist/esm/languages/prism/go"),
  java: () => import("react-syntax-highlighter/dist/esm/languages/prism/java"),
  c: () => import("react-syntax-highlighter/dist/esm/languages/prism/c"),
  cpp: () => import("react-syntax-highlighter/dist/esm/languages/prism/cpp"),
  csharp: () => import("react-syntax-highlighter/dist/esm/languages/prism/csharp"),
  css: () => import("react-syntax-highlighter/dist/esm/languages/prism/css"),
  scss: () => import("react-syntax-highlighter/dist/esm/languages/prism/scss"),
  html: () => import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
  xml: () => import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
  markdown: () => import("react-syntax-highlighter/dist/esm/languages/prism/markdown"),
  json: () => import("react-syntax-highlighter/dist/esm/languages/prism/json"),
  yaml: () => import("react-syntax-highlighter/dist/esm/languages/prism/yaml"),
  bash: () => import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
  shell: () => import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
  sh: () => import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
  sql: () => import("react-syntax-highlighter/dist/esm/languages/prism/sql"),
  graphql: () => import("react-syntax-highlighter/dist/esm/languages/prism/graphql"),
  docker: () => import("react-syntax-highlighter/dist/esm/languages/prism/docker"),
  toml: () => import("react-syntax-highlighter/dist/esm/languages/prism/toml"),
};

// 语言别名映射
const languageAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  cs: "csharp",
  "c++": "cpp",
  yml: "yaml",
  zsh: "bash",
  dockerfile: "docker",
};

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

interface CodeBlockFallbackProps {
  code: string;
  language?: string;
  isDark?: boolean;
}

/**
 * 代码块简单占位符（首屏立即显示）
 * 支持亮色/暗色主题
 */
function CodeBlockFallback({ code, language, isDark = true }: CodeBlockFallbackProps) {
  return (
    <div className="relative group my-2">
      {language && (
        <div className="absolute right-2 top-2 text-xs text-muted-foreground opacity-70 z-10">
          {language}
        </div>
      )}
      <pre 
        className={cn(
          "rounded-md p-4 overflow-x-auto",
          "text-[0.8125rem] leading-relaxed",
          "font-[ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace]",
          // 根据主题动态切换背景色和文字色
          isDark 
            ? "bg-[#282c34] text-gray-300" 
            : "bg-[#fafafa] text-gray-800 border border-border/50"
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * 高亮代码块（懒加载后显示）
 * 支持亮色/暗色主题动态切换
 */
const HighlightedCodeBlock = memo(function HighlightedCodeBlock({
  code,
  language,
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  const [darkTheme, setDarkTheme] = useState<Record<string, React.CSSProperties> | null>(themeCache.dark);
  const [lightTheme, setLightTheme] = useState<Record<string, React.CSSProperties> | null>(themeCache.light);
  const [languageLoaded, setLanguageLoaded] = useState(false);

  // 解析语言
  const normalizedLang = language?.toLowerCase() || "text";
  const resolvedLang = languageAliases[normalizedLang] || normalizedLang;

  // 加载两个主题（使用缓存）
  useEffect(() => {
    loadDarkTheme().then(setDarkTheme);
    loadLightTheme().then(setLightTheme);
  }, []);

  // 加载语言支持
  useEffect(() => {
    const loader = languageLoaders[resolvedLang];
    if (loader) {
      loader().then(() => setLanguageLoaded(true));
    } else {
      // 未知语言，直接标记为已加载
      setLanguageLoaded(true);
    }
  }, [resolvedLang]);

  // 根据当前主题选择对应的样式
  const currentTheme = isDark ? darkTheme : lightTheme;

  // 主题或语言未加载时显示占位符
  if (!currentTheme || !languageLoaded) {
    return <CodeBlockFallback code={code} language={language} isDark={isDark} />;
  }

  return (
    <div className="relative group my-2">
      {language && (
        <div className="absolute right-2 top-2 text-xs text-muted-foreground opacity-70 z-10">
          {language}
        </div>
      )}
      <Suspense fallback={<CodeBlockFallback code={code} language={language} isDark={isDark} />}>
        <SyntaxHighlighter
          style={currentTheme}
          language={resolvedLang}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            lineHeight: "1.5",
            // 亮色主题添加边框
            ...(isDark ? {} : { border: "1px solid hsl(var(--border) / 0.5)" }),
          }}
          codeTagProps={{
            style: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </Suspense>
    </div>
  );
});

/**
 * 代码块组件（主入口）
 * 使用简单占位符 + 懒加载高亮器的策略
 */
export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  className,
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [shouldHighlight, setShouldHighlight] = useState(false);

  // 延迟加载高亮器，优先保证首屏渲染
  useEffect(() => {
    // 使用 requestIdleCallback（如果可用）或 setTimeout 延迟加载
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setShouldHighlight(true), {
        timeout: 1000,
      });
      return () => window.cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => setShouldHighlight(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className={className}>
      {shouldHighlight ? (
        <HighlightedCodeBlock code={code} language={language} />
      ) : (
        <CodeBlockFallback code={code} language={language} isDark={isDark} />
      )}
    </div>
  );
});

export default CodeBlock;
