import { useEffect } from "react";
import { Plus, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProviderStore } from "@/stores/provider";
import { useOpencode } from "@/hooks";
import { ProviderCard } from "./provider/ProviderCard";
import { AddProviderDialog } from "./provider/AddProviderDialog";

export function ProviderSettings() {
  const { client, isConnected } = useOpencode();
  const {
    userProviders,
    connectedProviders,
    showAddDialog,
    setShowAddDialog,
    loadUserProviders,
    loadRegistry,
    syncWithOpenCode,
    isLoading,
  } = useProviderStore();

  useEffect(() => {
    loadUserProviders();
  }, [loadUserProviders]);

  useEffect(() => {
    if (client && isConnected) {
      loadRegistry(client);
      syncWithOpenCode(client);
    }
  }, [client, isConnected, loadRegistry, syncWithOpenCode]);

  const handleRefresh = async () => {
    if (client && isConnected) {
      try {
        await client.instance.dispose();
      } catch (e) {
        console.warn("清除 OpenCode 缓存失败:", e);
      }
      
      await loadRegistry(client);
      await syncWithOpenCode(client);
    }
  };

  const allProviders = [
    ...userProviders,
    ...Array.from(connectedProviders)
      .filter(registryId => !userProviders.some(p => p.registryId === registryId))
      .map(registryId => ({
        id: `opencode-${registryId}`,
        registryId,
        name: registryId,
        auth: { type: "oauth" as const, connected: true, method: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOpencodeManaged: true,
      })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">AI 服务商</h3>
          <p className="text-sm text-muted-foreground/70">
            配置 AI 服务商以使用不同的模型
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh} 
            disabled={isLoading || !isConnected}
            title="刷新服务商列表"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setShowAddDialog(true)} disabled={isLoading || !isConnected}>
            <Plus className="w-4 h-4 mr-2" />
            添加服务商
          </Button>
        </div>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg border-border/60">
          <Bot className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground/70 mb-1">
            等待 OpenCode 服务连接...
          </p>
          <p className="text-xs text-muted-foreground/50">
            连接后将自动加载服务商列表
          </p>
        </div>
      ) : allProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg border-border/60">
          <Bot className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground/70 mb-1">
            还没有添加任何服务商
          </p>
          <p className="text-xs text-muted-foreground/50">
            点击"添加服务商"开始配置
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {allProviders.map((provider) => (
            <ProviderCard 
              key={provider.id} 
              provider={provider}
              isOpencodeManaged={(provider as { isOpencodeManaged?: boolean }).isOpencodeManaged}
            />
          ))}
        </div>
      )}

      <AddProviderDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        client={client}
      />
    </div>
  );
}
