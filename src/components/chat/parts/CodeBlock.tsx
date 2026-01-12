/**
 * 代码块渲染组件 - PrismLight 版本
 * 
 * 使用 PrismLight + 按需注册语言实现高性能语法高亮
 */

import { useState, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/stores/theme";
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";

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

const registeredLanguages = new Set<string>();

type LanguageModule = { default: unknown };
const languageLoaders: Record<string, () => Promise<LanguageModule>> = {
  javascript: () => import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
  typescript: () => import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
  jsx: () => import("react-syntax-highlighter/dist/esm/languages/prism/jsx"),
  tsx: () => import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
  css: () => import("react-syntax-highlighter/dist/esm/languages/prism/css"),
  scss: () => import("react-syntax-highlighter/dist/esm/languages/prism/scss"),
  sass: () => import("react-syntax-highlighter/dist/esm/languages/prism/sass"),
  less: () => import("react-syntax-highlighter/dist/esm/languages/prism/less"),
  markup: () => import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
  python: () => import("react-syntax-highlighter/dist/esm/languages/prism/python"),
  rust: () => import("react-syntax-highlighter/dist/esm/languages/prism/rust"),
  go: () => import("react-syntax-highlighter/dist/esm/languages/prism/go"),
  java: () => import("react-syntax-highlighter/dist/esm/languages/prism/java"),
  c: () => import("react-syntax-highlighter/dist/esm/languages/prism/c"),
  cpp: () => import("react-syntax-highlighter/dist/esm/languages/prism/cpp"),
  csharp: () => import("react-syntax-highlighter/dist/esm/languages/prism/csharp"),
  ruby: () => import("react-syntax-highlighter/dist/esm/languages/prism/ruby"),
  php: () => import("react-syntax-highlighter/dist/esm/languages/prism/php"),
  swift: () => import("react-syntax-highlighter/dist/esm/languages/prism/swift"),
  kotlin: () => import("react-syntax-highlighter/dist/esm/languages/prism/kotlin"),
  scala: () => import("react-syntax-highlighter/dist/esm/languages/prism/scala"),
  dart: () => import("react-syntax-highlighter/dist/esm/languages/prism/dart"),
  elixir: () => import("react-syntax-highlighter/dist/esm/languages/prism/elixir"),
  erlang: () => import("react-syntax-highlighter/dist/esm/languages/prism/erlang"),
  haskell: () => import("react-syntax-highlighter/dist/esm/languages/prism/haskell"),
  clojure: () => import("react-syntax-highlighter/dist/esm/languages/prism/clojure"),
  lua: () => import("react-syntax-highlighter/dist/esm/languages/prism/lua"),
  perl: () => import("react-syntax-highlighter/dist/esm/languages/prism/perl"),
  r: () => import("react-syntax-highlighter/dist/esm/languages/prism/r"),
  julia: () => import("react-syntax-highlighter/dist/esm/languages/prism/julia"),
  objectivec: () => import("react-syntax-highlighter/dist/esm/languages/prism/objectivec"),
  bash: () => import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
  powershell: () => import("react-syntax-highlighter/dist/esm/languages/prism/powershell"),
  batch: () => import("react-syntax-highlighter/dist/esm/languages/prism/batch"),
  json: () => import("react-syntax-highlighter/dist/esm/languages/prism/json"),
  json5: () => import("react-syntax-highlighter/dist/esm/languages/prism/json5"),
  yaml: () => import("react-syntax-highlighter/dist/esm/languages/prism/yaml"),
  toml: () => import("react-syntax-highlighter/dist/esm/languages/prism/toml"),
  ini: () => import("react-syntax-highlighter/dist/esm/languages/prism/ini"),
  properties: () => import("react-syntax-highlighter/dist/esm/languages/prism/properties"),
  sql: () => import("react-syntax-highlighter/dist/esm/languages/prism/sql"),
  plsql: () => import("react-syntax-highlighter/dist/esm/languages/prism/plsql"),
  graphql: () => import("react-syntax-highlighter/dist/esm/languages/prism/graphql"),
  docker: () => import("react-syntax-highlighter/dist/esm/languages/prism/docker"),
  nginx: () => import("react-syntax-highlighter/dist/esm/languages/prism/nginx"),
  apacheconf: () => import("react-syntax-highlighter/dist/esm/languages/prism/apacheconf"),
  makefile: () => import("react-syntax-highlighter/dist/esm/languages/prism/makefile"),
  cmake: () => import("react-syntax-highlighter/dist/esm/languages/prism/cmake"),
  hcl: () => import("react-syntax-highlighter/dist/esm/languages/prism/hcl"),
  markdown: () => import("react-syntax-highlighter/dist/esm/languages/prism/markdown"),
  latex: () => import("react-syntax-highlighter/dist/esm/languages/prism/latex"),
  textile: () => import("react-syntax-highlighter/dist/esm/languages/prism/textile"),
  diff: () => import("react-syntax-highlighter/dist/esm/languages/prism/diff"),
  git: () => import("react-syntax-highlighter/dist/esm/languages/prism/git"),
  regex: () => import("react-syntax-highlighter/dist/esm/languages/prism/regex"),
  vim: () => import("react-syntax-highlighter/dist/esm/languages/prism/vim"),
  asm6502: () => import("react-syntax-highlighter/dist/esm/languages/prism/asm6502"),
  nasm: () => import("react-syntax-highlighter/dist/esm/languages/prism/nasm"),
  wasm: () => import("react-syntax-highlighter/dist/esm/languages/prism/wasm"),
  solidity: () => import("react-syntax-highlighter/dist/esm/languages/prism/solidity"),
  protobuf: () => import("react-syntax-highlighter/dist/esm/languages/prism/protobuf"),
  handlebars: () => import("react-syntax-highlighter/dist/esm/languages/prism/handlebars"),
  ejs: () => import("react-syntax-highlighter/dist/esm/languages/prism/ejs"),
  pug: () => import("react-syntax-highlighter/dist/esm/languages/prism/pug"),
};

const languageToLoader: Record<string, string> = {
  html: "markup",
  xml: "markup",
  svg: "markup",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  dockerfile: "docker",
};

const languageAliases: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  cs: "csharp",
  "c++": "cpp",
  "c#": "csharp",
  kt: "kotlin",
  kts: "kotlin",
  yml: "yaml",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  cmd: "batch",
  bat: "batch",
  make: "makefile",
  mk: "makefile",
  tf: "hcl",
  terraform: "hcl",
  config: "ini",
  conf: "ini",
  cfg: "ini",
  tex: "latex",
  md: "markdown",
  mdx: "markdown",
  proto: "protobuf",
  sol: "solidity",
  asm: "nasm",
  hbs: "handlebars",
  mustache: "handlebars",
  jade: "pug",
  objc: "objectivec",
  "objective-c": "objectivec",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  clj: "clojure",
  jl: "julia",
  pl: "perl",
  command: "bash",
};

