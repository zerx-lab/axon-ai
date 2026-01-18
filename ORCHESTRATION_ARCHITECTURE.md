# Axon Desktop - 编排架构详细分析

**分析日期**: 2026-01-18  
**文档范围**: Agent 定义、子 Agent 配置、Store 管理、持久化机制、Canvas 集成

---

## 1. 数据模型分析

### 1.1 核心关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AgentDefinition                               │
│  (src/types/agent.ts)                                              │
├─────────────────────────────────────────────────────────────────────┤
│  id: string                                                         │
│  name: string                                                       │
│  description: string                                                │
│  model: ModelConfig                                                 │
│  parameters: AgentParameters                                        │
│  runtime: RuntimeConfig (mode: "primary" | "subagent" | "all")    │
│  tools: ToolsConfig                                                │
│  permissions: AgentPermissions                                      │
│  prompt: PromptConfig                                              │
│  metadata: AgentMetadata                                            │
│  ──────────────────────────────────────────────────────────────    │
│  subagents: SubagentConfig[] ◄─── 嵌入式关系 (1:N)                 │
│  delegationRuleset: DelegationRuleset ◄─── 嵌入式                  │
│  primaryPosition: CanvasNodePosition                                │
│  canvasViewport?: CanvasViewport                                    │
│  ──────────────────────────────────────────────────────────────    │
│  createdAt: number                                                  │
│  updatedAt: number                                                  │
│  builtin?: boolean                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 包含
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SubagentConfig                               │
│  (src/types/agent.ts - 子 Agent 在主 Agent 中的配置)               │
├─────────────────────────────────────────────────────────────────────┤
│  id: string                    (在主 Agent 内唯一)                 │
│  agentId: string               (引用另一 AgentDefinition ID)      │
│  name?: string                 (覆盖原 Agent 名称)                 │
│  description?: string          (覆盖原 Agent 描述)                 │
│  ──────────────────────────────────────────────────────────────    │
│  overrides?: {                 (可选配置覆盖)                      │
│    model?: ModelConfig                                             │
│    parameters?: Partial<AgentParameters>                           │
│    systemPrompt?: string                                           │
│  }                                                                  │
│  ──────────────────────────────────────────────────────────────    │
│  triggers: SubagentTrigger[]   (委托触发条件)                      │
│  runInBackground?: boolean     (并行执行)                           │
│  enabled: boolean              (启用/禁用)                         │
│  position: { x: number; y: number }  (Canvas 位置)                 │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 引用
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    另一 AgentDefinition                             │
│  (被引用的 Agent)                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  id: string (匹配 SubagentConfig.agentId)                          │
│  ... (其他 Agent 配置)                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Agent 与 SubagentConfig 的关系

#### 🔑 关键点：引用关系（Reference Pattern）

```typescript
// SubagentConfig 包含两个关键字段：
interface SubagentConfig {
  agentId: string;              // ⭐ 引用已定义的 Agent ID
  overrides?: {
    model?: ModelConfig;        // 可选覆盖
    parameters?: Partial<AgentParameters>;
    systemPrompt?: string;
  };
}

// 实际使用示例：
// 1. 创建独立 Agent
const agent1: AgentDefinition = {
  id: "agent-001",
  name: "文件分析 Agent",
  runtime: { mode: "subagent" },  // 可用作子 Agent
  // ... 其他配置
};

// 2. 创建主 Agent，引用 agent-001 作为子 Agent
const mainAgent: AgentDefinition = {
  id: "agent-002",
  name: "项目管理 Agent",
  runtime: { mode: "primary" },   // 主 Agent
  subagents: [
    {
      id: "subagent-ref-1",              // 本地唯一 ID
      agentId: "agent-001",               // 引用 agent1
      name: "依赖分析器",                 // 显示名称可覆盖
      description: "用于分析项目依赖",
      overrides: {
        parameters: { temperature: 0.1 }  // 可覆盖参数
      },
      position: { x: 200, y: 300 },
      enabled: true,
      triggers: []
    }
  ],
  delegationRuleset: { ... }  // 委托规则
};
```

**关键特性**：

