/**
 * Axon Bridge Plugin for OpenCode
 *
 * 此插件实现 Axon Desktop 与 OpenCode 之间的桥接功能：
 * - 与 Axon Rust 后端通过 HTTP 通信
 * - 动态注入和管理 Agent 配置
 * - 事件转发和工具拦截
 * - 支持多代理编排功能
 * - 从 .md 文件加载自定义命令
 *
 * 开发模式：设置 AXON_DEV=true 启用详细日志
 */

import type { Plugin, Hooks } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { z } from 'zod';
import path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

interface AxonEndpoints {
  baseUrl: string;
  events: string;
  config: string;
  agents: string;
  orchestration: string;
}

interface AxonAgentConfig {
  name: string;
  description?: string;
  mode: 'primary' | 'subagent' | 'all';
  model?: string;
  prompt?: string;
  color?: string;
  disable?: boolean;
  temperature?: number;
  top_p?: number;
  permission?: Record<string, unknown>;
  tools?: Record<string, boolean>;
}

interface OrchestrationNode {
  id: string;
  type: 'agent' | 'tool' | 'condition' | 'parallel' | 'sequence';
  agentId?: string;
  toolId?: string;
  config?: Record<string, unknown>;
  next?: string[];
}

interface OrchestrationWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: OrchestrationNode[];
  entryNodeId: string;
}

interface AxonBridgeConfig {
  port: number;
  devMode: boolean;
  agents: Record<string, AxonAgentConfig>;
  disabledAgents: string[];
  workflows: OrchestrationWorkflow[];
}

interface CommandFrontmatter {
  description?: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

interface ParsedCommand {
  name: string;
  frontmatter: CommandFrontmatter;
  template: string;
}

// ============================================================================
// 环境配置
// ============================================================================

const AXON_RUNNING = process.env.AXON_RUNNING === 'true';
const DEV_MODE = process.env.AXON_DEV === 'true' || process.env.NODE_ENV === 'development';
const AXON_PORT = parseInt(process.env.AXON_BRIDGE_PORT || '23517', 10);

// ============================================================================
// 日志模块
// ============================================================================

type PluginClient = Parameters<Plugin>[0]['client'];
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
}

const SERVICE_NAME = 'axon-bridge';

function createLogger(client: PluginClient): Logger {
  const writeLog = (level: LogLevel, message: string, extra?: unknown) => {
    if (!DEV_MODE && level !== 'warn' && level !== 'error') {
      return;
    }

    client.app.log({
      body: {
        service: SERVICE_NAME,
        level,
        message,
        extra: extra !== undefined ? { data: extra } : undefined,
      },
    });
  };

  return {
    debug: (message, data) => writeLog('debug', message, data),
    info: (message, data) => writeLog('info', message, data),
    warn: (message, data) => writeLog('warn', message, data),
    error: (message, error) => writeLog('error', message, error),
  };
}

function buildEndpoints(port: number): AxonEndpoints {
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    events: `${baseUrl}/api/plugin/events`,
    config: `${baseUrl}/api/plugin/config`,
    agents: `${baseUrl}/api/plugin/agents`,
    orchestration: `${baseUrl}/api/plugin/orchestration`,
  };
}

function createFetchWithTimeout(logger: Logger) {
  return async function fetchWithTimeout(
    url: string,
    options: Parameters<typeof fetch>[1] = {},
    timeout = 5000
  ): Promise<Awaited<ReturnType<typeof fetch>> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        logger.debug('请求超时', { url });
      } else {
        logger.debug('请求失败', { url, error: (error as Error).message });
      }
      return null;
    }
  };
}

// ============================================================================
// 命令加载器
// ============================================================================

function parseFrontmatter(content: string): { frontmatter: CommandFrontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content.trim() };
  }

  const [, yamlContent, body] = match;
  const frontmatter: CommandFrontmatter = {};

  for (const line of yamlContent.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === 'description') frontmatter.description = value;
    if (key === 'agent') frontmatter.agent = value;
    if (key === 'model') frontmatter.model = value;
    if (key === 'subtask') frontmatter.subtask = value === 'true';
  }

  return { frontmatter, body: body.trim() };
}

