import { useEffect, useCallback } from "react";
import { Plus, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProviderStore } from "@/stores/provider";
import { useOpencodeContext } from "@/providers";
import { useServiceStore } from "@/stores/service";
import { ProviderCard } from "./provider/ProviderCard";
import { AddProviderDialog } from "./provider/AddProviderDialog";

export function ProviderSettings() {
  const { client, isConnected, state } = useOpencodeContext();

  // 使用 ServiceStore 的统一重启方法
  const restart = useServiceStore(s => s.restart);
  const isRestarting = useServiceStore(s => s.isRestarting);

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

  // 判断是否正在进行中（服务启动/连接等）
  const isInProgress = ["downloading", "starting", "uninitialized"].includes(
    state.backendStatus.type
  ) || state.connectionState.status === "connecting";

  useEffect(() => {
    loadUserProviders();
  }, [loadUserProviders]);

  useEffect(() => {
    if (client && isConnected) {
      loadRegistry(client);
      syncWithOpenCode(client);
    }
  }, [client, isConnected, loadRegistry, syncWithOpenCode]);

  // 处理刷新/重启（使用统一的 ServiceStore.restart）
  const handleRefresh = useCallback(async () => {
    if (isRestarting || isInProgress) return;
    await restart({ reason: "正在刷新 AI 服务商配置..." });
  }, [restart, isRestarting, isInProgress]);

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
            disabled={isRestarting || isInProgress}
            title="重启服务以刷新配置"
          >
            <RefreshCw className={`w-4 h-4 ${isRestarting || isInProgress ? "animate-spin" : ""}`} />
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
