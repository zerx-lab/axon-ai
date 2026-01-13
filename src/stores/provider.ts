import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type {
  UserProviderConfig,
  ProviderRegistryEntry,
  ProviderAuth,
  CustomConfig,
  ProviderAuthMethod,
} from "@/types/provider";
import type { OpencodeClient } from "@/services/opencode/types";

interface ProviderStore {
  userProviders: UserProviderConfig[];
  registry: Record<string, ProviderRegistryEntry>;
  authMethods: Record<string, ProviderAuthMethod[]>;
  connectedProviders: Set<string>;
  editingProvider: UserProviderConfig | null;
  showAddDialog: boolean;
  isLoading: boolean;

  setShowAddDialog: (show: boolean) => void;
  setEditingProvider: (provider: UserProviderConfig | null) => void;
  
  loadUserProviders: () => Promise<void>;
  loadRegistry: (client: OpencodeClient) => Promise<void>;
  syncWithOpenCode: (opencodeClient: OpencodeClient) => Promise<void>;
  
  syncApiKeyToOpenCode: (client: OpencodeClient, providerID: string, apiKey: string) => Promise<boolean>;
  
  addProvider: (config: {
    registryId: string;
    name: string;
    auth: ProviderAuth;
    customConfig?: CustomConfig;
  }, client?: OpencodeClient) => Promise<void>;
  
  updateProvider: (id: string, updates: Partial<UserProviderConfig>, client?: OpencodeClient) => Promise<void>;
  removeProvider: (id: string) => Promise<void>;
  removeProviderAuth: (registryId: string, client?: OpencodeClient) => Promise<void>;
  testConnection: (id: string) => Promise<boolean>;
}

