/**
 * 服务状态 Store
 *
 * 统一管理 OpenCode 服务的状态，包括：
 * - MCP 服务器状态
 * - 工具权限配置
 * - 服务重启流程
 *
 * 所有需要重启服务的组件都应使用此 Store 的 restart() 方法
 */

import { create } from "zustand";
import { toast } from "sonner";
import type { McpServersStatus, McpConfig } from "@/types/mcp";
import type { PermissionConfig, PermissionActionType } from "@/types/permission";
import { getToolsSimple } from "@/services/opencode/tools";
import { opencode as tauriOpencode, settings as tauriSettings, fs as tauriFs } from "@/services/tauri";
import type { OpencodeClient } from "@/services/opencode/types";

// ============== 类型定义 ==============

/** 工具权限信息 */
export interface ToolWithPermission {
  id: string;
  description?: string;
  permission: PermissionActionType;
}

/** MCP 配置缓存 */
export interface McpConfigCache {
  [name: string]: McpConfig;
}

/** 重启选项 */
export interface RestartOptions {
  /** 静默模式（不显示 toast） */
  silent?: boolean;
  /** 重启原因（用于 toast 提示） */
  reason?: string;
}

/** Store 状态 */
interface ServiceState {
  // MCP 服务器状态
  mcpServers: McpServersStatus;
  mcpConfigs: McpConfigCache;

  // 工具权限
  tools: ToolWithPermission[];
  permissionConfig: PermissionConfig;

  // 加载状态
  isRestarting: boolean;
  isLoadingMcp: boolean;
  isLoadingTools: boolean;

  // 时间戳（用于判断数据新鲜度）
  lastRefreshTime: number | null;
}

/** Store Actions */
interface ServiceActions {
  // 内部：设置 client 引用（由 OpencodeProvider 调用）
  _setClient: (client: OpencodeClient | null) => void;
  _setConnected: (connected: boolean) => void;

  // 统一重启（调用后自动刷新所有数据）
  restart: (options?: RestartOptions) => Promise<void>;

  // 数据加载
  loadMcpStatus: () => Promise<void>;
  loadTools: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // MCP 操作
  toggleMcpServer: (name: string) => Promise<void>;
  restartAllMcp: () => Promise<void>;
  stopAllMcp: () => Promise<void>;

  // 权限操作（会触发重启）
  updatePermission: (toolId: string, action: PermissionActionType) => Promise<void>;

  // 重置
  reset: () => void;
}

type ServiceStore = ServiceState & ServiceActions;

// ============== 初始状态 ==============

const initialState: ServiceState = {
  mcpServers: {},
  mcpConfigs: {},
  tools: [],
  permissionConfig: {},
  isRestarting: false,
  isLoadingMcp: false,
  isLoadingTools: false,
  lastRefreshTime: null,
};

// ============== 内部状态（不存储在 Zustand 中） ==============

// 使用闭包存储 client 引用，避免序列化问题
let clientRef: OpencodeClient | null = null;
let isConnectedRef = false;

// ============== Store 实现 ==============

