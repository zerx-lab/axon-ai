/**
 * 快捷提示按钮组件
 * 参考 Claude 风格的快捷提示，提供常用操作快捷入口
 */

import { useTranslation } from "react-i18next";
import { Pencil, GraduationCap, Code2, Coffee, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickPromptsProps {
  onSelect?: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

interface PromptItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
}

// 预定义的快捷提示（prompt 内容通过 i18n 获取）
const PROMPT_ITEMS: PromptItem[] = [
  { key: "write", icon: Pencil },
  { key: "learn", icon: GraduationCap },
  { key: "code", icon: Code2 },
  { key: "life", icon: Coffee },
  { key: "random", icon: Sparkles },
];

export function QuickPrompts({
  onSelect,
  disabled = false,
  className,
}: QuickPromptsProps) {
  const { t } = useTranslation();

  const handleClick = (key: string) => {
    if (!disabled && onSelect) {
      // 通过 i18n 获取对应语言的 prompt 内容
      onSelect(t(`chat.quickPromptContent.${key}`));
    }
  };

  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {PROMPT_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => handleClick(item.key)}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-2",
              "px-4 py-2 rounded-full",
              "text-sm font-medium",
              "border border-border bg-background",
              "text-muted-foreground",
              "transition-all duration-200",
              "hover:bg-muted/50 hover:text-foreground hover:border-border/80",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t(`chat.quickPrompts.${item.key}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
