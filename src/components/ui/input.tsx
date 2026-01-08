import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 基础样式
        "h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base md:text-sm",
        "border-border/60 dark:bg-input/30",
        // 文本样式
        "placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground",
        // 过渡效果
        "transition-colors duration-150 outline-none",
        // 聚焦样式 - 简洁无高亮
        "focus-visible:border-border",
        // 文件上传样式
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // 禁用和错误状态
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
