/**
 * 模型选择器组件
 * 用于选择 AI 模型（Provider/Model）
 */

import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Cpu } from "lucide-react";
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

export function ModelSelector({
  providers,
  selectedModel,
  onSelectModel,
  isLoading = false,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const { t } = useTranslation();

  // 构建当前选择的值（格式: providerId/modelId）
  // 确保 providerId 和 modelId 都存在才构建有效值
  const currentValue = selectedModel && selectedModel.providerId && selectedModel.modelId
    ? `${selectedModel.providerId}/${selectedModel.modelId}`
    : "";

  // 处理选择变更
  const handleValueChange = (value: string) => {
    const [providerId, modelId] = value.split("/");
    if (providerId && modelId) {
      onSelectModel(providerId, modelId);
    }
  };

  // 获取当前选中模型的显示名称
  const getDisplayName = () => {
    if (!selectedModel) return t("chat.selectModel");
    
    // 确保 providerId 和 modelId 都存在
    if (!selectedModel.providerId || !selectedModel.modelId) {
      return t("chat.selectModel");
    }
    
    // 在 providers 中查找对应的显示名称
    for (const provider of providers) {
      const model = provider.models.find(
        (m) => m.id === selectedModel.modelId && m.provider === selectedModel.providerId
      );
      if (model) {
        return `${provider.name} / ${model.name}`;
      }
    }
    
    // 如果 providers 还没加载完成，但 selectedModel 存在，显示原始 ID
    // 这里确保不会显示 undefined
    return `${selectedModel.providerId} / ${selectedModel.modelId}`;
  };

  // 没有可用模型
  if (!isLoading && providers.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2 border border-input rounded-md">
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2 border border-input rounded-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("chat.loadingModels")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full min-w-[200px]">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 shrink-0" />
            <SelectValue placeholder={t("chat.selectModel")}>
              <span className="truncate">{getDisplayName()}</span>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {providers.map((provider) => (
            <SelectGroup key={provider.id}>
              <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                {provider.name}
              </SelectLabel>
              {provider.models.map((model) => (
                <SelectItem
                  key={`${provider.id}/${model.id}`}
                  value={`${provider.id}/${model.id}`}
                >
                  {model.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