| 特性 | 说明 |
|------|------|
| **参考不复制** | SubagentConfig 只存储 agentId，不复制完整配置 |
| **灵活覆盖** | 通过 overrides 针对特定角色调整参数 |
| **运行时解析** | Canvas 渲染时从主 Store 读取完整 AgentDefinition |
| **一对多** | 同一 Agent 可作为多个不同角色的子 Agent |

---

## 2. Store 管理架构

### 2.1 useOrchestrationStore (编排专用)

**文件**: `src/stores/orchestration.ts`  
**职责**: Agent CRUD、Canvas 选中状态、子 Agent 和委托规则管理

#### 状态结构

```typescript
interface AgentState {
  agents: AgentDefinition[];              // 所有加载的 Agent
  agentSummaries: AgentSummary[];         // 摘要列表（快速查询）
  isLoadingAgents: boolean;
  agentsError: string | null;
  
  selectedAgentId: string | null;         // 当前编辑 Agent
  canvasSelection: CanvasSelection;       // Canvas 选中（primary/subagent/edge）
  hasUnsavedChanges: boolean;             // 脏标记
}
```

#### 核心操作

**Agent 生命周期**:
```typescript
loadAgents()              // 列出所有 Agent 摘要
loadAgent(id)             // 加载完整 Agent（增量）
saveAgent(agent)          // 保存单个 Agent
deleteAgent(id)           // 删除 Agent
getAgentById(id)          // 同步查询
```

**选中和编辑**:
```typescript
selectAgent(id)           // 切换编辑 Agent
getSelectedAgent()        // 获取当前编辑的 Agent
updateSelectedAgent(...)  // 更新当前 Agent（脏标记）
```

**子 Agent 管理**:
```typescript
addSubagent(agentId, position)      // 创建子 Agent 配置
removeSubagent(subagentId)          // 删除子 Agent
updateSubagent(id, updates)         // 更新子 Agent 配置
updateSubagentPosition(id, pos)     // 更新 Canvas 位置
toggleSubagentEnabled(id)           // 切换启用状态
```

**委托规则管理**:
```typescript
addDelegationRule(subagentId)           // 添加规则
removeDelegationRule(ruleId)            // 删除规则
updateDelegationRule(id, updates)       // 更新规则
updateDelegationRuleset(updates)        // 更新规则集配置
```

**Canvas 交互**:
```typescript
setCanvasSelection(selection)       // 设置选中节点
clearCanvasSelection()              // 清除选中
updateCanvasViewport(viewport)      // 保存视口状态（缩放/平移）
```

### 2.2 useWorkflowStore (工作流专用 - 对比参考)

**文件**: `src/stores/workflow.ts`  
**职责**: WorkflowDefinition 管理（包含 primaryAgent 配置 + 子 Agent）

**关键区别**：

| Store | Agent | Workflow |
|-------|-------|----------|
| **数据层** | AgentDefinition | WorkflowDefinition |
| **主体** | 单个 Agent + 子团队 | 可内联/引用主 Agent + 子团队 |
| **Primary** | `primaryPosition` | `PrimaryAgentConfig { mode, agentId?, inline? }` |
| **持久化** | 文件系统 (JSON) | Tauri Commands |
| **编辑目标** | Agent 本身 | 工作流编排 |

---

## 3. 编排页面与 Canvas 集成

### 3.1 页面布局 (src/routes/orchestration.tsx)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Orchestration Route                                                 │
├──────────────────────────────────────────────────────────────────────┤
│
│  ResizablePanelGroup (horizontal)
│  ├─ ResizablePanel (220px default, 180-320px range)
│  │  └─ AgentListPanel
│  │     ├─ 搜索栏
│  │     └─ Agent 列表（可创建、选择）
│  │
│  ├─ ResizableHandle (分割线)
│  │
│  ├─ ResizablePanel (flex 自适应)
│  │  └─ AgentCanvas (基于 React Flow @xyflow/react)
│  │     ├─ PrimaryAgentNode (主 Agent)
│  │     ├─ SubagentNode[] (子 Agent 节点)
│  │     ├─ Edges (边 + 箭头)
│  │     ├─ Background (点网格)
│