export const useServiceStore = create<ServiceStore>()((set, get) => ({
  ...initialState,

  // ============== 内部方法 ==============

  _setClient: (client) => {
    clientRef = client;
  },

  _setConnected: (connected) => {
    const wasConnected = isConnectedRef;
    isConnectedRef = connected;

    // 从断开变为连接，自动刷新数据
    if (!wasConnected && connected) {
      console.log("[ServiceStore] 连接已建立，刷新数据...");
      get().refreshAll();
    }

    // 从连接变为断开，重置状态
    if (wasConnected && !connected) {
      console.log("[ServiceStore] 连接已断开，重置状态...");
      set({
        mcpServers: {},
        mcpConfigs: {},
        tools: [],
        permissionConfig: {},
        lastRefreshTime: null,
      });
    }
  },

  // ============== 统一重启 ==============

  restart: async (options = {}) => {
    const { silent = false, reason } = options;

    if (get().isRestarting) {
      console.log("[ServiceStore] 已有重启任务在进行中");
      return;
    }

    console.log("[ServiceStore] 开始重启服务...", { reason });
    set({ isRestarting: true });

    try {
      // 1. 清理 SDK 缓存（如果有 client）
      if (clientRef) {
        try {
          await clientRef.instance.dispose();
        } catch (e) {
          console.warn("[ServiceStore] 清理 SDK 缓存失败:", e);
        }
      }

      // 2. 显示重启提示
      if (!silent) {
        toast.info(reason || "正在重启服务...");
      }

      // 3. 调用 Tauri 重启后端
      await tauriOpencode.restart();

      // 4. 等待服务重新连接（通过 _setConnected 触发刷新）
      // OpencodeProvider 会在连接成功后调用 _setConnected(true)
      // refreshAll() 会在 _setConnected 中自动触发

      // 5. 等待一小段时间确保服务稳定
      await new Promise(resolve => setTimeout(resolve, 500));

      // 6. 显示成功提示
      if (!silent) {
        toast.success("服务已重启");
      }

      console.log("[ServiceStore] 服务重启完成");
    } catch (error) {
      console.error("[ServiceStore] 重启服务失败:", error);
      if (!silent) {
        toast.error("重启服务失败");
      }
      throw error;
    } finally {
      set({ isRestarting: false });
    }
  },

  // ============== 数据加载 ==============

  loadMcpStatus: async () => {
    if (!clientRef || !isConnectedRef) {
      console.log("[ServiceStore] 无法加载 MCP 状态：未连接");
      return;
    }

    set({ isLoadingMcp: true });
    try {
      const [statusResult, configResult] = await Promise.all([
        clientRef.mcp.status(),
        clientRef.config.get(),
      ]);

      if (statusResult.data) {
        set({ mcpServers: statusResult.data as unknown as McpServersStatus });
      }

      // 提取 MCP 配置
      if (configResult.data) {
        const config = configResult.data as unknown as { mcp?: McpConfigCache };
        if (config.mcp) {
          set({ mcpConfigs: config.mcp });
        }
      }

      console.log("[ServiceStore] MCP 状态加载完成");
    } catch (error) {
      console.error("[ServiceStore] 加载 MCP 状态失败:", error);
    } finally {
      set({ isLoadingMcp: false });
    }
  },

  loadTools: async () => {
    if (!clientRef || !isConnectedRef) {
      console.log("[ServiceStore] 无法加载工具列表：未连接");
      return;
    }

    set({ isLoadingTools: true });
    try {
      // 并行获取工具列表和权限配置
      const [toolsResult, configResult] = await Promise.all([
        getToolsSimple(),
        clientRef.config.get(),
      ]);

      // 解析权限配置
      const config = configResult.data as unknown as { permission?: PermissionConfig };
      const permConfig = config?.permission || {};
      set({ permissionConfig: permConfig });

      // 获取默认权限
      const defaultPermission = (
        typeof permConfig["*"] === "string"
          ? permConfig["*"]
          : "allow"
      ) as PermissionActionType;

      // 为每个工具添加权限信息
      const toolsWithPermission: ToolWithPermission[] = toolsResult.map(tool => {
        const configValue = permConfig[tool.id];
        let permission: PermissionActionType;

        if (configValue === undefined) {
          permission = defaultPermission;
        } else if (typeof configValue === "string") {
          permission = configValue;
        } else if (typeof configValue === "object" && configValue !== null) {
          permission = (configValue["*"] || "ask") as PermissionActionType;
        } else {
          permission = defaultPermission;
        }

        return {
          id: tool.id,
          description: tool.description,
          permission,
        };
      });

      set({ tools: toolsWithPermission });
      console.log("[ServiceStore] 工具列表加载完成，共", toolsWithPermission.length, "个");
    } catch (error) {
      console.error("[ServiceStore] 加载工具列表失败:", error);
    } finally {
      set({ isLoadingTools: false });
    }
  },

  refreshAll: async () => {
    console.log("[ServiceStore] 刷新所有数据...");
    const { loadMcpStatus, loadTools } = get();

    await Promise.all([
      loadMcpStatus(),
      loadTools(),
    ]);

    set({ lastRefreshTime: Date.now() });
    console.log("[ServiceStore] 所有数据刷新完成");
  },

  // ============== MCP 操作 ==============

  toggleMcpServer: async (name) => {
    if (!clientRef || !isConnectedRef) return;

    const { mcpServers } = get();
    const status = mcpServers[name];
    const isEnabled = status?.status === "connected";

    try {
      if (isEnabled) {
        await clientRef.mcp.disconnect({ name });
      } else {
        await clientRef.mcp.connect({ name });
      }
      await get().loadMcpStatus();
    } catch (error) {
      console.error("[ServiceStore] 切换 MCP 服务器状态失败:", error);
      toast.error("操作失败");
    }
  },

  restartAllMcp: async () => {
    if (!clientRef || !isConnectedRef) return;

    const { mcpServers, loadMcpStatus } = get();
    set({ isLoadingMcp: true });

    try {
      const connectedServers = Object.entries(mcpServers)
        .filter(([, status]) => status.status === "connected")
        .map(([name]) => name);

      for (const name of connectedServers) {
        await clientRef.mcp.disconnect({ name });
      }
      for (const name of connectedServers) {
        await clientRef.mcp.connect({ name });
      }
      await loadMcpStatus();
    } catch (error) {
      console.error("[ServiceStore] 重启 MCP 服务器失败:", error);
      toast.error("重启 MCP 服务器失败");
    } finally {
      set({ isLoadingMcp: false });
    }
  },

  stopAllMcp: async () => {
    if (!clientRef || !isConnectedRef) return;

    const { mcpServers, loadMcpStatus } = get();
    set({ isLoadingMcp: true });

    try {
      const connectedServers = Object.entries(mcpServers)
        .filter(([, status]) => status.status === "connected")
        .map(([name]) => name);

      for (const name of connectedServers) {
        await clientRef.mcp.disconnect({ name });
      }
      await loadMcpStatus();
    } catch (error) {
      console.error("[ServiceStore] 停止 MCP 服务器失败:", error);
      toast.error("停止 MCP 服务器失败");
    } finally {
      set({ isLoadingMcp: false });
    }
  },

  // ============== 权限操作 ==============

  updatePermission: async (toolId, newAction) => {
    if (!clientRef) return;

    const { restart, loadTools } = get();

    try {
      // 1. 获取 opencode.json 配置文件路径
      const configPath = await tauriSettings.getOpencodeConfigPath();

      // 2. 读取现有配置
      let existingConfig: Record<string, unknown> = {};
      try {
        const content = await tauriFs.readFileContent(configPath);
        existingConfig = JSON.parse(content);
      } catch {
        // 文件不存在或解析失败，使用空配置
      }

      // 3. 更新权限配置
      const currentPermConfig = (existingConfig.permission || {}) as PermissionConfig;
      const currentValue = currentPermConfig[toolId];

      let newPermConfig: PermissionConfig;
      if (typeof currentValue === "object" && currentValue !== null) {
        newPermConfig = {
          ...currentPermConfig,
          [toolId]: {
            ...currentValue,
            "*": newAction,
          },
        };
      } else {
        newPermConfig = {
          ...currentPermConfig,
          [toolId]: newAction,
        };
      }

      // 4. 合并并写入配置
      const mergedConfig = {
        ...existingConfig,
        permission: newPermConfig,
      };

      await tauriFs.writeFileContent(configPath, JSON.stringify(mergedConfig, null, 2));
      set({ permissionConfig: newPermConfig });

      // 5. 重启服务以使配置生效
      await restart({ reason: "权限配置已更新，正在重启服务..." });

      // 6. 重新加载工具列表（restart 中已触发，但确保权限已更新）
      await loadTools();

      toast.success("权限已更新");
    } catch (error) {
      console.error("[ServiceStore] 更新权限失败:", error);
      toast.error("更新权限失败");
    }
  },

  // ============== 重置 ==============

  reset: () => {
    set(initialState);
    clientRef = null;
    isConnectedRef = false;
  },
}));

// ============== 选择器 Hooks ==============

/** 获取 MCP 服务器状态 */
export const useMcpServers = () => useServiceStore(state => state.mcpServers);

/** 获取工具列表 */
export const useTools = () => useServiceStore(state => state.tools);

/** 获取重启状态 */
export const useIsRestarting = () => useServiceStore(state => state.isRestarting);

/** 获取 MCP 加载状态 */
export const useIsLoadingMcp = () => useServiceStore(state => state.isLoadingMcp);

/** 获取工具加载状态 */
export const useIsLoadingTools = () => useServiceStore(state => state.isLoadingTools);

/** 获取上次刷新时间 */
export const useLastRefreshTime = () => useServiceStore(state => state.lastRefreshTime);
