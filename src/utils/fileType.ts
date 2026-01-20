/**
 * 文件类型检测工具
 * 
 * 提供文件类型分类和 MIME 类型检测
 */

// 文件类别枚举
export enum FileCategory {
  Text = "text",
  Image = "image",
  PDF = "pdf",
  Word = "word",
  Excel = "excel",
  PowerPoint = "powerpoint",
  Archive = "archive",
  Video = "video",
  Audio = "audio",
  Markdown = "markdown",
  Code = "code",
  Json = "json",
  Unsupported = "unsupported"
}

// 文件扩展名映射
const EXTENSION_MAP: Record<string, FileCategory> = {
  // 文本文件
  txt: FileCategory.Text,
  log: FileCategory.Text,
  ini: FileCategory.Text,
  cfg: FileCategory.Text,
  conf: FileCategory.Text,
  
  // Markdown
  md: FileCategory.Markdown,
  mdx: FileCategory.Markdown,
  markdown: FileCategory.Markdown,
  
  // 代码文件
  js: FileCategory.Code,
  jsx: FileCategory.Code,
  ts: FileCategory.Code,
  tsx: FileCategory.Code,
  py: FileCategory.Code,
  java: FileCategory.Code,
  c: FileCategory.Code,
  cpp: FileCategory.Code,
  h: FileCategory.Code,
  hpp: FileCategory.Code,
  cs: FileCategory.Code,
  php: FileCategory.Code,
  rb: FileCategory.Code,
  go: FileCategory.Code,
  rs: FileCategory.Code,
  swift: FileCategory.Code,
  kt: FileCategory.Code,
  scala: FileCategory.Code,
  r: FileCategory.Code,
  lua: FileCategory.Code,
  pl: FileCategory.Code,
  sh: FileCategory.Code,
  bash: FileCategory.Code,
  zsh: FileCategory.Code,
  fish: FileCategory.Code,
  ps1: FileCategory.Code,
  bat: FileCategory.Code,
  cmd: FileCategory.Code,
  vue: FileCategory.Code,
  svelte: FileCategory.Code,
  html: FileCategory.Code,
  htm: FileCategory.Code,
  xml: FileCategory.Code,
  css: FileCategory.Code,
  scss: FileCategory.Code,
  sass: FileCategory.Code,
  less: FileCategory.Code,
  
  // JSON/配置文件
  json: FileCategory.Json,
  jsonc: FileCategory.Json,
  json5: FileCategory.Json,
  yaml: FileCategory.Json,
  yml: FileCategory.Json,
  toml: FileCategory.Json,
  
  // 图片文件
  png: FileCategory.Image,
  jpg: FileCategory.Image,
  jpeg: FileCategory.Image,
  gif: FileCategory.Image,
  bmp: FileCategory.Image,
  svg: FileCategory.Image,
  webp: FileCategory.Image,
  ico: FileCategory.Image,
  tiff: FileCategory.Image,
  tif: FileCategory.Image,
  
  // PDF
  pdf: FileCategory.PDF,
  
  // Word 文档
  doc: FileCategory.Word,
  docx: FileCategory.Word,
  rtf: FileCategory.Word,
  odt: FileCategory.Word,
  
  // Excel 表格
  xls: FileCategory.Excel,
  xlsx: FileCategory.Excel,
  csv: FileCategory.Excel,
  ods: FileCategory.Excel,
  tsv: FileCategory.Excel,
  
  // PowerPoint 演示文稿
  ppt: FileCategory.PowerPoint,
  pptx: FileCategory.PowerPoint,
  odp: FileCategory.PowerPoint,
  
  // 压缩文件
  zip: FileCategory.Archive,
  rar: FileCategory.Archive,
  "7z": FileCategory.Archive,
  tar: FileCategory.Archive,
  gz: FileCategory.Archive,
  bz2: FileCategory.Archive,
  xz: FileCategory.Archive,
  
  // 视频文件
  mp4: FileCategory.Video,
  avi: FileCategory.Video,
  mkv: FileCategory.Video,
  mov: FileCategory.Video,
  wmv: FileCategory.Video,
  flv: FileCategory.Video,
  webm: FileCategory.Video,
  m4v: FileCategory.Video,
  mpg: FileCategory.Video,
  mpeg: FileCategory.Video,
  
  // 音频文件
  mp3: FileCategory.Audio,
  wav: FileCategory.Audio,
  flac: FileCategory.Audio,
  aac: FileCategory.Audio,
  ogg: FileCategory.Audio,
  wma: FileCategory.Audio,
  m4a: FileCategory.Audio,
  opus: FileCategory.Audio,
};

// MIME 类型映射
const MIME_TYPES: Record<string, string> = {
  // 文本
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  
  // 代码
  js: "application/javascript",
  jsx: "application/javascript",
  ts: "application/typescript",
  tsx: "application/typescript",
  json: "application/json",
  xml: "application/xml",
  
  // 图片
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  
  // 文档
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  
  // 其他
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
};

/**
 * 获取文件扩展名
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

/**
 * 获取文件类别
 */
export function getFileCategory(fileName: string): FileCategory {
  const ext = getFileExtension(fileName);
  return EXTENSION_MAP[ext] || FileCategory.Unsupported;
}

/**
 * 获取 MIME 类型
 */
export function getMimeType(fileName: string): string {
  const ext = getFileExtension(fileName);
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * 检查是否为文本文件
 */
export function isTextFile(fileName: string): boolean {
  const category = getFileCategory(fileName);
  return [
    FileCategory.Text,
    FileCategory.Code,
    FileCategory.Json,
    FileCategory.Markdown
  ].includes(category);
}

/**
 * 检查是否为二进制文件
 */
export function isBinaryFile(fileName: string): boolean {
  const category = getFileCategory(fileName);
  return [
    FileCategory.Image,
    FileCategory.PDF,
    FileCategory.Word,
    FileCategory.Excel,
    FileCategory.PowerPoint,
    FileCategory.Archive,
    FileCategory.Video,
    FileCategory.Audio
  ].includes(category);
}

/**
 * 检查是否为可预览文件
 */
export function isPreviewable(fileName: string): boolean {
  const category = getFileCategory(fileName);
  return category !== FileCategory.Unsupported &&
         category !== FileCategory.Archive &&
         category !== FileCategory.Video &&
         category !== FileCategory.Audio;
}

/**
 * 获取文件大小限制（字节）
 */
export function getFileSizeLimit(fileName: string): number {
  const category = getFileCategory(fileName);
  
  const SIZE_LIMITS: Record<FileCategory, number> = {
    [FileCategory.Text]: 10 * 1024 * 1024,        // 10MB
    [FileCategory.Code]: 10 * 1024 * 1024,        // 10MB
    [FileCategory.Json]: 10 * 1024 * 1024,        // 10MB
    [FileCategory.Markdown]: 10 * 1024 * 1024,    // 10MB
    [FileCategory.Image]: 20 * 1024 * 1024,       // 20MB
    [FileCategory.PDF]: 50 * 1024 * 1024,         // 50MB
    [FileCategory.Word]: 20 * 1024 * 1024,        // 20MB
    [FileCategory.Excel]: 10 * 1024 * 1024,       // 10MB
    [FileCategory.PowerPoint]: 30 * 1024 * 1024,  // 30MB
    [FileCategory.Archive]: 0,                     // 不支持
    [FileCategory.Video]: 0,                       // 不支持
    [FileCategory.Audio]: 0,                       // 不支持
    [FileCategory.Unsupported]: 0,                 // 不支持
  };
  
  return SIZE_LIMITS[category] || 0;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}