/**
 * 附件管理 Hook
 * 
 * 支持图片附件的添加、删除和状态管理
 * 参考: opencode/packages/app/src/context/prompt.tsx
 */

import { useState, useCallback } from "react";
import { generateId } from "@/types/chat";

// ============== 类型定义 ==============

/** 支持的图片 MIME 类型 */
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** 支持的 PDF MIME 类型 */
export const SUPPORTED_PDF_TYPES = ["application/pdf"] as const;

/** 所有支持的附件类型 */
export const SUPPORTED_ATTACHMENT_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_PDF_TYPES,
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];
export type SupportedPdfType = (typeof SUPPORTED_PDF_TYPES)[number];
export type SupportedAttachmentType = (typeof SUPPORTED_ATTACHMENT_TYPES)[number];

/** 图片附件 */
export interface ImageAttachment {
  type: "image";
  id: string;
  filename: string;
  mime: SupportedImageType;
  /** Base64 Data URL (data:image/xxx;base64,...) */
  dataUrl: string;
}

/** PDF 附件 */
export interface PdfAttachment {
  type: "pdf";
  id: string;
  filename: string;
  mime: SupportedPdfType;
  /** Base64 Data URL */
  dataUrl: string;
}

/** 附件联合类型 */
export type Attachment = ImageAttachment | PdfAttachment;

/** 最大附件数量 */
export const MAX_ATTACHMENTS = 10;

/** 最大单个附件大小 (10MB) */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

// ============== 工具函数 ==============

/**
 * 判断是否为支持的图片类型
 */
export function isSupportedImageType(
  mime: string
): mime is SupportedImageType {
  return SUPPORTED_IMAGE_TYPES.includes(mime as SupportedImageType);
}

/**
 * 判断是否为支持的 PDF 类型
 */
export function isSupportedPdfType(mime: string): mime is SupportedPdfType {
  return SUPPORTED_PDF_TYPES.includes(mime as SupportedPdfType);
}

/**
 * 判断是否为支持的附件类型
 */
export function isSupportedAttachmentType(
  mime: string
): mime is SupportedAttachmentType {
  return SUPPORTED_ATTACHMENT_TYPES.includes(mime as SupportedAttachmentType);
}

/**
 * 将 File 转换为 Base64 Data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("读取文件失败"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 将 Blob 转换为 Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("读取 Blob 失败"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ============== Hook ==============

export interface UseAttachmentsReturn {
  /** 当前附件列表 */
  attachments: Attachment[];
  /** 添加图片附件 */
  addImageAttachment: (
    dataUrl: string,
    filename: string,
    mime: SupportedImageType
  ) => void;
  /** 添加 PDF 附件 */
  addPdfAttachment: (
    dataUrl: string,
    filename: string,
    mime: SupportedPdfType
  ) => void;
  /** 从 File 对象添加附件 */
  addAttachmentFromFile: (file: File) => Promise<void>;
  /** 从 Blob 对象添加附件（用于剪贴板粘贴） */
  addAttachmentFromBlob: (blob: Blob, filename?: string) => Promise<void>;
  /** 删除附件 */
  removeAttachment: (id: string) => void;
  /** 清空所有附件 */
  clearAttachments: () => void;
  /** 是否达到最大附件数 */
  isMaxAttachments: boolean;
  /** 是否有附件 */
  hasAttachments: boolean;
}

/**
 * 附件管理 Hook
 */
export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const addImageAttachment = useCallback(
    (dataUrl: string, filename: string, mime: SupportedImageType) => {
      setAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) {
          console.warn(`已达到最大附件数量限制 (${MAX_ATTACHMENTS})`);
          return prev;
        }
        const attachment: ImageAttachment = {
          type: "image",
          id: generateId(),
          filename,
          mime,
          dataUrl,
        };
        return [...prev, attachment];
      });
    },
    []
  );

  const addPdfAttachment = useCallback(
    (dataUrl: string, filename: string, mime: SupportedPdfType) => {
      setAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) {
          console.warn(`已达到最大附件数量限制 (${MAX_ATTACHMENTS})`);
          return prev;
        }
        const attachment: PdfAttachment = {
          type: "pdf",
          id: generateId(),
          filename,
          mime,
          dataUrl,
        };
        return [...prev, attachment];
      });
    },
    []
  );

  const addAttachmentFromFile = useCallback(
    async (file: File) => {
      // 检查文件类型
      if (!isSupportedAttachmentType(file.type)) {
        console.warn(`不支持的文件类型: ${file.type}`);
        return;
      }

      // 检查文件大小
      if (file.size > MAX_ATTACHMENT_SIZE) {
        console.warn(
          `文件过大: ${file.size} bytes (最大 ${MAX_ATTACHMENT_SIZE} bytes)`
        );
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        if (isSupportedImageType(file.type)) {
          addImageAttachment(dataUrl, file.name, file.type);
        } else if (isSupportedPdfType(file.type)) {
          addPdfAttachment(dataUrl, file.name, file.type);
        }
      } catch (error) {
        console.error("读取文件失败:", error);
      }
    },
    [addImageAttachment, addPdfAttachment]
  );

  const addAttachmentFromBlob = useCallback(
    async (blob: Blob, filename?: string) => {
      // 检查文件类型
      if (!isSupportedAttachmentType(blob.type)) {
        console.warn(`不支持的 Blob 类型: ${blob.type}`);
        return;
      }

      // 检查文件大小
      if (blob.size > MAX_ATTACHMENT_SIZE) {
        console.warn(
          `Blob 过大: ${blob.size} bytes (最大 ${MAX_ATTACHMENT_SIZE} bytes)`
        );
        return;
      }

      try {
        const dataUrl = await blobToDataUrl(blob);
        // 生成默认文件名
        const defaultFilename =
          filename || `attachment-${Date.now()}.${blob.type.split("/")[1]}`;

        if (isSupportedImageType(blob.type)) {
          addImageAttachment(dataUrl, defaultFilename, blob.type);
        } else if (isSupportedPdfType(blob.type)) {
          addPdfAttachment(dataUrl, defaultFilename, blob.type);
        }
      } catch (error) {
        console.error("读取 Blob 失败:", error);
      }
    },
    [addImageAttachment, addPdfAttachment]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    addImageAttachment,
    addPdfAttachment,
    addAttachmentFromFile,
    addAttachmentFromBlob,
    removeAttachment,
    clearAttachments,
    isMaxAttachments: attachments.length >= MAX_ATTACHMENTS,
    hasAttachments: attachments.length > 0,
  };
}
