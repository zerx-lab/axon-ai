import { Trash2, Settings, CheckCircle2, AlertCircle, Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/stores/provider";
import { useOpencodeContext } from "@/providers/OpencodeProvider";
import type { UserProviderConfig } from "@/types/provider";
import { useState } from "react";

interface ProviderCardProps {
  provider: UserProviderConfig;
  isOpencodeManaged?: boolean;
}

export function ProviderCard({ provider, isOpencodeManaged }: ProviderCardProps) {
  const { registry, connectedProviders, removeProvider, removeProviderAuth, setEditingProvider, setShowAddDialog } = useProviderStore();
  const { client } = useOpencodeContext();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const registryEntry = registry[provider.registryId];

  const isConnected = connectedProviders.has(provider.registryId) || (
    provider.auth.type === "api" 
      ? !!provider.auth.key 
      : provider.auth.connected
  );

  const handleEdit = () => {
    if (isOpencodeManaged) return;
    setEditingProvider(provider);
    setShowAddDialog(true);
  };

  const handleRemove = async () => {
    if (isOpencodeManaged) return;
    if (confirm(`确定要删除服务商 "${provider.name}" 吗？`)) {
      await removeProvider(provider.id);
    }
  };

  const handleLogout = async () => {
    if (!isConnected) return;
    if (!confirm(`确定要退出 "${provider.name}" 的登录吗？这将清除保存的认证信息。`)) return;
    
    setIsLoggingOut(true);
    try {
      await removeProviderAuth(provider.registryId, client || undefined);
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
            {isOpencodeManaged && (
              <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-600 rounded">
                <Lock className="w-3 h-3" />
                <span>OpenCode 管理</span>
              </div>
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
        {!isOpencodeManaged && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
              className="h-8 w-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
