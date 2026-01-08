/**
 * 推理深度变体选择器组件
 * 
 * 用于选择 AI 模型的推理深度（如 low, medium, high, max）
 * 参考 opencode 的 variant 循环切换设计
 */

import { useTranslation } from "react-i18next";
import { Brain, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { useState } from "react";

/** 支持的 variant 类型 */
const VARIANT_KEYS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

interface VariantSelectorProps {
  /** 可用的 variants 列表 */
  variants: string[];
  /** 当前选中的 variant */
  selectedVariant: string | undefined;
  /** 选择 variant 回调 */
  onSelectVariant: (variant: string | undefined) => void;
  /** 循环切换 variant 回调 */
  onCycleVariant?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 变体模式：按钮循环切换 或 下拉选择 */
  mode?: "cycle" | "dropdown";
}

/**
 * 获取 variant 的翻译 key
 */
function getVariantTranslationKey(variant: string): string {
  if (VARIANT_KEYS.includes(variant as typeof VARIANT_KEYS[number])) {
    return variant;
  }
  return variant;
}

/**
 * Variant 选择器 - 循环切换模式
 * 点击按钮循环切换 variant
 */
function VariantCycleButton({
  variants,
  selectedVariant,
  onCycleVariant,
  disabled,
  className,
}: VariantSelectorProps) {
  const { t } = useTranslation();
  
  if (variants.length === 0) {
    return null;
  }

  // 获取显示名称
  const displayName = selectedVariant 
    ? t(`chat.variant.${getVariantTranslationKey(selectedVariant)}`, { defaultValue: selectedVariant })
    : t("chat.variant.default");

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onCycleVariant}
      disabled={disabled}
      className={cn(
        "h-8 px-2.5 gap-1.5",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      title={t("chat.thinkingEffort")}
    >
      <Brain className="h-3.5 w-3.5" />
      <span className="text-sm capitalize">
        {displayName}
      </span>
    </Button>
  );
}

/**
 * Variant 选择器 - 下拉选择模式
 * 点击展开下拉菜单选择 variant
 */
function VariantDropdown({
  variants,
  selectedVariant,
  onSelectVariant,
  disabled,
  className,
}: VariantSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  
  if (variants.length === 0) {
    return null;
  }

  // 获取显示名称
  const displayName = selectedVariant 
    ? t(`chat.variant.${getVariantTranslationKey(selectedVariant)}`, { defaultValue: selectedVariant })
    : t("chat.variant.default");

  const handleSelect = (variant: string) => {
    // 如果选择当前已选中的，则取消选择（恢复默认）
    if (variant === selectedVariant) {
      onSelectVariant(undefined);
    } else {
      onSelectVariant(variant);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5",
            "h-8 px-2.5 rounded-lg",
            "text-sm text-muted-foreground",
            "hover:bg-muted/50 hover:text-foreground",
            "transition-colors duration-100",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            disabled && "pointer-events-none opacity-50",
            className
          )}
          disabled={disabled}
          title={t("chat.thinkingEffort")}
        >
          <Brain className="h-3.5 w-3.5" />
          <span className="capitalize">
            {displayName}
          </span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0 rounded-lg shadow-lg border border-border"
        align="end"
        sideOffset={8}
      >
        <Command className="rounded-lg">
          <CommandList>
            <CommandGroup heading={t("chat.thinkingEffort")}>
              {/* 默认选项 */}
              <CommandItem
                value="default"
                onSelect={() => {
                  onSelectVariant(undefined);
                  setOpen(false);
                }}
                className="gap-2"
              >
                <div
                  className={cn(
                    "flex items-center justify-center h-4 w-4 shrink-0",
                    "rounded-sm border",
                    selectedVariant === undefined
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input bg-transparent"
                  )}
                >
                  {selectedVariant === undefined && <Check className="h-3 w-3" />}
                </div>
                <div className="flex flex-col">
                  <span>{t("chat.variant.default")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("chat.variant.defaultDesc")}
                  </span>
                </div>
              </CommandItem>
              
              {/* Variant 选项 */}
              {variants.map((variant) => {
                const isSelected = variant === selectedVariant;
                const variantKey = getVariantTranslationKey(variant);
                const variantName = t(`chat.variant.${variantKey}`, { defaultValue: variant });
                const variantDesc = t(`chat.variant.${variantKey}Desc`, { defaultValue: "" });
                
                return (
                  <CommandItem
                    key={variant}
                    value={variant}
                    onSelect={() => handleSelect(variant)}
                    className="gap-2"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center h-4 w-4 shrink-0",
                        "rounded-sm border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="capitalize">
                        {variantName}
                      </span>
                      {variantDesc && (
                        <span className="text-xs text-muted-foreground">
                          {variantDesc}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Variant 选择器主组件
 * 根据 mode 属性决定使用哪种交互模式
 */
export function VariantSelector({
  mode = "dropdown",
  ...props
}: VariantSelectorProps) {
  // 如果没有可用的 variants，不渲染
  if (props.variants.length === 0) {
    return null;
  }

  if (mode === "cycle") {
    return <VariantCycleButton {...props} />;
  }

  return <VariantDropdown {...props} />;
}

export default VariantSelector;
