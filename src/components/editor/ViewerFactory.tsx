/**
 * 预览组件工厂
 * 
 * 根据文件类型自动选择合适的预览组件
 */

import { Suspense, lazy, ReactNode } from "react";
import { FileCategory, getFileCategory } from "@/utils/fileType";
import { Loader2, FileX, Archive, Video, Music } from "lucide-react";

// 懒加载预览组件，优化性能
const PdfViewer = lazy(() => import("./PdfViewer").then(m => ({ default: m.PdfViewer })));
const ExcelViewer = lazy(() => import("./ExcelViewer").then(m => ({ default: m.ExcelViewer })));
const WordViewer = lazy(() => import("./WordViewer").then(m => ({ default: m.WordViewer })));
const ImageViewer = lazy(() => import("./ImageViewer").then(m => ({ default: m.ImageViewer })));
const MonacoViewer = lazy(() => import("./MonacoViewer").then(m => ({ default: m.MonacoViewer })));

// 通用预览组件属性
export interface ViewerProps {
  path: string;
  data: string | ArrayBuffer;
  language?: string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  onError?: (error: string) => void;
  onChange?: (content: string) => void;
  onSave?: () => void;
}

// 加载中组件
function LoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// 不支持的文件类型组件
interface UnsupportedViewerProps {
  fileName: string;
  category: FileCategory;
}

function UnsupportedViewer({ fileName, category }: UnsupportedViewerProps) {
  const ext = fileName.split(".").pop()?.toUpperCase() || "未知";
  
  // 根据文件类别选择图标
  let Icon = FileX;
  let message = "不支持预览此文件类型";
  
  switch (category) {
    case FileCategory.Archive:
      Icon = Archive;
      message = "压缩文件暂不支持预览";
      break;
    case FileCategory.Video:
      Icon = Video;
      message = "视频文件暂不支持预览";
      break;
    case FileCategory.Audio:
      Icon = Music;
      message = "音频文件暂不支持预览";
      break;
  }
  
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Icon className="h-12 w-12 opacity-50" />
      <span className="text-sm font-medium">{message}</span>
      <span className="text-xs opacity-70">{ext} 文件</span>
    </div>
  );
}

/**
 * 创建预览组件
 */
export function createViewer(props: ViewerProps): ReactNode {
  const { path, data, language, onRetry, onError, onChange, onSave } = props;
  const fileName = path.split(/[/\\]/).pop() || "";
  const category = getFileCategory(fileName);
  
  // 确保数据存在
  if (!data && category !== FileCategory.Unsupported) {
    return <LoadingFallback />;
  }
  
  switch (category) {
    case FileCategory.PDF:
      return (
        <Suspense fallback={<LoadingFallback />}>
          <PdfViewer
            path={path}
            data={data}
            onError={onError}
          />
        </Suspense>
      );
    
    case FileCategory.Excel:
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ExcelViewer
            data={data}
            onError={onError}
          />
        </Suspense>
      );
    
    case FileCategory.Word:
      return (
        <Suspense fallback={<LoadingFallback />}>
          <WordViewer
            path={path}
            data={data}
            onError={onError}
          />
        </Suspense>
      );
    
    case FileCategory.Image:
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ImageViewer
            path={path}
            data={typeof data === "string" ? data : ""}
            isLoading={props.isLoading}
            error={props.error}
            onRetry={onRetry}
          />
        </Suspense>
      );
    
    case FileCategory.Text:
    case FileCategory.Code:
    case FileCategory.Json:
    case FileCategory.Markdown:
      return (
        <Suspense fallback={<LoadingFallback />}>
          <MonacoViewer
            value={typeof data === "string" ? data : ""}
            language={language || "plaintext"}
            onChange={onChange}
            onSave={onSave}
          />
        </Suspense>
      );
    
    case FileCategory.PowerPoint:
      // PowerPoint 暂不支持，显示提示
      return <UnsupportedViewer fileName={fileName} category={category} />;
    
    case FileCategory.Archive:
    case FileCategory.Video:
    case FileCategory.Audio:
    case FileCategory.Unsupported:
    default:
      return <UnsupportedViewer fileName={fileName} category={category} />;
  }
}

/**
 * 预览组件包装器
 * 直接作为组件使用
 */
export function FileViewer(props: ViewerProps) {
  return <>{createViewer(props)}</>;
}