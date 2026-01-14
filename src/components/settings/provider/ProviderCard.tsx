import { Pencil, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/stores/provider";
import { useOpencodeContext } from "@/providers/OpencodeProvider";
import { useOpencode } from "@/hooks";
import type { UserProviderConfig } from "@/types/provider";
import { useState } from "react";

interface ProviderCardProps {
  provider: UserProviderConfig;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const { registry, connectedProviders, userProviders, removeProvider, removeProviderAuth, setEditingProvider, setShowAddDialog } = useProviderStore();
  const { client } = useOpencodeContext();
  const { restartBackend } = useOpencode();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const registryEntry = registry[provider.registryId];

  const isConnected = connectedProviders.has(provider.registryId) || (
    provider.auth.type === "api" 
      ? !!provider.auth.key 
      : provider.auth.connected
  );

  // 检查是否为用户在 Axon 中添加的 provider
  const isUserAdded = userProviders.some(p => p.registryId === provider.registryId);

  const handleEdit = () => {
    // 如果是用户添加的，直接编辑
    if (isUserAdded) {
      const userProvider = userProviders.find(p => p.registryId === provider.registryId);
      if (userProvider) {
        setEditingProvider(userProvider);
        setShowAddDialog(true);
      }
    } else {
      // 如果是 OpenCode 管理的，创建一个新的编辑条目（相当于添加自定义配置）
      setEditingProvider({
        ...provider,
        id: "", // 清空 id，表示需要新建
      });
      setShowAddDialog(true);
    }
  };

  const handleLogout = async () => {
    if (!isConnected) return;
    if (!confirm(`确定要退出 "${provider.name}" 的登录吗？这将清除保存的认证信息。`)) return;

    setIsLoggingOut(true);
    try {
      // 清除认证信息（auth.json + config.json options）
      await removeProviderAuth(provider.registryId, client || undefined);

      // 如果是用户添加的 Provider，同时删除本地配置记录
      if (isUserAdded) {
        const userProvider = userProviders.find(p => p.registryId === provider.registryId);
        if (userProvider) {
          await removeProvider(userProvider.id);
        }
      }

      // 重启 opencode server 以应用更改
      await restartBackend();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border border-border/60 rounded-lg hover:bg-accent/50 transition-colors duration-150">
      <div className="flex items-center gap-4 flex-1">
        <div className={cn(
          "w-10 h-10 rounded flex items-center justify-center text-sm font-medium",
          isConnected ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
        )}>
          {provider.name.substring(0, 2).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{provider.name}</p>
            {isConnected ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-muted-foreground/50" />
            )}
          </div>
          <p className="text-xs text-muted-foreground/70">
            {registryEntry?.name || provider.registryId}
            {provider.customConfig?.baseURL && ` • ${provider.customConfig.baseURL}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isConnected && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="h-8 w-8 text-muted-foreground hover:text-orange-600"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEdit}
          className="h-8 w-8"
          title="编辑"
        >
          <Pencil className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
