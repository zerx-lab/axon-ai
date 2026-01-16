/**
 * Axon Bridge Plugin for OpenCode
 * 
 * 此插件实现 Axon Desktop 与 OpenCode 之间的桥接功能：
 * - 与 Axon Rust 后端通过 HTTP 通信
 * - 动态注入和管理 Agent 配置
 * - 事件转发和工具拦截
 * - 支持多代理编排功能
 * 
 * 开发模式：设置 AXON_DEV=true 启用详细日志
 */

import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"

// ============================================================================
// 类型定义
// ============================================================================

/** Axon 后端通信端点 */
interface AxonEndpoints {
  /** 基础 URL */
  baseUrl: string
  /** 事件上报端点 */
  events: string
  /** 配置获取端点 */
  config: string
  /** Agent 管理端点 */
  agents: string
  /** 编排执行端点 */
  orchestration: string
}

/** Agent 配置 */
interface AxonAgentConfig {
  name: string
  description?: string
  mode: "primary" | "subagent" | "all"
  model?: string
  prompt?: string
  color?: string
  hidden?: boolean
  disable?: boolean
  temperature?: number
  top_p?: number
  permission?: Record<string, unknown>
  tools?: Record<string, boolean>
}

/** 编排节点定义 */
interface OrchestrationNode {
  id: string
  type: "agent" | "tool" | "condition" | "parallel" | "sequence"
  agentId?: string
  toolId?: string
  config?: Record<string, unknown>
  next?: string[]
}

/** 编排工作流定义 */
interface OrchestrationWorkflow {
  id: string
  name: string
  description?: string
  nodes: OrchestrationNode[]
  entryNodeId: string
}

/** 插件配置 */
interface AxonBridgeConfig {
  /** Axon 后端端口（默认 23517） */
  port: number
  /** 是否启用开发模式 */
  devMode: boolean
  /** 自定义 Agent 配置 */
  agents: Record<string, AxonAgentConfig>
  /** 禁用的默认 Agent */
  disabledAgents: string[]
  /** 启用的编排工作流 */
  workflows: OrchestrationWorkflow[]
}

// ============================================================================
// 工具函数
// ============================================================================

// 检查是否由 Axon 启动（通过环境变量判断）
const AXON_RUNNING = process.env.AXON_RUNNING === "true"
const DEV_MODE = process.env.AXON_DEV === "true" || process.env.NODE_ENV === "development"
const AXON_PORT = parseInt(process.env.AXON_BRIDGE_PORT || "23517", 10)

/** 日志输出（开发模式下更详细） */
function log(message: string, data?: unknown): void {
  const prefix = "[axon-bridge]"
  if (DEV_MODE) {
    console.log(`${prefix} ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : "")
  } else if (data) {
    console.log(`${prefix} ${message}`)
  }
}

/** 错误日志 */
function logError(message: string, error?: unknown): void {
  console.error(`[axon-bridge] ERROR: ${message}`, error)
}

/** 构建 Axon 端点 */
function buildEndpoints(port: number): AxonEndpoints {
  const baseUrl = `http://127.0.0.1:${port}`
  return {
    baseUrl,
    events: `${baseUrl}/api/plugin/events`,
    config: `${baseUrl}/api/plugin/config`,
    agents: `${baseUrl}/api/plugin/agents`,
    orchestration: `${baseUrl}/api/plugin/orchestration`,
  }
}

/** 安全的 HTTP 请求（带超时和错误处理） */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 5000
): Promise<Response | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if ((error as Error).name === "AbortError") {
      log("请求超时", { url })
    } else {
      log("请求失败", { url, error: (error as Error).message })
    }
    return null
  }
}

// ============================================================================
// Axon Bridge 客户端
// ============================================================================

class AxonBridgeClient {
  private endpoints: AxonEndpoints
  private connected = false
  private config: AxonBridgeConfig | null = null

  constructor(port: number) {
    this.endpoints = buildEndpoints(port)
  }

