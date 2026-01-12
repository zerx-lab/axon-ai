/**
 * 权限配置类型定义
 * 
 * 基于 OpenCode SDK 权限系统
 * 参考: opencode/packages/opencode/src/permission/permission.ts
 */

// ============== 权限动作类型 ==============

/** 权限动作 */
export type PermissionActionType = "allow" | "ask" | "deny";

// ============== 权限类型枚举 ==============

/** 
 * 已知的权限类型列表（用于分组等静态场景）
 * 注意：实际工具列表应从 API 动态获取
 */
export const KNOWN_PERMISSION_TYPES = [
  // 文件操作
  "read",           // 读取文件
  "edit",           // 编辑文件
  "write",          // 写入文件
  "glob",           // 文件模式匹配
  "grep",           // 内容搜索
  "list",           // 列出目录
  
  // 执行操作
  "bash",           // 执行 shell 命令
  "task",           // 子任务/子代理
  
  // 网络操作
  "webfetch",       // 获取网页内容
  "websearch",      // 网页搜索
  "codesearch",     // 代码搜索
  
  // 工具操作
  "todoread",       // 读取任务列表
  "todowrite",      // 写入任务列表
  "skill",          // 技能调用
  "lsp",            // LSP 操作
  
  // 特殊权限
  "external_directory",  // 访问外部目录
  "doom_loop",           // 防止无限循环
] as const;

/** 已知权限类型 */
export type KnownPermissionType = typeof KNOWN_PERMISSION_TYPES[number];

// 为了向后兼容
export const PERMISSION_TYPES = KNOWN_PERMISSION_TYPES;
export type PermissionType = KnownPermissionType;

// 支持子规则的工具（可配置模式匹配，如 bash: { "git *": "allow" }）
// 参考: opencode/packages/opencode/src/config/config.ts PermissionRule 类型
export const SUPPORTS_SUB_RULES = [
  "read",
  "edit",
  "glob",
  "grep",
  "list",
  "bash",
  "task",
  "external_directory",
  "lsp",
] as const;

export type SupportsSubRulesType = typeof SUPPORTS_SUB_RULES[number];

export function supportsSubRules(toolId: string): boolean {
  return (SUPPORTS_SUB_RULES as readonly string[]).includes(toolId);
}

// ============== 权限显示名称（i18n 键） ==============

/** 权限类型的 i18n 键映射（显示名称） */
export const PERMISSION_I18N_KEYS: Record<string, string> = {
  "*": "permissions.types.default",
  read: "permissions.types.read",
  edit: "permissions.types.edit",
  write: "permissions.types.write",
  glob: "permissions.types.glob",
  grep: "permissions.types.grep",
  list: "permissions.types.list",
  bash: "permissions.types.bash",
  task: "permissions.types.task",
  webfetch: "permissions.types.webfetch",
  websearch: "permissions.types.websearch",
  codesearch: "permissions.types.codesearch",
  todoread: "permissions.types.todoread",
  todowrite: "permissions.types.todowrite",
  skill: "permissions.types.skill",
  lsp: "permissions.types.lsp",
  external_directory: "permissions.types.external_directory",
  doom_loop: "permissions.types.doom_loop",
  // 其他常见工具
  invalid: "permissions.types.invalid",
  question: "permissions.types.question",
  batch: "permissions.types.batch",
};

/** 权限类型的 i18n 键映射（描述） */
export const PERMISSION_DESC_I18N_KEYS: Record<string, string> = {
  "*": "permissions.descriptions.default",
  read: "permissions.descriptions.read",
  edit: "permissions.descriptions.edit",
  write: "permissions.descriptions.write",
  glob: "permissions.descriptions.glob",
  grep: "permissions.descriptions.grep",
  list: "permissions.descriptions.list",
  bash: "permissions.descriptions.bash",
  task: "permissions.descriptions.task",
  webfetch: "permissions.descriptions.webfetch",
  websearch: "permissions.descriptions.websearch",
  codesearch: "permissions.descriptions.codesearch",
  todoread: "permissions.descriptions.todoread",
  todowrite: "permissions.descriptions.todowrite",
  skill: "permissions.descriptions.skill",
  lsp: "permissions.descriptions.lsp",
  external_directory: "permissions.descriptions.external_directory",
  doom_loop: "permissions.descriptions.doom_loop",
  question: "permissions.descriptions.question",
  invalid: "permissions.descriptions.invalid",
  batch: "permissions.descriptions.batch",
};

/** 权限动作的 i18n 键 */
export const ACTION_I18N_KEYS: Record<PermissionActionType, string> = {
  allow: "permissions.actions.allow",
  ask: "permissions.actions.ask",
  deny: "permissions.actions.deny",
};

// ============== 权限规则类型 ==============

/**
 * 权限规则值
 * 
 * 可以是简单的动作，或者包含子模式的对象
 * 
 * 示例:
 * - 简单: "allow" | "ask" | "deny"
 * - 复杂: { "*": "ask", "git *": "allow", "rm *": "deny" }
 */
export type PermissionRuleValue = 
  | PermissionActionType 
  | Record<string, PermissionActionType>;

