/**
 * Axon Bridge Plugin for OpenCode
 *
 * 此插件实现 Axon Desktop 与 OpenCode 之间的桥接功能：
 * - 与 Axon Rust 后端通过 HTTP 通信
 * - 动态注入和管理 Agent 配置
 * - 事件转发
 * - 通过 System Prompt 注入实现编排指令
 * - 从 .md 文件加载自定义命令
 *
 * 开发模式：设置 AXON_DEV=true 启用详细日志
 */

import type { Plugin, Hooks } from '@opencode-ai/plugin';
import path from 'path';
import fs from 'fs';

// ============================================================================
// 类型定义
// ============================================================================

interface AxonEndpoints {
  baseUrl: string;
  events: string;
  config: string;
  agents: string;
  orchestrations: string;
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

/** 编排组中的子代理触发器 */
interface SubagentTrigger {
  type: 'keyword' | 'domain' | 'condition' | 'always';
  pattern: string;
  description: string;
}

/** 嵌入式子代理配置 */
interface EmbeddedSubagent {
  id: string;
  config: {
    name: string;
    description?: string;
    model?: { modelId?: string };
    parameters?: { temperature?: number; topP?: number };
    prompt?: { system?: string };
  };
  triggers: SubagentTrigger[];
  runInBackground?: boolean;
  enabled: boolean;
}

/** 委托规则 */
interface DelegationRule {
  id: string;
  subagentId: string;
  domain: string;
  condition: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  runInBackground?: boolean;
  enabled: boolean;
}

/** 委托规则集 */
interface DelegationRuleset {
  rules: DelegationRule[];
  defaultBehavior: 'handle-self' | 'ask-user' | 'delegate-to';
  defaultSubagentId?: string;
  customGuidelines?: string;
}

/** 编排组配置 */
interface OrchestrationGroup {
  id: string;
  name: string;
  description: string;
  primaryAgent: {
    name: string;
    description?: string;
    model?: { modelId?: string };
    parameters?: { temperature?: number; topP?: number };
    prompt?: { system?: string };
  };
  subagents: EmbeddedSubagent[];
  delegationRuleset: DelegationRuleset;
}

interface AxonBridgeConfig {
  port: number;
  devMode: boolean;
  agents: Record<string, AxonAgentConfig>;
  disabledAgents: string[];
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
const AXON_AGENTS_DIR = process.env.AXON_AGENTS_DIR || '';

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
    orchestrations: `${baseUrl}/api/plugin/orchestrations`,
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

interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  model?: { modelId?: string };
  parameters?: { temperature?: number; topP?: number };
  runtime?: { mode?: string; hidden?: boolean; disabled?: boolean };
  tools?: { mode?: string; list?: string[] };
  permissions?: Record<string, unknown>;
  prompt?: { system?: string };
}

function loadAgentsFromDirectory(
  agentsDir: string,
  logger: Logger
): Record<string, AxonAgentConfig> {
  if (!agentsDir) {
    return {};
  }

  const agents: Record<string, AxonAgentConfig> = {};

  try {
    const files = fs.readdirSync(agentsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(agentsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const def: AgentDefinition = JSON.parse(content);

        const mode = (def.runtime?.mode || 'subagent') as 'primary' | 'subagent' | 'all';

        let tools: Record<string, boolean> | undefined;
        if (def.tools?.mode && def.tools.mode !== 'all' && def.tools.list?.length) {
          const isWhitelist = def.tools.mode === 'whitelist';
          tools = {};
          for (const t of def.tools.list) {
            tools[t] = isWhitelist;
          }
        }

        agents[def.name] = {
          name: def.name,
          description: def.description,
          mode,
          model: def.model?.modelId,
          prompt: def.prompt?.system,
          disable: def.runtime?.disabled,
          temperature: def.parameters?.temperature,
          top_p: def.parameters?.topP,
          permission: def.permissions,
          tools,
        };

        logger.debug(`加载 agent: ${def.name}`, { file });
      } catch (e) {
        logger.debug(`跳过无法解析的 agent 文件: ${file}`, e);
      }
    }

    if (Object.keys(agents).length > 0) {
      logger.info(`从目录加载了 ${Object.keys(agents).length} 个 agent`, Object.keys(agents));
    }
  } catch (e) {
    logger.debug('agents 目录不存在或无法读取', e);
  }

  return agents;
}

// ============================================================================
// Axon Bridge 客户端
// ============================================================================

class AxonBridgeClient {
  private endpoints: AxonEndpoints;
  private connected = false;
  private config: AxonBridgeConfig | null = null;
  private orchestrations: OrchestrationGroup[] = [];
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

