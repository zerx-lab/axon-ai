/**
 * 浮动权限提示组件
 * 
 * 用于显示没有与工具调用关联的权限请求
 * 这些请求会显示在消息列表底部或输入框上方
 */

import { useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShieldAlert, Check, X, Zap } from "lucide-react";
import type { PermissionRequest, PermissionReply } from "@/types/chat";
import { usePermissionStore } from "@/stores/permission";
import { useOpencode } from "@/hooks/useOpencode";

interface FloatingPermissionPromptProps {
  sessionId: string;
  className?: string;
}

/**
 * 浮动权限提示组件
 * 显示当前会话中没有与工具调用关联的权限请求
 */
export function FloatingPermissionPrompt({ sessionId, className }: FloatingPermissionPromptProps) {
  const { client } = useOpencode();
  
  // 获取当前会话的待处理权限请求 - 使用 useShallow 避免无限循环
  const pendingRequests = usePermissionStore(
    useShallow((s) => s.pendingRequests[sessionId] || [])
  );
  
  // 过滤出没有工具调用关联的权限请求
  const floatingRequests = useMemo(() => 
    pendingRequests.filter((p) => !p.tool),
    [pendingRequests]
  );
  
  // 处理权限回复
  const handleRespond = useCallback(async (permission: PermissionRequest, response: PermissionReply) => {
    if (!client) return;
    
    const store = usePermissionStore.getState();
    if (store.hasResponded(permission.id)) return;
    
    // 标记为已响应
    store.markResponded(permission.id);
    
    try {
      // 调用 SDK API 发送权限回复（包含 directory 参数，用于定位正确的 Instance）
      await client.permission.reply({
        requestID: permission.id,
        reply: response,
        directory: permission.directory,
      });
      
      // 从待处理列表移除
      store.removeRequest(permission.id, sessionId);
    } catch (error) {
      console.error("[Permission] 回复失败:", error);
    }
  }, [client, sessionId]);
  
  // 如果没有浮动的权限请求，不渲染任何内容
  if (floatingRequests.length === 0) {
    return null;
  }
  
  return (
    <div className={cn("space-y-2", className)}>
      {floatingRequests.map((permission) => (
        <FloatingPermissionCard
          key={permission.id}
          permission={permission}
          onRespond={(response) => handleRespond(permission, response)}
        />
      ))}
    </div>
  );
}

interface FloatingPermissionCardProps {
  permission: PermissionRequest;
  onRespond: (response: PermissionReply) => void;
}

/**
 * 单个浮动权限请求卡片
 */
function FloatingPermissionCard({ permission, onRespond }: FloatingPermissionCardProps) {
  const [isResponding, setIsResponding] = useState(false);
  
  const handleRespond = useCallback((response: PermissionReply) => {
    if (isResponding) return;
    setIsResponding(true);
    onRespond(response);
  }, [isResponding, onRespond]);
  
  // 获取权限描述
  const permissionDescription = getPermissionDescription(permission);
  
  return (
    <div 
      className={cn(
        "flex flex-col gap-2 p-3",
        "bg-amber-500/10 border border-amber-500/30 rounded-lg",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
    >
      {/* 权限标题和说明 */}
      <div className="flex items-start gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            需要权限
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {permissionDescription}
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5 justify-end">
        {/* 拒绝 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => handleRespond("reject")}
          disabled={isResponding}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          拒绝
        </Button>

        {/* 总是允许 */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => handleRespond("always")}
          disabled={isResponding}
        >
          <Zap className="h-3.5 w-3.5 mr-1" />
          总是允许
        </Button>

        {/* 允许一次 */}
        <Button
          variant="default"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => handleRespond("once")}
          disabled={isResponding}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          允许一次
        </Button>
      </div>
    </div>
  );
}

/**
 * 获取权限请求的描述文本
 */
function getPermissionDescription(permission: PermissionRequest): string {
  const { permission: permType, metadata } = permission;
  
  switch (permType) {
    case "edit":
      return `编辑文件 ${metadata?.filepath || ""}`;
    case "write":
      return `写入文件 ${metadata?.filepath || ""}`;
    case "read":
      return `读取文件 ${metadata?.filePath || ""}`;
    case "bash":
      return `执行命令: ${metadata?.description || metadata?.command || ""}`;
    case "glob":
      return `搜索文件: ${metadata?.pattern || ""}`;
    case "grep":
      return `搜索内容: ${metadata?.pattern || ""}`;
    case "webfetch":
      return `访问网址: ${metadata?.url || ""}`;
    case "websearch":
      return `网页搜索: ${metadata?.query || ""}`;
    case "task":
      return `执行任务: ${metadata?.description || ""}`;
    case "external_directory":
      return `访问外部目录: ${metadata?.parentDir || metadata?.filepath || metadata?.path || ""}`;
    case "doom_loop":
      return "继续执行（多次失败后）";
    default:
      return `需要权限: ${permType}`;
  }
}

export default FloatingPermissionPrompt;
