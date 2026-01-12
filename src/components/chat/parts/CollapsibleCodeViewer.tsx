import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, Check, Maximize2, Minimize2 } from "lucide-react";
import { useTheme } from "@/stores/theme";
import { CodeBlock } from "./CodeBlock";

interface CollapsibleCodeViewerProps {
  content: string;
  language?: string;
  maxCollapsedLines?: number;
  defaultExpanded?: boolean;
  title?: string;
  className?: string;
}

function tryFormatJson(content: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(content);
    return {
      formatted: JSON.stringify(parsed, null, 2),
      isJson: true,
    };
  } catch {
    return { formatted: content, isJson: false };
  }
}

export function CollapsibleCodeViewer({
  content,
  language,
  maxCollapsedLines = 8,
  defaultExpanded = false,
  title,
  className,
}: CollapsibleCodeViewerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const { displayContent, totalLines, isJson, formattedContent } = useMemo(() => {
    const isJsonLang = language === "json" || language === "json5";
    const { formatted, isJson } = isJsonLang ? tryFormatJson(content) : { formatted: content, isJson: false };
    const lines = formatted.split("\n");
    const totalLines = lines.length;

    if (expanded || totalLines <= maxCollapsedLines) {
      return {
        displayContent: formatted,
        totalLines,
        isJson,
        formattedContent: formatted,
      };
    }

    const collapsedContent = lines.slice(0, maxCollapsedLines).join("\n");
    return {
      displayContent: collapsedContent,
      totalLines,
      isJson,
      formattedContent: formatted,
    };
  }, [content, language, expanded, maxCollapsedLines]);

  const shouldShowToggle = useMemo(() => {
    const lines = formattedContent.split("\n");
    return lines.length > maxCollapsedLines;
  }, [formattedContent, maxCollapsedLines]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const effectiveLanguage = isJson ? "json" : language;

  return (
    <div className={cn("relative group rounded-md overflow-hidden", className)}>
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border/50 text-xs text-muted-foreground">
          <span>{title}</span>
          {effectiveLanguage && (
            <span className="opacity-70">{effectiveLanguage}</span>
          )}
        </div>
      )}

      <div className="relative">
        <CodeBlock code={displayContent} language={effectiveLanguage} />

        {!expanded && shouldShowToggle && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-16",
              "bg-gradient-to-t pointer-events-none",
              isDark
                ? "from-[#282c34] via-[#282c34]/80 to-transparent"
                : "from-[#fafafa] via-[#fafafa]/80 to-transparent"
            )}
          />
        )}
      </div>

      <div
        className={cn(
          "flex items-center justify-between px-2 py-1.5",
          "border-t border-border/30",
          isDark ? "bg-[#282c34]" : "bg-[#fafafa]"
        )}
      >
        <div className="flex items-center gap-1">
          {shouldShowToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <Minimize2 className="h-3 w-3" />
                  收起
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3" />
                  展开全部 ({totalLines} 行)
                </>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                复制
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface JsonViewerProps {
  data: unknown;
  maxCollapsedLines?: number;
  defaultExpanded?: boolean;
  title?: string;
  className?: string;
}

export function JsonViewer({
  data,
  maxCollapsedLines = 8,
  defaultExpanded = false,
  title,
  className,
}: JsonViewerProps) {
  const content = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <CollapsibleCodeViewer
      content={content}
      language="json"
      maxCollapsedLines={maxCollapsedLines}
      defaultExpanded={defaultExpanded}
      title={title}
      className={className}
    />
  );
}

export default CollapsibleCodeViewer;
