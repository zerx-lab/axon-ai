/**
 * PDF 预览组件
 * 
 * 基于 PDF.js 实现的 PDF 文档预览器
 * 支持：分页浏览、缩放、文本选择、搜索
 */

import { useState, useRef, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Download,
  Loader2,
  FileX,
  Maximize,
  X,
} from "lucide-react";

// 设置 PDF.js worker
// PDF.js v5.x 使用 .mjs 格式
const PDFJS_VERSION = pdfjsLib.version;
// v5.x 使用 pdf.worker.min.mjs 而非 pdf.worker.min.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

console.log("[PdfViewer] PDF.js 版本:", PDFJS_VERSION);
console.log("[PdfViewer] Worker URL:", pdfjsLib.GlobalWorkerOptions.workerSrc);

/**
 * 将 Base64 字符串转换为 Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // 移除可能的 data URL 前缀
  const base64Data = base64.replace(/^data:[^;]+;base64,/, "");
  
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 解码失败:", e);
    throw new Error("无效的 Base64 数据");
  }
}

interface PdfViewerProps {
  path: string;
  data: ArrayBuffer | string; // Base64 或 ArrayBuffer
  onError?: (error: string) => void;
}

// 缩放预设
const ZOOM_PRESETS = [
  { value: "auto", label: "自动" },
  { value: "page-fit", label: "适应页面" },
  { value: "page-width", label: "适应宽度" },
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "100", label: "100%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150%" },
  { value: "200", label: "200%" },
];

export function PdfViewer({ path, data, onError }: PdfViewerProps) {
  
  // PDF 文档状态
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageRendering, setPageRendering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  // 缩放和显示状态
  const [zoom, setZoom] = useState("auto");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  // 搜索状态
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // DOM 引用
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  
  // 加载 PDF 文档
  useEffect(() => {
    let isCancelled = false;
    
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError("");
        
        // 处理数据格式
        let pdfData: Uint8Array;
        if (typeof data === "string") {
          // Base64 字符串转换为 Uint8Array
          pdfData = base64ToUint8Array(data);
        } else {
          // ArrayBuffer 转换为 Uint8Array
          pdfData = new Uint8Array(data);
        }
        
        // 验证 PDF 文件头
        const header = String.fromCharCode(...pdfData.slice(0, 5));
        if (header !== "%PDF-") {
          throw new Error("无效的 PDF 文件格式");
        }
        
        console.log("[PdfViewer] PDF 数据大小:", pdfData.length, "字节");
        console.log("[PdfViewer] PDF 版本:", String.fromCharCode(...pdfData.slice(0, 8)));
        
        // 加载 PDF，使用 Uint8Array 直接传递
        // PDF.js v5.x 简化配置，移除废弃选项
        const loadingTask = pdfjsLib.getDocument({
          data: pdfData.slice(0), // 创建副本避免 detached buffer 问题
          // 使用 CDN 加载 CMap（用于 CJK 字体支持）
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          // 使用标准字体数据（优化性能）
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        });
        
        // 添加进度回调
        loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
          if (progress.total > 0) {
            console.log("[PdfViewer] 加载进度:", Math.round(progress.loaded / progress.total * 100) + "%");
          }
        };
        
        const pdfDoc = await loadingTask.promise;
        
        if (isCancelled) return;
        
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(1);
        console.log("[PdfViewer] PDF 加载成功，共", pdfDoc.numPages, "页");
      } catch (err) {
        if (isCancelled) return;
        
        console.error("[PdfViewer] PDF 加载错误:", err);
        let errorMsg = "PDF 加载失败";
        
        if (err instanceof Error) {
          // 提供更友好的错误信息
          if (err.message.includes("Invalid PDF")) {
            errorMsg = "无效的 PDF 文件";
          } else if (err.message.includes("Password")) {
            errorMsg = "PDF 文件已加密，需要密码";
          } else if (err.message.includes("Missing PDF")) {
            errorMsg = "PDF 文件损坏或不完整";
          } else {
            errorMsg = err.message;
          }
        }
        
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };
    
    if (data) {
      loadPdf();
    }
    
    // 清理函数
    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [data, onError]);
  
  // 计算缩放比例
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return 1;
    
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40; // 留出边距
    const containerHeight = container.clientHeight - 40;
    
    switch (zoom) {
      case "auto":
      case "page-fit":
        // 适应页面（考虑宽度和高度）
        return Math.min(
          containerWidth / 595, // A4 宽度
          containerHeight / 842  // A4 高度
        );
      case "page-width":
        // 适应宽度
        return containerWidth / 595;
      default:
        // 百分比缩放
        return parseFloat(zoom) / 100;
    }
  }, [zoom]);
  
  // 渲染 PDF 页面
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdf || !canvasRef.current || !textLayerRef.current) return;
    
    try {
      setPageRendering(true);
      
      // 取消之前的渲染任务并等待其完成
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
          await renderTaskRef.current.promise;
        } catch {
          // 取消操作会抛出异常，这是正常的
        }
        renderTaskRef.current = null;
      }
      
      // 获取页面
      const page = await pdf.getPage(pageNum);
      
      // 计算缩放
      const currentScale = calculateScale();
      setScale(currentScale);
      
      // 设置画布尺寸
      const viewport = page.getViewport({ scale: currentScale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      if (!context) return;
      
      // 清除画布内容，确保干净的渲染状态
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // 渲染页面
      const renderContext: any = {
        canvasContext: context,
        viewport: viewport,
      };
      
      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
      
      // 渲染文本层（用于文本选择）
      const textLayer = textLayerRef.current;
      textLayer.innerHTML = "";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      
      // 获取文本内容
      const textContent = await page.getTextContent();
      
      // 创建文本片段
      const textFragments = textContent.items.map(() => {
        const span = document.createElement("span");
        textLayer.appendChild(span);
        return span;
      });
      
      // 使用 CSS 变换定位文本（文本层透明，仅用于选择）
      textFragments.forEach((fragment, i) => {
        const item = textContent.items[i] as any;
        if (item.str && item.transform) {
          const tx = item.transform[4] * currentScale;
          const ty = item.transform[5] * currentScale;
          const fontSize = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2) * currentScale;
          
          fragment.textContent = item.str;
          fragment.style.position = "absolute";
          fragment.style.left = `${tx}px`;
          fragment.style.bottom = `${ty}px`;
          fragment.style.fontSize = `${fontSize}px`;
          fragment.style.fontFamily = "sans-serif";
          // 透明文字，仅用于文本选择
          fragment.style.color = "transparent";
          fragment.style.whiteSpace = "pre";
        }
      });
    } catch (err) {
      if (err instanceof Error && err.message !== "Rendering cancelled") {
        console.error("页面渲染失败:", err);
      }
    } finally {
      setPageRendering(false);
    }
  }, [pdf, rotation, calculateScale]);
  
  // 页面变化时重新渲染
  useEffect(() => {
    if (pdf && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [pdf, currentPage, renderPage]);
  
  // 缩放变化时重新渲染
  useEffect(() => {
    if (pdf && currentPage > 0) {
      renderPage(currentPage);
    }
  }, [zoom]);
  
  // 页面导航
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);
  
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);
  
  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= totalPages) {
      setCurrentPage(value);
    }
  }, [totalPages]);
  
  // 缩放控制
  const zoomIn = useCallback(() => {
    const currentScale = scale * 1.25;
    setZoom(Math.round(currentScale * 100).toString());
  }, [scale]);
  
  const zoomOut = useCallback(() => {
    const currentScale = scale * 0.8;
    setZoom(Math.round(currentScale * 100).toString());
  }, [scale]);
  
  const resetView = useCallback(() => {
    setZoom("auto");
    setRotation(0);
  }, []);
  
  // 旋转控制
  const rotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);
  
  // 下载 PDF
  const handleDownload = useCallback(() => {
    const fileName = path.split(/[/\\]/).pop() || "document.pdf";
    
    // 创建 Blob 和下载链接
    let blob: Blob;
    if (typeof data === "string") {
      const bytes = base64ToUint8Array(data);
      blob = new Blob([bytes], { type: "application/pdf" });
    } else {
      blob = new Blob([data], { type: "application/pdf" });
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
            resetView();
            break;
          case "f":
            e.preventDefault();
            setSearchOpen(prev => !prev);
            break;
        }
      } else {
        switch (e.key) {
          case "ArrowLeft":
            goToPreviousPage();
            break;
          case "ArrowRight":
            goToNextPage();
            break;
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetView, goToPreviousPage, goToNextPage]);
  
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
        <span className="text-sm font-medium">PDF 加载失败</span>
        <span className="text-xs opacity-70">{error}</span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-muted/20">
      {/* 工具栏 */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-background/95 px-3">
        {/* 左侧：页面导航 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goToPreviousPage}
                disabled={currentPage <= 1 || pageRendering}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>上一页 (←)</TooltipContent>
          </Tooltip>
          
          <div className="flex items-center gap-1 text-sm">
            <Input
              type="number"
              value={currentPage}
              onChange={handlePageInputChange}
              className="h-7 w-14 text-center"
              min={1}
              max={totalPages}
              disabled={pageRendering}
            />
            <span className="text-muted-foreground">/ {totalPages}</span>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages || pageRendering}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下一页 (→)</TooltipContent>
          </Tooltip>
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
                disabled={pageRendering}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>缩小 (Ctrl+-)</TooltipContent>
          </Tooltip>
          
          <Select value={zoom} onValueChange={setZoom} disabled={pageRendering}>
            <SelectTrigger className="h-7 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZOOM_PRESETS.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={zoomIn}
                disabled={pageRendering}
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
                onClick={rotate}
                disabled={pageRendering}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>旋转</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={resetView}
                disabled={pageRendering}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重置视图 (Ctrl+0)</TooltipContent>
          </Tooltip>
        </div>
        
        {/* 右侧：工具按钮 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>搜索 (Ctrl+F)</TooltipContent>
          </Tooltip>
          
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
            <TooltipContent>下载</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* 搜索栏 */}
      {searchOpen && (
        <div className="flex h-10 items-center gap-2 border-b border-border/60 bg-background/95 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文本..."
            className="h-7 flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      
      {/* PDF 内容区域 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        style={{ backgroundColor: "#525252" }}
      >
        <div className="relative">
          {/* Canvas 层：渲染 PDF */}
          <canvas
            ref={canvasRef}
            className={cn(
              "shadow-lg",
              pageRendering && "opacity-50"
            )}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: "transform 0.3s ease",
            }}
          />
          
          {/* 文本层：用于文本选择（透明覆盖层） */}
          <div
            ref={textLayerRef}
            className="absolute top-0 left-0 select-text"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: "transform 0.3s ease",
              pointerEvents: "auto",
              userSelect: "text",
              lineHeight: 1,
            }}
          />
          
          {/* 加载遮罩 */}
          {pageRendering && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}