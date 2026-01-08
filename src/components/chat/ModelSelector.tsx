/**
 * 模型选择器组件
 * 用于选择 AI 模型（Provider/Model），支持搜索功能
 * 设计风格：Zed-style - 扁平、精致、小圆角
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Cpu, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type { Provider, Model } from "@/stores/chat";

interface ModelSelectorProps {
  providers: Provider[];
  models: Model[];
  selectedModel: { providerId: string; modelId: string } | null;
  onSelectModel: (providerId: string, modelId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * 自定义搜索过滤函数
 * 只匹配 Provider 名称和 Model 名称，不匹配 ID
 * 使用包含匹配（contains）而非模糊匹配
 */
function createModelFilter(providers: Provider[]) {
  // 构建搜索索引：value -> 可搜索文本
  const searchIndex = new Map<string, string>();
  
  for (const provider of providers) {
    for (const model of provider.models) {
      const value = `${provider.id}/${model.id}`;
      // 只索引显示名称，用于搜索
      const searchText = `${provider.name} ${model.name}`.toLowerCase();
      searchIndex.set(value, searchText);
    }
  }

  return (value: string, search: string): number => {
    if (!search) return 1;
    
    const searchText = searchIndex.get(value);
    if (!searchText) return 0;
    
    const searchLower = search.toLowerCase().trim();
    
    // 支持多关键词搜索（空格分隔）
    const keywords = searchLower.split(/\s+/).filter(Boolean);
    
    // 所有关键词都必须匹配
    const allMatch = keywords.every(keyword => searchText.includes(keyword));
    
    if (!allMatch) return 0;
    
    // 计算匹配分数：完全匹配 > 开头匹配 > 包含匹配
    let score = 1;
    
    // 如果完全匹配模型名称，给更高分数
    if (searchText.includes(searchLower)) {
      score += 0.5;
    }
    
    // 如果从开头匹配，给更高分数
    if (searchText.startsWith(searchLower)) {
      score += 0.3;
    }
    
    return score;
  };
}

export function ModelSelector({
  providers,
  selectedModel,
  onSelectModel,
  isLoading = false,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // 创建自定义过滤函数
  const filterFn = useMemo(() => createModelFilter(providers), [providers]);

  // 构建当前选择的值（格式: providerId/modelId）
  const currentValue = selectedModel && selectedModel.providerId && selectedModel.modelId
    ? `${selectedModel.providerId}/${selectedModel.modelId}`
    : "";

  // 处理选择模型
  const handleSelect = (value: string) => {
    const [providerId, modelId] = value.split("/");
    if (providerId && modelId) {
      onSelectModel(providerId, modelId);
      setOpen(false);
    }
  };

  // 获取当前选中模型的显示名称
  const getDisplayInfo = () => {
    if (!selectedModel || !selectedModel.providerId || !selectedModel.modelId) {
      return { provider: null, model: t("chat.selectModel") };
    }
    
    // 在 providers 中查找对应的显示名称
    for (const provider of providers) {
      const model = provider.models.find(
        (m) => m.id === selectedModel.modelId && m.provider === selectedModel.providerId
      );
      if (model) {
        return { provider: provider.name, model: model.name };
      }
    }
    
    return { provider: selectedModel.providerId, model: selectedModel.modelId };
  };

  const displayInfo = getDisplayInfo();

  // 没有可用模型
  if (!isLoading && providers.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2 border border-input rounded-sm bg-background">
          <Cpu className="h-4 w-4" />
          <span>{t("chat.noModels")}</span>
        </div>
      </div>
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2 border border-input rounded-sm bg-background">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("chat.loadingModels")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-between gap-2",
              "min-w-[180px] max-w-[280px] h-8 px-2.5",
              "text-sm rounded-sm",
              "border border-input bg-background",
              "transition-colors duration-100",
              "hover:bg-accent/50",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex items-center gap-1 min-w-0 truncate">
                {displayInfo.provider && (
                  <>
                    <span className="text-muted-foreground truncate">
                      {displayInfo.provider}
                    </span>
                    <span className="text-muted-foreground/60">/</span>
                  </>
                )}
                <span className="truncate font-medium">{displayInfo.model}</span>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[320px] p-0 rounded-sm shadow-lg border border-border"
          align="end"
          sideOffset={4}
        >
          <Command className="rounded-sm" filter={filterFn}>
            <CommandInput placeholder={t("chat.searchModel")} />
            <CommandList>
              <CommandEmpty>{t("chat.noModelFound")}</CommandEmpty>
              {providers.map((provider) => (
                <CommandGroup key={provider.id} heading={provider.name}>
                  {provider.models.map((model) => {
                    const value = `${provider.id}/${model.id}`;
                    const isSelected = currentValue === value;
                    return (
                      <CommandItem
                        key={value}
                        value={value}
                        onSelect={handleSelect}
                        className="gap-2"
                      >
                        <div className={cn(
                          "flex items-center justify-center h-4 w-4 shrink-0",
                          "rounded-sm border",
                          isSelected 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-input bg-transparent"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{model.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