async function loadCommands(logger: Logger): Promise<ParsedCommand[]> {
  const commands: ParsedCommand[] = [];
  const commandDir = path.join(import.meta.dir, 'command');

  try {
    const glob = new Bun.Glob('**/*.md');
    for await (const file of glob.scan({ cwd: commandDir, absolute: true })) {
      const content = await Bun.file(file).text();
      const { frontmatter, body } = parseFrontmatter(content);
      const relativePath = path.relative(commandDir, file);
      const name = relativePath.replace(/\.md$/, '').replace(/\//g, '-');

      commands.push({
        name,
        frontmatter,
        template: body,
      });
    }
  } catch {
    logger.debug('命令目录不存在或为空，跳过命令加载');
  }

  return commands;
}

// ============================================================================
// Axon Bridge 客户端
// ============================================================================

class AxonBridgeClient {
  private endpoints: AxonEndpoints;
  private connected = false;
  private config: AxonBridgeConfig | null = null;
  private logger: Logger;
  private fetchWithTimeout: ReturnType<typeof createFetchWithTimeout>;

  constructor(port: number, logger: Logger) {
    this.endpoints = buildEndpoints(port);
    this.logger = logger;
    this.fetchWithTimeout = createFetchWithTimeout(logger);
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.endpoints.baseUrl}/api/plugin/health`,
        { method: 'GET' },
        2000
      );
      this.connected = response?.ok ?? false;
      this.logger.info(`Axon 后端连接状态: ${this.connected ? '已连接' : '未连接'}`);
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async fetchConfig(): Promise<AxonBridgeConfig | null> {
    if (!this.connected) {
      await this.checkConnection();
    }

    if (!this.connected) {
      this.logger.debug('Axon 后端未连接，使用默认配置');
      return this.getDefaultConfig();
    }

    try {
      const response = await this.fetchWithTimeout(this.endpoints.config);
      if (response?.ok) {
        this.config = await response.json();
        this.logger.info('获取 Axon 配置成功', this.config);
        return this.config;
      }
    } catch (error) {
      this.logger.error('获取配置失败', error);
    }

    return this.getDefaultConfig();
  }

  async sendEvent(event: { type: string; properties?: unknown }): Promise<void> {
    if (!this.connected) return;

    try {
      await this.fetchWithTimeout(
        this.endpoints.events,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        },
        2000
      );
      this.logger.debug('事件已发送', { type: event.type });
    } catch (error) {
      if (DEV_MODE) {
        this.logger.error('发送事件失败', error);
      }
    }
  }

  async getAgents(): Promise<Record<string, AxonAgentConfig>> {
    if (!this.connected) {
      return {};
    }

    try {
      const response = await this.fetchWithTimeout(this.endpoints.agents);
      if (response?.ok) {
        const agents = await response.json();
        this.logger.info('获取 Agent 配置成功', agents);
        return agents;
      }
    } catch (error) {
      this.logger.error('获取 Agent 失败', error);
    }

    return {};
  }

  async executeWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Axon 后端未连接' };
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.endpoints.orchestration}/${workflowId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
        30000
      );

      if (response?.ok) {
        const result = await response.json();
        return { success: true, result };
      } else {
        return { success: false, error: `HTTP ${response?.status}` };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private getDefaultConfig(): AxonBridgeConfig {
    return {
      port: AXON_PORT,
      devMode: DEV_MODE,
      agents: {},
      disabledAgents: [],
      workflows: [],
    };
  }
}

// ============================================================================
// 插件主体
// ============================================================================

const AxonBridgePlugin: Plugin = async (ctx) => {
  if (!AXON_RUNNING) {
    return {};
  }

  const logger = createLogger(ctx.client);

  logger.info('初始化 Axon Bridge 插件', {
    directory: ctx.directory,
    devMode: DEV_MODE,
    port: AXON_PORT,
  });

  const client = new AxonBridgeClient(AXON_PORT, logger);
  const connected = await client.checkConnection();
  if (!connected) {
    logger.warn('Axon 后端未运行，部分功能将不可用');
  }

  const config = await client.fetchConfig();
  const customAgents = await client.getAgents();
  const commands = await loadCommands(logger);

  const sessionStates = new Map<
    string,
    {
      agent?: string;
      startTime: number;
    }
  >();

  const axonOrchestrateTool = tool({
    description: '执行 Axon 编排工作流，协调多个 Agent 完成复杂任务',
    args: {
      workflow_id: z.string().describe('工作流 ID'),
      input: z.record(z.string(), z.unknown()).optional().describe('工作流输入参数'),
    },
    async execute(args) {
      const result = await client.executeWorkflow(args.workflow_id, args.input ?? {});

      if (result.success) {
        return JSON.stringify(result.result, null, 2);
      } else {
        throw new Error(`工作流执行失败: ${result.error}`);
      }
    },
  });

  const axonBridgeTool = tool({
    description: '与 Axon Desktop 后端通信，获取配置或发送命令',
    args: {
      action: z.enum(['get_config', 'get_agents', 'send_event']).describe('操作类型'),
      payload: z.record(z.string(), z.unknown()).optional().describe('操作负载'),
    },
    async execute(args) {
      switch (args.action) {
        case 'get_config': {
          const cfg = await client.fetchConfig();
          return JSON.stringify(cfg, null, 2);
        }

        case 'get_agents': {
          const agents = await client.getAgents();
          return JSON.stringify(agents, null, 2);
        }

        case 'send_event': {
          if (args.payload && typeof args.payload === 'object') {
            await client.sendEvent(args.payload as { type: string; properties?: unknown });
            return '事件已发送';
          }
          return '无效的事件负载';
        }

        default:
          return `未知操作: ${args.action}`;
      }
    },
  });

  const hooks: Hooks = {
    config: async (inputConfig) => {
      logger.debug('处理配置', { hasAgentConfig: !!inputConfig.agent });

      if (customAgents && Object.keys(customAgents).length > 0) {
        const agentConfig = inputConfig.agent ?? {};
        for (const [name, agentCfg] of Object.entries(customAgents)) {
          agentConfig[name] = {
            description: agentCfg.description,
            mode: agentCfg.mode,
            model: agentCfg.model,
            prompt: agentCfg.prompt,
            color: agentCfg.color,
            disable: agentCfg.disable,
            temperature: agentCfg.temperature,
            top_p: agentCfg.top_p,
          };
        }
        inputConfig.agent = agentConfig;
        logger.info('已注入自定义 Agent', Object.keys(customAgents));
      }

      if (config?.disabledAgents && config.disabledAgents.length > 0) {
        const agentConfig = inputConfig.agent ?? {};
        for (const agentName of config.disabledAgents) {
          agentConfig[agentName] = {
            ...agentConfig[agentName],
            disable: true,
          };
        }
        inputConfig.agent = agentConfig;
        logger.info('已禁用 Agent', config.disabledAgents);
      }

      inputConfig.command = inputConfig.command ?? {};
      for (const cmd of commands) {
        inputConfig.command[cmd.name] = {
          template: cmd.template,
          description: cmd.frontmatter.description,
          agent: cmd.frontmatter.agent,
          model: cmd.frontmatter.model,
          subtask: cmd.frontmatter.subtask,
        };
      }
      if (commands.length > 0) {
        logger.info('已加载命令', commands.map((c) => c.name));
      }
    },

    tool: {
      axon_orchestrate: axonOrchestrateTool,
      axon_bridge: axonBridgeTool,
    },

    event: async (input) => {
      const { event } = input;
      const props = event.properties as Record<string, unknown> | undefined;

      client.sendEvent({ type: event.type, properties: props }).catch(() => {});

      if (event.type === 'session.created') {
        const sessionInfo = props?.info as { id?: string; parentID?: string } | undefined;
        if (sessionInfo?.id && !sessionInfo.parentID) {
          sessionStates.set(sessionInfo.id, {
            startTime: Date.now(),
          });
          logger.debug('会话创建', { sessionId: sessionInfo.id });
        }
      }

      if (event.type === 'session.deleted') {
        const sessionInfo = props?.info as { id?: string } | undefined;
        if (sessionInfo?.id) {
          sessionStates.delete(sessionInfo.id);
          logger.debug('会话删除', { sessionId: sessionInfo.id });
        }
      }

      if (event.type === 'message.updated') {
        const info = props?.info as
          | { sessionID?: string; agent?: string; role?: string }
          | undefined;
        if (info?.sessionID && info?.agent && info?.role === 'user') {
          const state = sessionStates.get(info.sessionID);
          if (state) {
            state.agent = info.agent;
          }
        }
      }
    },

    'chat.message': async (input, _output) => {
      logger.debug('处理消息', {
        sessionID: input.sessionID,
        agent: input.agent,
        hasModel: !!input.model,
      });
    },

    'tool.execute.before': async (input, _output) => {
      logger.debug('工具执行前', {
        tool: input.tool,
        sessionID: input.sessionID,
      });
    },

    'tool.execute.after': async (input, output) => {
      logger.debug('工具执行后', {
        tool: input.tool,
        title: output.title,
      });
    },
  };

  return hooks;
};

export default AxonBridgePlugin;
