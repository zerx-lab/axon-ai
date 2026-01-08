/**
 * 权限请求提示组件
 * 
 * 在工具执行前显示权限确认按钮
 * 参考: opencode/packages/ui/src/components/message-part.tsx
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X, Zap, ShieldCheck, ShieldAlert } from "lucide-react";
import type { PermissionRequest, PermissionReply } from "@/types/chat";
import { usePermissionStore, shouldAutoAccept } from "@/stores/permission";

// ============== 权限提示按钮组件 ==============

interface PermissionActionsProps {
  permission: PermissionRequest;
  onRespond: (response: PermissionReply) => void;
  disabled?: boolean;
}

/**
 * 权限操作按钮组
 * 三个按钮：拒绝、总是允许、允许一次
 */
export function PermissionActions({ 
  permission: _permission, 
  onRespond, 
  disabled = false 
}: PermissionActionsProps) {
  // _permission 可用于后续扩展，如显示权限类型等
  void _permission;
  const [isResponding, setIsResponding] = useState(false);
  
  const handleRespond = useCallback((response: PermissionReply) => {
    if (isResponding || disabled) return;
    setIsResponding(true);
    onRespond(response);
  }, [isResponding, disabled, onRespond]);

  return (
    <div 
      className={cn(
        "flex items-center gap-2 p-3 mt-2",
        "bg-accent/30 rounded-md border border-border/60",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
    >
      {/* 权限图标和说明 */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          需要权限执行此操作
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 拒绝 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => handleRespond("reject")}
          disabled={isResponding || disabled}
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
          disabled={isResponding || disabled}
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
          disabled={isResponding || disabled}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          允许一次
        </Button>
      </div>
    </div>
  );
}

// ============== 权限提示包装组件 ==============

interface PermissionPromptProps {
  sessionId: string;
  toolCallId: string;
  children: React.ReactNode;
  onRespond?: (permissionId: string, response: PermissionReply) => void;
}

/**
 * 权限提示包装组件
 * 用于包装工具内容，在需要权限时显示提示
 */
export function PermissionPrompt({
  sessionId,
  toolCallId,
  children,
  onRespond,
}: PermissionPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const pendingRequests = usePermissionStore((s) => s.pendingRequests[sessionId] || []);
  const removeRequest = usePermissionStore((s) => s.removeRequest);
  const markResponded = usePermissionStore((s) => s.markResponded);
  const hasResponded = usePermissionStore((s) => s.hasResponded);
  const isAutoAccepting = usePermissionStore((s) => s.isAutoAccepting(sessionId));

  // 查找匹配当前工具调用的权限请求
  const permission = pendingRequests.find(
    (p) => p.tool?.callID === toolCallId
  );

  // 延迟显示权限提示（避免闪烁）
  useEffect(() => {
    if (permission) {
      const timeout = setTimeout(() => setShowPrompt(true), 50);
      return () => clearTimeout(timeout);
    } else {
      setShowPrompt(false);
    }
  }, [permission]);

  // 自动批准检查
  useEffect(() => {
    if (!permission) return;
    if (hasResponded(permission.id)) return;
    
    // 如果启用了自动批准且是可自动批准的权限类型
    if (isAutoAccepting && shouldAutoAccept(permission)) {
      handleRespond("once");
    }
  }, [permission, isAutoAccepting]);

  const handleRespond = useCallback((response: PermissionReply) => {
    if (!permission) return;
    if (hasResponded(permission.id)) return;

    // 标记为已响应
    markResponded(permission.id);
    
    // 从待处理列表移除
    removeRequest(permission.id, sessionId);
    
    // 调用外部回调
    onRespond?.(permission.id, response);
  }, [permission, sessionId, removeRequest, markResponded, hasResponded, onRespond]);

  return (
    <div data-has-permission={!!permission}>
      {children}
      {showPrompt && permission && (
        <PermissionActions
          permission={permission}
          onRespond={handleRespond}
        />
      )}
    </div>
  );
}

// ============== 自动批准开关按钮 ==============

interface AutoAcceptToggleProps {
  sessionId: string;
  className?: string;
}

/**
 * 自动批准编辑权限的开关按钮
 */
export function AutoAcceptToggle({ sessionId, className }: AutoAcceptToggleProps) {
  const isAutoAccepting = usePermissionStore((s) => s.isAutoAccepting(sessionId));
  const toggleAutoAccept = usePermissionStore((s) => s.toggleAutoAccept);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 px-2 text-xs gap-1.5",
        isAutoAccepting 
          ? "text-green-600 hover:text-green-700 hover:bg-green-500/10" 
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => toggleAutoAccept(sessionId)}
      title={isAutoAccepting ? "已启用自动批准编辑权限" : "点击启用自动批准编辑权限"}
    >
      <ShieldCheck className={cn(
        "h-3.5 w-3.5",
        isAutoAccepting && "text-green-500"
      )} />
      <span className="hidden sm:inline">
        {isAutoAccepting ? "自动批准" : "手动批准"}
      </span>
    </Button>
  );
}

export default PermissionPrompt;