  /** 检查 Axon 后端连接 */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${this.endpoints.baseUrl}/api/plugin/health`,
        { method: "GET" },
        2000
      )
      this.connected = response?.ok ?? false
      log(`Axon 后端连接状态: ${this.connected ? "已连接" : "未连接"}`)
      return this.connected
    } catch {
      this.connected = false
      return false
    }
  }

  /** 获取配置 */
  async fetchConfig(): Promise<AxonBridgeConfig | null> {
    if (!this.connected) {
      await this.checkConnection()
    }

    if (!this.connected) {
      log("Axon 后端未连接，使用默认配置")
      return this.getDefaultConfig()
    }

    try {
      const response = await fetchWithTimeout(this.endpoints.config)
      if (response?.ok) {
        this.config = await response.json()
        log("获取 Axon 配置成功", this.config)
        return this.config
      }
    } catch (error) {
      logError("获取配置失败", error)
    }

    return this.getDefaultConfig()
  }

  /** 发送事件到 Axon */
  async sendEvent(event: { type: string; properties?: unknown }): Promise<void> {
    if (!this.connected) return

    try {
      await fetchWithTimeout(
        this.endpoints.events,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        },
        2000
      )
      log("事件已发送", { type: event.type })
    } catch (error) {
      // 静默失败，不影响主流程
      if (DEV_MODE) {
        logError("发送事件失败", error)
      }
    }
  }

  /** 获取自定义 Agent 列表 */
  async getAgents(): Promise<Record<string, AxonAgentConfig>> {
    if (!this.connected) {
      return {}
    }

    try {
      const response = await fetchWithTimeout(this.endpoints.agents)
      if (response?.ok) {
        const agents = await response.json()
        log("获取 Agent 配置成功", agents)
        return agents
      }
    } catch (error) {
      logError("获取 Agent 失败", error)
    }

    return {}
  }

  /** 执行编排工作流 */
  async executeWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    if (!this.connected) {
      return { success: false, error: "Axon 后端未连接" }
    }

    try {
      const response = await fetchWithTimeout(
        `${this.endpoints.orchestration}/${workflowId}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        30000 // 编排执行可能需要较长时间
      )

      if (response?.ok) {
        const result = await response.json()
        return { success: true, result }
      } else {
        return { success: false, error: `HTTP ${response?.status}` }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /** 获取默认配置 */
  private getDefaultConfig(): AxonBridgeConfig {
    return {
      port: AXON_PORT,
      devMode: DEV_MODE,
      agents: {},
      disabledAgents: [],
      workflows: [],
    }
  }
}

// ============================================================================
// 插件主体
// ============================================================================

// 创建全局客户端实例（在模块加载时初始化）
let globalClient: AxonBridgeClient | null = null