/**
 * 权限配置
 * 
 * 键可以是:
 * - "*": 默认权限
 * - 具体权限类型: "read", "bash" 等
 */
export interface PermissionConfig {
  [key: string]: PermissionRuleValue;
}

// ============== 权限规则 UI 类型 ==============

/**
 * 权限规则项（用于 UI 展示）
 */
export interface PermissionRuleItem {
  /** 唯一标识符 */
  id: string;
  /** 权限类型（"*" 表示默认） */
  type: string;
  /** 权限动作 */
  action: PermissionActionType;
  /** 子规则（用于粒度控制，如 bash 的具体命令） */
  subRules?: Array<{
    pattern: string;
    action: PermissionActionType;
  }>;
}

// ============== 权限分组 ==============

export const PERMISSION_GROUPS_I18N = {
  file: {
    labelKey: "permissions.groups.file",
    permissions: ["read", "edit", "write", "glob", "grep", "list"],
  },
  execution: {
    labelKey: "permissions.groups.execution",
    permissions: ["bash", "task"],
  },
  network: {
    labelKey: "permissions.groups.network",
    permissions: ["webfetch", "websearch", "codesearch"],
  },
  tools: {
    labelKey: "permissions.groups.tools",
    permissions: ["todoread", "todowrite", "skill", "lsp"],
  },
  special: {
    labelKey: "permissions.groups.special",
    permissions: ["external_directory", "doom_loop"],
  },
  other: {
    labelKey: "permissions.groups.other",
    permissions: [] as string[],
  },
} as const;

export const PERMISSION_GROUPS = PERMISSION_GROUPS_I18N;

// ============== 默认权限配置 ==============

/**
 * 获取默认权限配置
 * 
 * 基于 OpenCode 默认策略（opencode/packages/opencode/src/agent/agent.ts）:
 * - "*": "allow" - 默认允许所有工具
 * - doom_loop: "ask" - 循环保护需要询问
 * - external_directory: "ask" - 外部目录访问需要询问
 * - question: "deny" - 默认拒绝（build/plan agent 会覆盖为 allow）
 * - read: .env 文件被拒绝
 */
export function getDefaultPermissionConfig(): PermissionConfig {
  return {
    "*": "allow",
    "doom_loop": "ask",
    "external_directory": "ask",
    "question": "deny",
  };
}

// ============== 工具函数 ==============

/**
 * 将 PermissionConfig 转换为 PermissionRuleItem 列表
 */
export function configToRuleItems(config: PermissionConfig): PermissionRuleItem[] {
  const items: PermissionRuleItem[] = [];
  
  for (const [type, value] of Object.entries(config)) {
    if (typeof value === "string") {
      // 简单规则
      items.push({
        id: `rule-${type}`,
        type,
        action: value,
      });
    } else {
      // 包含子规则
      const defaultAction = value["*"] || "ask";
      const subRules = Object.entries(value)
        .filter(([k]) => k !== "*")
        .map(([pattern, action]) => ({ pattern, action }));
      
      items.push({
        id: `rule-${type}`,
        type,
        action: defaultAction,
        subRules: subRules.length > 0 ? subRules : undefined,
      });
    }
  }
  
  return items;
}

/**
 * 将 PermissionRuleItem 列表转换为 PermissionConfig
 */
export function ruleItemsToConfig(items: PermissionRuleItem[]): PermissionConfig {
  const config: PermissionConfig = {};
  
  for (const item of items) {
    if (!item.subRules || item.subRules.length === 0) {
      // 简单规则
      config[item.type] = item.action;
    } else {
      // 包含子规则
      const ruleObj: Record<string, PermissionActionType> = {
        "*": item.action,
      };
      for (const sub of item.subRules) {
        ruleObj[sub.pattern] = sub.action;
      }
      config[item.type] = ruleObj;
    }
  }
  
  return config;
}

export function getPermissionDisplayNameKey(type: string): string {
  return PERMISSION_I18N_KEYS[type] || `permissions.types.unknown`;
}

export function getPermissionDescriptionKey(type: string): string {
  return PERMISSION_DESC_I18N_KEYS[type] || "";
}

export function getActionDisplayNameKey(action: PermissionActionType): string {
  return ACTION_I18N_KEYS[action];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslationFunction = (key: string, options?: any) => string;

export function getPermissionDisplayName(type: string, t?: TranslationFunction): string {
  if (t) {
    const key = getPermissionDisplayNameKey(type);
    return t(key, { defaultValue: type });
  }
  return type;
}

export function getPermissionDescription(type: string, t?: TranslationFunction): string {
  if (t) {
    const key = getPermissionDescriptionKey(type);
    if (key) {
      return t(key, { defaultValue: "" });
    }
  }
  return "";
}

export function getActionDisplayName(action: PermissionActionType, t?: TranslationFunction): string {
  if (t) {
    const key = getActionDisplayNameKey(action);
    return t(key, { defaultValue: action });
  }
  return action;
}

/**
 * 获取权限动作的颜色类名
 */
export function getActionColorClass(action: PermissionActionType): string {
  switch (action) {
    case "allow":
      return "text-green-500";
    case "ask":
      return "text-yellow-500";
    case "deny":
      return "text-red-500";
    default:
      return "";
  }
}
