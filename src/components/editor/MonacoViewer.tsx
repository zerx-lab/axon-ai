import { useEffect, useRef, useCallback } from "react";
import Editor, { type OnMount, loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

interface MonacoViewerProps {
  value: string;
  language: string;
  className?: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  yml: "yaml",
  md: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  dockerfile: "dockerfile",
  plaintext: "plaintext",
  text: "plaintext",
};

function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase();
  return LANGUAGE_MAP[normalized] || normalized;
}

export function MonacoViewer({ value, language, className, onChange, onSave }: MonacoViewerProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });
  }, []);

  const handleChange = useCallback((newValue: string | undefined) => {
    if (newValue !== undefined) {
      onChange?.(newValue);
    }
  }, [onChange]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        theme: resolvedTheme === "dark" ? "vs-dark" : "vs",
      });
    }
  }, [resolvedTheme]);

  return (
    <div className={cn("h-full w-full", className)}>
      <Editor
        value={value}
        language={normalizeLanguage(language)}
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
        onMount={handleEditorMount}
        onChange={handleChange}
        loading={
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }
        options={{
          readOnly: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          renderLineHighlight: "line",
          folding: true,
          wordWrap: "on",
          automaticLayout: true,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          contextmenu: true,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
}
