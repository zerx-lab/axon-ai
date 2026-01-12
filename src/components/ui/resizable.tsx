import * as React from "react"
import { GripVerticalIcon, GripHorizontalIcon } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

// 重新导出为 ResizablePanelGroup, ResizablePanel, ResizableHandle
function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  className,
  ...props
}: React.ComponentProps<typeof Panel>) {
  return (
    <Panel
      data-slot="resizable-panel"
      className={cn("overflow-hidden", className)}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
  /** 
   * 分割方向：
   * - horizontal: 水平分割（左右面板），显示垂直拖拽条
   * - vertical: 垂直分割（上下面板），显示水平拖拽条
   */
  orientation?: "horizontal" | "vertical"
}) {
  // 垂直分割 = 上下面板 = 水平拖拽条
  const isVerticalSplit = orientation === "vertical"
  
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        // 基础样式
        "relative flex shrink-0 items-center justify-center",
        "transition-colors duration-150",
        
        // 方向特定样式
        isVerticalSplit ? [
          // 垂直分割（上下面板）：水平拖拽条
          "h-1 w-full cursor-row-resize",
          "bg-sidebar-border/40 hover:bg-primary/30 active:bg-primary/50",
          // 扩展点击区域
          "after:absolute after:inset-x-0 after:-top-1 after:-bottom-1",
        ] : [
          // 水平分割（左右面板）：垂直拖拽条
          "w-1 h-full cursor-col-resize",
          "bg-border hover:bg-primary/30 active:bg-primary/50",
          // 扩展点击区域
          "after:absolute after:inset-y-0 after:-left-1 after:-right-1",
        ],
        
        // focus 样式
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className={cn(
          "z-10 flex items-center justify-center rounded-sm border bg-border",
          isVerticalSplit ? "w-4 h-3" : "h-4 w-3"
        )}>
          {isVerticalSplit ? (
            <GripHorizontalIcon className="size-2.5" />
          ) : (
            <GripVerticalIcon className="size-2.5" />
          )}
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