function generateId(): string {
  return `provider_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set, get) => ({
      userProviders: [],
      registry: {},
      authMethods: {},
      connectedProviders: new Set(),
      editingProvider: null,
      showAddDialog: false,
      isLoading: false,

      setShowAddDialog: (show) => set({ showAddDialog: show }),
      setEditingProvider: (provider) => set({ editingProvider: provider }),

      loadUserProviders: async () => {
        try {
          set({ isLoading: true });
          const settings = await invoke<{ providers: UserProviderConfig[] }>("get_app_settings");
          set({ userProviders: settings.providers || [] });
        } catch (error) {
          console.error("加载服务商配置失败:", error);
          toast.error("加载服务商配置失败");
        } finally {
          set({ isLoading: false });
        }
      },

      loadRegistry: async (client: OpencodeClient) => {
        try {
          const response = await client.provider.list();
          if (response.data) {
            const data = response.data as {
              all: ProviderRegistryEntry[];
              connected: string[];
              default: Record<string, string>;
            };
            
            const registryMap: Record<string, ProviderRegistryEntry> = {};
            for (const provider of data.all) {
              registryMap[provider.id] = provider;
            }
            
            set({ 
              registry: registryMap,
              connectedProviders: new Set(data.connected),
            });
          }

          const authResponse = await client.provider.auth();
          if (authResponse.data) {
            set({ authMethods: authResponse.data as Record<string, ProviderAuthMethod[]> });
          }
        } catch (error) {
          console.error("加载服务商列表失败:", error);
          toast.error("加载服务商列表失败");
          set({ registry: {} });
        }
      },

      syncWithOpenCode: async (opencodeClient: OpencodeClient) => {
        if (!opencodeClient) return;
        
        try {
          const result = await opencodeClient.provider.list();
          if (result.data) {
            const data = result.data as { 
              all: ProviderRegistryEntry[];
              connected: string[];
              default: Record<string, string>;
            };
            const connectedSet = new Set(data.connected || []);
            
            const registryMap: Record<string, ProviderRegistryEntry> = {};
            for (const provider of data.all) {
              registryMap[provider.id] = provider;
            }
            
            set({ 
              connectedProviders: connectedSet,
              registry: registryMap,
            });
            
            const currentProviders = get().userProviders;
            const needsUpdate = currentProviders.some(p => {
              const isConnected = connectedSet.has(p.registryId);
              const currentlyMarkedConnected = 
                p.auth.type === "oauth" ? p.auth.connected :
                p.auth.type === "subscription" ? p.auth.connected :
                !!p.auth.key;
              return isConnected !== currentlyMarkedConnected;
            });

            if (needsUpdate) {
              const updatedProviders = currentProviders.map(p => {
                const isConnected = connectedSet.has(p.registryId);
                if (p.auth.type === "oauth" || p.auth.type === "subscription") {
                  return {
                    ...p,
                    auth: { ...p.auth, connected: isConnected },
                  };
                }
                return p;
              });
              
              set({ userProviders: updatedProviders });
              
              await invoke("set_app_settings", {
                settings: {
                  ...(await invoke<Record<string, unknown>>("get_app_settings")),
                  providers: updatedProviders,
                }
              });
            }
          }
        } catch (error) {
          console.error("同步OpenCode Provider状态失败:", error);
        }
      },

      syncApiKeyToOpenCode: async (client: OpencodeClient, providerID: string, apiKey: string) => {
        try {
          const response = await client.auth.set({
            providerID,
            auth: {
              type: "api",
              key: apiKey,
            },
          });
          
          if (response.data === true) {
            console.log(`[Provider] API Key 已同步到 OpenCode: ${providerID}`);
            
            const listResult = await client.provider.list();
            if (listResult.data) {
              const data = listResult.data as { connected: string[] };
              set({ connectedProviders: new Set(data.connected || []) });
            }
            
            return true;
          }
          return false;
        } catch (error) {
          console.error(`同步 API Key 到 OpenCode 失败 (${providerID}):`, error);
          return false;
        }
      },

      addProvider: async (config, client) => {
        try {
          const newProvider: UserProviderConfig = {
            id: generateId(),
            registryId: config.registryId,
            name: config.name,
            auth: config.auth,
            customConfig: config.customConfig,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const updatedProviders = [...get().userProviders, newProvider];
          
          await invoke("add_user_provider", { config: newProvider });
          
          set({ userProviders: updatedProviders });
          
          if (client && config.auth.type === "api" && config.auth.key) {
            await get().syncApiKeyToOpenCode(client, config.registryId, config.auth.key);
          }
          
          toast.success("服务商添加成功");
        } catch (error) {
          console.error("添加服务商失败:", error);
          toast.error("添加服务商失败");
          throw error;
        }
      },

      updateProvider: async (id, updates, client) => {
        try {
          const currentProvider = get().userProviders.find(p => p.id === id);
          const updatedProviders = get().userProviders.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          );

          await invoke("update_user_provider", { id, updates });
          
          set({ userProviders: updatedProviders });
          
          if (client && currentProvider && updates.auth?.type === "api" && updates.auth.key) {
            await get().syncApiKeyToOpenCode(client, currentProvider.registryId, updates.auth.key);
          }
          
          toast.success("服务商更新成功");
        } catch (error) {
          console.error("更新服务商失败:", error);
          toast.error("更新服务商失败");
          throw error;
        }
      },

      removeProvider: async (id) => {
        try {
          await invoke("remove_user_provider", { id });
          
          const updatedProviders = get().userProviders.filter((p) => p.id !== id);
          set({ userProviders: updatedProviders });
          toast.success("服务商已删除");
        } catch (error) {
          console.error("删除服务商失败:", error);
          toast.error("删除服务商失败");
          throw error;
        }
      },

      removeProviderAuth: async (registryId, client) => {
        try {
          await invoke<void>("remove_provider_auth", { providerId: registryId });
          
          set((state) => {
            const newConnected = new Set(state.connectedProviders);
            newConnected.delete(registryId);
            return { connectedProviders: newConnected };
          });
          
          if (client) {
            try {
              await client.instance.dispose();
            } catch (e) {
              console.warn("清除 OpenCode 缓存失败:", e);
            }
            
            const listResult = await client.provider.list();
            if (listResult.data) {
              const data = listResult.data as { connected: string[] };
              set({ connectedProviders: new Set(data.connected || []) });
            }
          }
          
          toast.success("已退出登录");
        } catch (error) {
          console.error("退出登录失败:", error);
          toast.error("退出登录失败");
          throw error;
        }
      },

      testConnection: async (id) => {
        try {
          const result = await invoke<boolean>("test_provider_connection", { id });
          if (result) {
            toast.success("连接测试成功");
          } else {
            toast.error("连接测试失败");
          }
          return result;
        } catch (error) {
          console.error("测试连接失败:", error);
          toast.error("测试连接失败");
          return false;
        }
      },
    }),
    {
      name: "axon-provider-store",
      partialize: (state) => ({
        userProviders: state.userProviders,
      }),
      version: 1,
    }
  )
);
