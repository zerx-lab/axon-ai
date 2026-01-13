import { useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProviderStore } from "@/stores/provider";
import type { UserProviderConfig, CustomConfig } from "@/types/provider";
import type { OpencodeClient } from "@/services/opencode/types";

interface StandardProviderFormProps {
  registryId: string;
  onBack: () => void;
  onComplete: () => void;
  editingProvider?: UserProviderConfig | null;
  client?: OpencodeClient | null;
}

export function StandardProviderForm({
  registryId,
  onBack,
  onComplete,
  editingProvider,
  client,
}: StandardProviderFormProps) {
  const { registry, addProvider } = useProviderStore();
  const entry = registry[registryId];

  const [formData, setFormData] = useState({
    name: editingProvider?.name || entry?.name || "",
    apiKey: "",
    useCustomConfig: false,
    customBaseURL: editingProvider?.customConfig?.baseURL || entry?.api || "",
    customHeaders: editingProvider?.customConfig?.headers || {},
    enterpriseUrl: editingProvider?.customConfig?.enterpriseUrl || "",
    setCacheKey: editingProvider?.customConfig?.setCacheKey || false,
    timeout: editingProvider?.customConfig?.timeout?.toString() || "300000",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.apiKey.trim()) {
      alert("请输入 API Key");
      return;
    }

    setIsSubmitting(true);
    try {
      const customConfig: CustomConfig | undefined = formData.useCustomConfig
        ? {
            baseURL: formData.customBaseURL,
            headers: Object.keys(formData.customHeaders).length > 0 ? formData.customHeaders : undefined,
            enterpriseUrl: formData.enterpriseUrl || undefined,
            setCacheKey: formData.setCacheKey || undefined,
            timeout: formData.timeout === "false" ? false : (parseInt(formData.timeout) || undefined),
          }
        : undefined;

      await addProvider({
        registryId,
        name: formData.name,
        auth: {
          type: "api",
          key: formData.apiKey.trim(),
        },
        customConfig,
      }, client || undefined);

      onComplete();
    } catch (error) {
      console.error("添加服务商失败:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!entry) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        未找到服务商信息
      </div>
    );
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <DialogTitle>配置 {entry.name}</DialogTitle>
          <DialogDescription>{entry.id}</DialogDescription>
        </div>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto flex-1 py-2">
        <div>
          <Label>显示名称</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={entry.name}
          />
        </div>

        <div>
          <Label>API Key</Label>
          <Input
            type="password"
            placeholder={`请输入 ${entry.env[0] || "API Key"}`}
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          />
          <p className="text-xs text-muted-foreground/70 mt-1.5">
            请前往服务商官网获取 API Key
          </p>
        </div>

        <Collapsible
          open={formData.useCustomConfig}
          onOpenChange={(open) =>
            setFormData({ ...formData, useCustomConfig: open })
          }
        >
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground/70 hover:text-foreground transition-colors">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                formData.useCustomConfig ? "rotate-180" : ""
              }`}
            />
            高级配置
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            <div>
              <Label>自定义 Base URL</Label>
              <Input
                placeholder={entry.api || "https://api.example.com"}
                value={formData.customBaseURL}
                onChange={(e) =>
                  setFormData({ ...formData, customBaseURL: e.target.value })
                }
              />
              {entry.api && (
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  默认: {entry.api}
                </p>
              )}
            </div>

            {entry.id === "github-copilot" && (
              <div>
                <Label>Enterprise URL</Label>
                <Input
                  placeholder="https://github.company.com"
                  value={formData.enterpriseUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, enterpriseUrl: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground/70 mt-1.5">
                  GitHub Enterprise 服务器地址
                </p>
              </div>
            )}

            <div>
              <Label>请求超时 (毫秒)</Label>
              <Input
                placeholder="300000"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData({ ...formData, timeout: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground/70 mt-1.5">
                默认 300000 (5分钟)，输入 "false" 禁用超时
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="setCacheKey"
                checked={formData.setCacheKey}
                onChange={(e) =>
                  setFormData({ ...formData, setCacheKey: e.target.checked })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="setCacheKey" className="cursor-pointer">
                启用 Prompt Cache Key (promptCacheKey)
              </Label>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          返回
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : editingProvider ? "更新" : "添加"}
        </Button>
      </DialogFooter>
    </>
  );
}
