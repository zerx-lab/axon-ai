import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProviderRegistryEntry } from "@/types/provider";

interface SelectProviderStepProps {
  registry: Record<string, ProviderRegistryEntry>;
  onSelect: (registryId: string) => void;
}

export function SelectProviderStep({ registry, onSelect }: SelectProviderStepProps) {
  const { popular, all } = useMemo(() => {
    const popularIds = ["anthropic", "openai", "google", "deepseek", "ollama"];
    const popular = popularIds
      .map(id => registry[id])
      .filter(Boolean);
    
    const all = Object.values(registry).filter(
      entry => !popularIds.includes(entry.id)
    );

    return { popular, all };
  }, [registry]);

  const getProviderColor = (id: string) => {
    const colors: Record<string, string> = {
      anthropic: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      openai: "bg-green-500/10 text-green-600 border-green-500/20",
      google: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      deepseek: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
      ollama: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    };
    return colors[id] || "bg-muted text-foreground border-border/60";
  };

  return (
    <div className="space-y-6 py-2">
      {popular.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">常用服务商</h4>
          <div className="grid grid-cols-2 gap-2">
            {popular.map((entry) => (
              <Button
                key={entry.id}
                variant="outline"
                className={cn(
                  "h-auto p-4 flex-col items-start gap-2 hover:bg-accent",
                  getProviderColor(entry.id)
                )}
                onClick={() => onSelect(entry.id)}
              >
                <div className="font-medium text-sm">{entry.name}</div>
                <div className="text-xs opacity-70 text-left">
                  {entry.models ? `${Object.keys(entry.models).length} 个模型` : ""}
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {all.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">所有服务商</h4>
          <div className="grid grid-cols-3 gap-2">
            {all.map((entry) => (
              <Button
                key={entry.id}
                variant="outline"
                className="h-auto p-3 flex-col items-start gap-1 hover:bg-accent text-left"
                onClick={() => onSelect(entry.id)}
              >
                <div className="font-medium text-xs truncate w-full">
                  {entry.name}
                </div>
                <div className="text-[10px] text-muted-foreground/70">
                  {entry.id}
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {popular.length === 0 && all.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground/70">
          未找到匹配的服务商
        </div>
      )}
    </div>
  );
}
