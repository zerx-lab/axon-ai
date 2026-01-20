/**
 * Word 预览组件
 * 
 * 基于 mammoth.js 实现的 Word 文档预览器
 * 支持：.docx 格式、样式保留、图片显示
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Loader2,
  FileX,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

interface WordViewerProps {
  path: string;
  data: ArrayBuffer | string; // Base64 或 ArrayBuffer
  viewMode?: "simple" | "advanced";
  onError?: (error: string) => void;
}

// 默认样式
const DEFAULT_STYLES = `
  .word-viewer-content {
    font-family: 'Calibri', 'Arial', sans-serif;
    line-height: 1.6;
    color: var(--foreground);
    word-wrap: break-word;
    max-width: 100%;
  }
  
  .word-viewer-content h1 {
    font-size: 2em;
    font-weight: bold;
    margin: 0.67em 0;
  }
  
  .word-viewer-content h2 {
    font-size: 1.5em;
    font-weight: bold;
    margin: 0.75em 0;
  }
  
  .word-viewer-content h3 {
    font-size: 1.17em;
    font-weight: bold;
    margin: 0.83em 0;
  }
  
  .word-viewer-content p {
    margin: 1em 0;
  }
  
  .word-viewer-content ul,
  .word-viewer-content ol {
    margin: 1em 0;
    padding-left: 2em;
  }
  
  .word-viewer-content li {
    margin: 0.5em 0;
  }
  
  .word-viewer-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  
  .word-viewer-content td,
  .word-viewer-content th {
    border: 1px solid var(--border);
    padding: 8px;
  }
  
  .word-viewer-content th {
    background-color: var(--muted);
    font-weight: bold;
  }
  
  .word-viewer-content img {
    max-width: 100%;
    height: auto;
  }
  
  .word-viewer-content blockquote {
    margin: 1em 0;
    padding-left: 1em;
    border-left: 4px solid var(--border);
    color: var(--muted-foreground);
  }
  
  .word-viewer-content code {
    background-color: var(--muted);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
  }
  
  .word-viewer-content pre {
    background-color: var(--muted);
    padding: 1em;
    border-radius: 4px;
    overflow-x: auto;
  }
  
  .word-viewer-content pre code {
    background: none;
    padding: 0;
  }
  
  .word-viewer-content strong {
    font-weight: bold;
  }
  
  .word-viewer-content em {
    font-style: italic;
  }
  
  .word-viewer-content u {
    text-decoration: underline;
  }
  
  .word-viewer-content s {
    text-decoration: line-through;
  }
  
  .word-viewer-content a {
    color: var(--primary);
    text-decoration: underline;
  }
  
  .word-viewer-content a:hover {
    text-decoration: none;
  }
  
  .word-viewer-content hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2em 0;
  }
`;

export function WordViewer({ 
  path, 
  data, 
  viewMode = "simple",
  onError 
}: WordViewerProps) {
  // 转换结果
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [conversionMessages, setConversionMessages] = useState<Array<{ type: string; message: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  // 缩放状态
  const [zoom, setZoom] = useState(100);
  
  // 内容容器
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // 加载 mammoth 并转换文档（合并为单个 useEffect 避免竞态条件）
  useEffect(() => {
    let cancelled = false;
    
    const loadAndConvert = async () => {
      if (!data) return;
      
      try {
        setIsLoading(true);
        setError("");
        
        // 动态导入 mammoth
        // @ts-ignore
        const mammothModule = await import("mammoth");
        const mammoth = mammothModule.default || mammothModule;
        
        if (cancelled) return;
        
        // 处理数据格式
        let documentData: ArrayBuffer;
        if (typeof data === "string") {
          // Base64 字符串
          const base64 = data.replace(/^data:.*?;base64,/, "");
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          documentData = bytes.buffer;
        } else {
          documentData = data;
        }
        
        // 转换选项
        const options = {
          convertImage: mammoth.images.imgElement((image: any) => {
            return image.read("base64").then((imageBuffer: string) => {
              return {
                src: `data:${image.contentType};base64,${imageBuffer}`,
              };
            });
          }),
          styleMap: viewMode === "advanced" ? [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
          ] : [],
        };
        
        // 转换文档
        const result: any = await mammoth.convertToHtml(
          { arrayBuffer: documentData },
          options
        );
        
        if (cancelled) return;
        
        // mammoth 返回 { value: string, messages: Message[] }
        setHtmlContent(result.value);
        setConversionMessages(result.messages || []);
      } catch (err) {
        if (cancelled) return;
        const errorMsg = err instanceof Error ? err.message : "Word 文档转换失败";
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    loadAndConvert();
    
    return () => {
      cancelled = true;
    };
  }, [data, viewMode, onError]);
  
  // 更新 iframe 内容
  useEffect(() => {
    if (!htmlContent || !iframeRef.current) return;
    
    const iframeDoc = iframeRef.current.contentDocument;
    if (!iframeDoc) return;
    
    // 构建完整的 HTML 文档
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              padding: 20px;
              background: var(--background, #fff);
              transform: scale(${zoom / 100});
              transform-origin: top left;
              width: ${100 * (100 / zoom)}%;
            }
            
            ${DEFAULT_STYLES}
          </style>
        </head>
        <body>
          <div class="word-viewer-content">
            ${htmlContent}
          </div>
        </body>
      </html>
    `;
    
    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();
    
    // 设置 CSS 变量以匹配主题
    const computedStyle = getComputedStyle(document.documentElement);
    const cssVars = [
      "--background",
      "--foreground",
      "--muted",
      "--muted-foreground",
      "--border",
      "--primary",
    ];
    
    cssVars.forEach(varName => {
      const value = computedStyle.getPropertyValue(varName);
      if (value && iframeDoc.documentElement) {
        iframeDoc.documentElement.style.setProperty(varName, value);
      }
    });
  }, [htmlContent, zoom]);
  
  // 缩放控制
  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(200, prev + 25));
  }, []);
  
  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(50, prev - 25));
  }, []);
  
  const resetZoom = useCallback(() => {
    setZoom(100);
  }, []);
  
  // 下载原始文档
  const handleDownload = useCallback(() => {
    const fileName = path.split(/[/\\]/).pop() || "document.docx";
    
    // 创建 Blob 和下载链接
    let blob: Blob;
    if (typeof data === "string") {
      const base64 = data.replace(/^data:.*?;base64,/, "");
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    } else {
      blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [path, data]);
  
  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault();
            zoomIn();
            break;
          case "-":
            e.preventDefault();
            zoomOut();
            break;
          case "0":
            e.preventDefault();
            resetZoom();
            break;
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);
  
  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // 错误状态
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileX className="h-12 w-12 opacity-50" />
        <span className="text-sm font-medium">Word 文档加载失败</span>
        <span className="text-xs opacity-70">{error}</span>
      </div>
    );
  }
  
  // 无内容状态
  if (!htmlContent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileText className="h-12 w-12 opacity-50" />
        <span className="text-sm">文档为空</span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background">
      {/* 工具栏 */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-muted/10 px-3">
        {/* 左侧：文档信息 */}
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {path.split(/[/\\]/).pop()}
          </span>
          {conversionMessages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-yellow-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{conversionMessages.length} 警告</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <div className="space-y-1">
                  {conversionMessages.slice(0, 5).map((msg, i) => (
                    <div key={i} className="text-xs">
                      {msg.type}: {msg.message}
                    </div>
                  ))}
                  {conversionMessages.length > 5 && (
                    <div className="text-xs opacity-70">
                      还有 {conversionMessages.length - 5} 个警告...
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {/* 中间：缩放控制 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={zoomOut}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>缩小 (Ctrl+-)</TooltipContent>
          </Tooltip>
          
          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
            {zoom}%
          </span>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={zoomIn}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>放大 (Ctrl++)</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-5 bg-border/60" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={resetZoom}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重置缩放 (Ctrl+0)</TooltipContent>
          </Tooltip>
        </div>
        
        {/* 右侧：下载按钮 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下载原始文档</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* 文档内容 */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          className={cn(
            "w-full h-full border-0",
            "bg-background"
          )}
          title="Word Document Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}