  async getOrchestrations(): Promise<OrchestrationGroup[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const response = await this.fetchWithTimeout(this.endpoints.orchestrations);
      if (response?.ok) {
        this.orchestrations = await response.json();
        this.logger.info(`获取 ${this.orchestrations.length} 个编排组配置`);
        return this.orchestrations;
      }
    } catch (error) {
      this.logger.error('获取编排组失败', error);
    }

    return [];
  }

  getCachedOrchestrations(): OrchestrationGroup[] {
    return this.orchestrations;
  }

  private getDefaultConfig(): AxonBridgeConfig {
    return {
      port: AXON_PORT,
      devMode: DEV_MODE,
      agents: {},
      disabledAgents: [],
    };
  }
}

// ============================================================================
// 编排指令生成器
// ============================================================================

/**
 * 根据当前 agent 和编排组配置，生成编排指令
 */
function generateOrchestrationDirectives(
  currentAgent: string,
  orchestrations: OrchestrationGroup[],
  logger: Logger
): string[] {
  const directives: string[] = [];

  // 查找当前 agent 所属的编排组
  for (const orch of orchestrations) {
    // 检查是否是主代理
    if (orch.primaryAgent.name === currentAgent) {
      const enabledSubagents = orch.subagents.filter((s) => s.enabled);

      if (enabledSubagents.length === 0) {
        continue;
      }

      logger.debug(`为主代理 ${currentAgent} 生成编排指令`, {
        orchestration: orch.name,
        subagentCount: enabledSubagents.length,
      });

      // 生成委托指令
      const delegationInstructions = generateDelegationInstructions(orch, enabledSubagents);
      directives.push(delegationInstructions);
    }
  }

  return directives;
}

/**
 * 生成委托指令
 */
function generateDelegationInstructions(
  orch: OrchestrationGroup,
  enabledSubagents: EmbeddedSubagent[]
): string {
  const lines: string[] = [];

  lines.push(`## 编排组: ${orch.name}`);
  if (orch.description) {
    lines.push(`${orch.description}`);
  }
  lines.push('');
  lines.push('### 可用子代理');
  lines.push('');

  for (const sub of enabledSubagents) {
    lines.push(`**${sub.config.name}**`);
    if (sub.config.description) {
      lines.push(`- 描述: ${sub.config.description}`);
    }

    // 触发条件
    if (sub.triggers.length > 0) {
      lines.push('- 触发条件:');
      for (const trigger of sub.triggers) {
        const triggerDesc = formatTrigger(trigger);
        lines.push(`  - ${triggerDesc}`);
      }
    }

    if (sub.runInBackground) {
      lines.push('- 执行方式: 后台异步');
    }
    lines.push('');
  }

  // 委托规则
  const { rules, defaultBehavior, customGuidelines } = orch.delegationRuleset;
  const enabledRules = rules.filter((r) => r.enabled);

  if (enabledRules.length > 0) {
    lines.push('### 委托规则');
    lines.push('');

    // 按优先级排序
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedRules = [...enabledRules].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    for (const rule of sortedRules) {
      const subagent = enabledSubagents.find((s) => s.id === rule.subagentId);
      if (!subagent) continue;

      lines.push(`- **${rule.domain}** → ${subagent.config.name}`);
      if (rule.condition) {
        lines.push(`  - 条件: ${rule.condition}`);
      }
      lines.push(`  - 优先级: ${rule.priority}`);
      if (rule.runInBackground) {
        lines.push(`  - 后台执行`);
      }
    }
    lines.push('');
  }

  // 默认行为
  lines.push('### 默认行为');
  switch (defaultBehavior) {
    case 'handle-self':
      lines.push('当没有匹配的委托规则时，自行处理任务。');
      break;
    case 'ask-user':
      lines.push('当没有匹配的委托规则时，询问用户如何处理。');
      break;
    case 'delegate-to':
      lines.push('当没有匹配的委托规则时，委托给默认子代理处理。');
      break;
  }
  lines.push('');

  // 自定义指南
  if (customGuidelines) {
    lines.push('### 自定义指南');
    lines.push(customGuidelines);
    lines.push('');
  }

  // 强制规则
  lines.push('### 执行要求');
  lines.push('1. 在处理用户请求前，先检查是否匹配上述委托规则');
  lines.push('2. 如果匹配，必须使用 Task 工具委托给对应的子代理');
  lines.push('3. 委托时，提供清晰的任务描述和必要的上下文');
  lines.push('4. 收集子代理的结果后，整合并回复用户');

  return lines.join('\n');
}