async function registerLanguageToHighlighter(lang: string): Promise<boolean> {
  const loaderName = languageToLoader[lang] || lang;
  
  // 检查语言或其 loader 是否已注册
  if (registeredLanguages.has(lang) || registeredLanguages.has(loaderName)) {
    return true;
  }
  
  const loader = languageLoaders[loaderName];
  if (!loader) {
    return false;
  }
  
  try {
    const mod = await loader();
    SyntaxHighlighter.registerLanguage(lang, mod.default);
    registeredLanguages.add(lang);
    
    if (loaderName !== lang) {
      registeredLanguages.add(loaderName);
    }
    
    return true;
  } catch {
    return false;
  }
}

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

const HighlightedCodeBlock = memo(function HighlightedCodeBlock({
  code,
  language,
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  const [darkTheme, setDarkTheme] = useState<Record<string, React.CSSProperties> | null>(themeCache.dark);
  const [lightTheme, setLightTheme] = useState<Record<string, React.CSSProperties> | null>(themeCache.light);
  const [languageReady, setLanguageReady] = useState(false);

  const normalizedLang = language?.toLowerCase() || "text";
  const resolvedLang = languageAliases[normalizedLang] || normalizedLang;

  useEffect(() => {
    loadDarkTheme().then(setDarkTheme);
    loadLightTheme().then(setLightTheme);
  }, []);

  useEffect(() => {
    registerLanguageToHighlighter(resolvedLang).then(() => setLanguageReady(true));
  }, [resolvedLang]);

  const currentTheme = isDark ? darkTheme : lightTheme;

  if (!currentTheme || !languageReady) {
    return <CodeBlockFallback code={code} language={language} isDark={isDark} />;
  }

  return (
    <div className="relative group my-2">
      {language && (
        <div className="absolute right-2 top-2 text-xs text-muted-foreground opacity-70 z-10">
          {language}
        </div>
      )}
      <SyntaxHighlighter
        style={currentTheme}
        language={resolvedLang}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          fontSize: "0.8125rem",
          lineHeight: "1.5",
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
    </div>
  );
});

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  className,
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [shouldHighlight, setShouldHighlight] = useState(false);

  useEffect(() => {
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
