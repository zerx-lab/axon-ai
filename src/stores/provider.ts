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
  OAuthAuthorization,
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
  syncProviderOptionsToOpenCode: (client: OpencodeClient, providerID: string, customConfig: CustomConfig) => Promise<boolean>;
  
  // OAuth 相关方法
  startOAuthAuthorize: (client: OpencodeClient, providerID: string, method: number) => Promise<OAuthAuthorization | null>;
  completeOAuthCallback: (client: OpencodeClient, providerID: string, method: number, code?: string) => Promise<boolean>;
  
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

      syncProviderOptionsToOpenCode: async (client: OpencodeClient, providerID: string, customConfig: CustomConfig) => {
        try {
          // 构建 provider options 配置
          const options: Record<string, unknown> = {};

          if (customConfig.baseURL) {
            options.baseURL = customConfig.baseURL;
          }
          if (customConfig.enterpriseUrl) {
            options.enterpriseUrl = customConfig.enterpriseUrl;
          }
          if (customConfig.setCacheKey !== undefined) {
            options.setCacheKey = customConfig.setCacheKey;
          }
          if (customConfig.timeout !== undefined) {
            options.timeout = customConfig.timeout;
          }
          // headers 也在 options 里面
          if (customConfig.headers && Object.keys(customConfig.headers).length > 0) {
            options.headers = customConfig.headers;
          }

          // 构建 provider 级别配置（whitelist、blacklist）
          const providerConfig: Record<string, unknown> = {};

          if (customConfig.whitelist && customConfig.whitelist.length > 0) {
            providerConfig.whitelist = customConfig.whitelist;
          }
          if (customConfig.blacklist && customConfig.blacklist.length > 0) {
            providerConfig.blacklist = customConfig.blacklist;
          }

          // 只有当有配置项时才更新
          if (Object.keys(options).length === 0 && Object.keys(providerConfig).length === 0) {
            return true;
          }

          // 合并 options 到 providerConfig
          if (Object.keys(options).length > 0) {
            providerConfig.options = options;
          }

          // 使用 config.update 同步到 opencode 配置文件
          await client.config.update({
            config: {
              provider: {
                [providerID]: providerConfig,
              },
            },
          });

          // 刷新缓存
          await client.instance.dispose();

          return true;
        } catch (error) {
          console.error(`同步 Provider 配置到 OpenCode 失败 (${providerID}):`, error);
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

          // 同步高级配置（options）到 opencode 配置文件
          if (client && config.customConfig) {
            await get().syncProviderOptionsToOpenCode(client, config.registryId, config.customConfig);
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

          // 同步高级配置（options）到 opencode 配置文件
          if (client && currentProvider && updates.customConfig) {
            await get().syncProviderOptionsToOpenCode(client, currentProvider.registryId, updates.customConfig);
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
          // Rust 后端负责清理 auth.json 和 config.json
          await invoke<void>("remove_provider_auth", { providerId: registryId });

          set((state) => {
            const newConnected = new Set(state.connectedProviders);
            newConnected.delete(registryId);
            return { connectedProviders: newConnected };
          });

          if (client) {
            // 刷新 OpenCode 缓存使更改生效
            try {
              await client.instance.dispose();
            } catch (e) {
              console.warn("清除 OpenCode 缓存失败:", e);
            }

            // 刷新已连接的 provider 列表
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

      startOAuthAuthorize: async (client, providerID, method) => {
        try {
          const response = await client.provider.oauth.authorize({
            providerID,
            method,
          });
          
          if (response.data) {
            return response.data as OAuthAuthorization;
          }
          
          // 检查是否有错误响应
          if (response.error) {
            const error = response.error as { name?: string; data?: { message?: string } };
            const errorMessage = error.data?.message || "未知错误";
            
            // 解析端口占用错误
            if (errorMessage.includes("port") && errorMessage.includes("in use")) {
              const portMatch = errorMessage.match(/port (\d+)/);
              const port = portMatch ? portMatch[1] : "1455";
              toast.error(`OAuth 服务端口 ${port} 被占用，请关闭占用该端口的程序后重试`);
            } else if (errorMessage.includes("Failed to start server")) {
              toast.error("OAuth 服务启动失败，请检查网络或稍后重试");
            } else {
              toast.error(`OAuth 授权失败: ${errorMessage}`);
            }
            console.error(`[Provider] OAuth 授权错误:`, error);
            return null;
          }
          
          return null;
        } catch (error) {
          console.error(`启动 OAuth 授权失败 (${providerID}):`, error);
          
          // 解析错误信息
          const errorStr = String(error);
          if (errorStr.includes("port") && errorStr.includes("in use")) {
            toast.error("OAuth 服务端口 1455 被占用，请关闭占用该端口的程序后重试");
          } else {
            toast.error("启动 OAuth 授权失败，请稍后重试");
          }
          return null;
        }
      },

      completeOAuthCallback: async (client, providerID, method, code) => {
        try {
          const response = await client.provider.oauth.callback({
            providerID,
            method,
            code,
          });
          
          if (response.data === true) {
            console.log(`[Provider] OAuth 授权成功: ${providerID}`);
            
            // 刷新已连接的 provider 列表
            const listResult = await client.provider.list();
            if (listResult.data) {
              const data = listResult.data as { connected: string[] };
              set({ connectedProviders: new Set(data.connected || []) });
            }
            
            toast.success("授权成功");
            return true;
          }
          return false;
        } catch (error) {
          console.error(`OAuth 回调处理失败 (${providerID}):`, error);
          toast.error("OAuth 授权失败");
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