const AxonBridgePlugin: Plugin = async (ctx) => {
  // 只有在 Axon 启动的 opencode 实例中才初始化插件
  // 全局 opencode 或其他方式启动时跳过，避免连接失败的警告
  if (!AXON_RUNNING) {
    return {}
  }

  log("初始化 Axon Bridge 插件", {
    directory: ctx.directory,
    devMode: DEV_MODE,
    port: AXON_PORT,
  })

  // 创建 Axon 客户端
  const client = new AxonBridgeClient(AXON_PORT)
  globalClient = client
  
  // 尝试连接 Axon 后端
  const connected = await client.checkConnection()
  if (!connected) {
    log("警告: Axon 后端未运行，部分功能将不可用")
  }

  // 获取配置
  const config = await client.fetchConfig()
  const customAgents = await client.getAgents()

  // 跟踪会话状态
  const sessionStates = new Map<string, {
    agent?: string
    startTime: number
  }>()

  // 定义工具
  const axonOrchestrateTool = tool({
    description: "执行 Axon 编排工作流，协调多个 Agent 完成复杂任务",
    args: {
      workflow_id: z.string().describe("工作流 ID"),
      input: z.record(z.string(), z.unknown()).optional().describe("工作流输入参数"),
    },
    async execute(args, _context) {
      const result = await client.executeWorkflow(
        args.workflow_id,
        args.input ?? {}
      )

      if (result.success) {
        return JSON.stringify(result.result, null, 2)
      } else {
        throw new Error(`工作流执行失败: ${result.error}`)
      }
    },
  })

  const axonBridgeTool = tool({
    description: "与 Axon Desktop 后端通信，获取配置或发送命令",
    args: {
      action: z.enum(["get_config", "get_agents", "send_event"]).describe("操作类型"),
      payload: z.record(z.string(), z.unknown()).optional().describe("操作负载"),
    },
    async execute(args, _context) {
      switch (args.action) {
        case "get_config":
          const cfg = await client.fetchConfig()
          return JSON.stringify(cfg, null, 2)

        case "get_agents":
          const agents = await client.getAgents()
          return JSON.stringify(agents, null, 2)

        case "send_event":
          if (args.payload && typeof args.payload === "object") {
            await client.sendEvent(args.payload as { type: string; properties?: unknown })
            return "事件已发送"
          }
          return "无效的事件负载"

        default:
          return `未知操作: ${args.action}`
      }
    },
  })

  const hooks: Hooks = {
    // ========================================================================
    // 配置钩子：注入自定义 Agent 和禁用默认 Agent
    // ========================================================================
    config: async (inputConfig) => {
      log("处理配置", { hasAgentConfig: !!inputConfig.agent })

      // 合并自定义 Agent 配置
      if (customAgents && Object.keys(customAgents).length > 0) {
        const agentConfig = inputConfig.agent ?? {}
        for (const [name, agentCfg] of Object.entries(customAgents)) {
          // 转换为 SDK 兼容的格式
          agentConfig[name] = {
            description: agentCfg.description,
            mode: agentCfg.mode,
            model: agentCfg.model,
            prompt: agentCfg.prompt,
            color: agentCfg.color,
            hidden: agentCfg.hidden,
            disable: agentCfg.disable,
            temperature: agentCfg.temperature,
            top_p: agentCfg.top_p,
          }
        }
        inputConfig.agent = agentConfig
        log("已注入自定义 Agent", Object.keys(customAgents))
      }

      // 禁用指定的默认 Agent
      if (config?.disabledAgents && config.disabledAgents.length > 0) {
        const agentConfig = inputConfig.agent ?? {}
        for (const agentName of config.disabledAgents) {
          agentConfig[agentName] = {
            ...agentConfig[agentName],
            disable: true,
          }
        }
        inputConfig.agent = agentConfig
        log("已禁用 Agent", config.disabledAgents)
      }
    },

    // ========================================================================
    // 自定义工具
    // ========================================================================
    tool: {
      axon_orchestrate: axonOrchestrateTool,
      axon_bridge: axonBridgeTool,
    },

    // ========================================================================
    // 事件钩子
    // ========================================================================
    event: async (input) => {
      const { event } = input
      const props = event.properties as Record<string, unknown> | undefined

      // 转发事件到 Axon（异步，不阻塞）
      client.sendEvent({ type: event.type, properties: props }).catch(() => {})

      // 跟踪会话创建
      if (event.type === "session.created") {
        const sessionInfo = props?.info as { id?: string; parentID?: string } | undefined
        if (sessionInfo?.id && !sessionInfo.parentID) {
          sessionStates.set(sessionInfo.id, {
            startTime: Date.now(),
          })
          log("会话创建", { sessionId: sessionInfo.id })
        }
      }

      // 跟踪会话删除
      if (event.type === "session.deleted") {
        const sessionInfo = props?.info as { id?: string } | undefined
        if (sessionInfo?.id) {
          sessionStates.delete(sessionInfo.id)
          log("会话删除", { sessionId: sessionInfo.id })
        }
      }

      // 跟踪消息更新（记录使用的 Agent）
      if (event.type === "message.updated") {
        const info = props?.info as { sessionID?: string; agent?: string; role?: string } | undefined
        if (info?.sessionID && info?.agent && info?.role === "user") {
          const state = sessionStates.get(info.sessionID)
          if (state) {
            state.agent = info.agent
          }
        }
      }
    },

    // ========================================================================
    // 消息钩子
    // ========================================================================
    "chat.message": async (input, _output) => {
      log("处理消息", {
        sessionID: input.sessionID,
        agent: input.agent,
        hasModel: !!input.model,
      })

      // 可以在这里修改消息或添加额外处理
    },

    // ========================================================================
    // 工具执行钩子
    // ========================================================================
    "tool.execute.before": async (input, _output) => {
      log("工具执行前", {
        tool: input.tool,
        sessionID: input.sessionID,
      })

      // 可以在这里拦截或修改工具调用
    },

    "tool.execute.after": async (input, output) => {
      log("工具执行后", {
        tool: input.tool,
        title: output.title,
      })

      // 可以在这里处理工具执行结果
    },
  }

  return hooks
}

export default AxonBridgePlugin