/**
 * 格式化触发器描述
 */
function formatTrigger(trigger: SubagentTrigger): string {
  switch (trigger.type) {
    case 'keyword':
      return `关键词: "${trigger.pattern}"${trigger.description ? ` (${trigger.description})` : ''}`;
    case 'domain':
      return `领域: ${trigger.pattern}${trigger.description ? ` (${trigger.description})` : ''}`;
    case 'condition':
      return `条件: ${trigger.pattern}${trigger.description ? ` (${trigger.description})` : ''}`;
    case 'always':
      return `始终触发${trigger.description ? ` (${trigger.description})` : ''}`;
    default:
      return trigger.pattern;
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
  const filesystemAgents = loadAgentsFromDirectory(AXON_AGENTS_DIR, logger);
  const apiAgents = await client.getAgents();
  const customAgents = { ...apiAgents, ...filesystemAgents };
  const commands = await loadCommands(logger);

  // 加载编排组配置
  await client.getOrchestrations();

  // 会话状态跟踪
  const sessionStates = new Map<
    string,
    {
      agent?: string;
      startTime: number;
    }
  >();

  const hooks: Hooks = {
    // 配置钩子：注入自定义 Agent 和命令
    config: async (inputConfig) => {
      logger.debug('处理配置', { hasAgentConfig: !!inputConfig.agent });

      // 注入自定义 Agent
      if (customAgents && Object.keys(customAgents).length > 0) {
        const agentConfig = inputConfig.agent ?? {};
        for (const [name, agentCfg] of Object.entries(customAgents)) {
          const hasTemperature =
            agentCfg.temperature !== undefined && agentCfg.temperature !== null;
          const hasTopP = agentCfg.top_p !== undefined && agentCfg.top_p !== null;

          agentConfig[name] = {
            description: agentCfg.description,
            mode: agentCfg.mode,
            model: agentCfg.model,
            prompt: agentCfg.prompt,
            color: agentCfg.color,
            disable: agentCfg.disable,
            temperature: hasTemperature ? agentCfg.temperature : undefined,
            top_p: hasTemperature ? undefined : hasTopP ? agentCfg.top_p : undefined,
            permission: agentCfg.permission,
            tools: agentCfg.tools,
          };
        }
        inputConfig.agent = agentConfig;
        logger.info('已注入自定义 Agent', Object.keys(customAgents));
      }

      // 禁用指定 Agent
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

      // 注入自定义命令
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
        logger.info(
          '已加载命令',
          commands.map((c) => c.name)
        );
      }
    },

    // 事件钩子：转发事件到 Axon 后端
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

    // 消息钩子：记录当前 agent
    'chat.message': async (input, _output) => {
      logger.debug('处理消息', {
        sessionID: input.sessionID,
        agent: input.agent,
        hasModel: !!input.model,
      });

      // 更新会话状态中的 agent
      const state = sessionStates.get(input.sessionID);
      if (state && input.agent) {
        state.agent = input.agent;
      }
    },

    // System Prompt 转换钩子：注入编排指令
    'experimental.chat.system.transform': async (input, output) => {
      const state = sessionStates.get(input.sessionID);
      const currentAgent = state?.agent;

      if (!currentAgent) {
        logger.debug('会话无 agent 信息，跳过编排指令注入', { sessionID: input.sessionID });
        return;
      }

      const orchestrations = client.getCachedOrchestrations();
      if (orchestrations.length === 0) {
        return;
      }

      const directives = generateOrchestrationDirectives(currentAgent, orchestrations, logger);

      if (directives.length > 0) {
        logger.info(`为 agent ${currentAgent} 注入 ${directives.length} 条编排指令`);
        output.system.push(...directives);
      }
    },

    // 工具执行前钩子
    'tool.execute.before': async (input, _output) => {
      logger.debug('工具执行前', {
        tool: input.tool,
        sessionID: input.sessionID,
      });
    },

    // 工具执行后钩子
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
