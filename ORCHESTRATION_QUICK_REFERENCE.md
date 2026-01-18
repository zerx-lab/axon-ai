# Orchestration UI - 快速参考指南

## 核心流程速查

### 创建 Agent
```
点击 AgentListPanel "+" 按钮
  → createDefaultAgentDefinition()
  → saveAgent(newAgent)
  → selectAgent(newAgent.id)
  → AgentConfigPanel 显示 5 个 Tab
```

### 编辑 Agent 配置
```
基本 Tab:     名称、描述、图标、颜色、类别、成本
模型 Tab:     模型选择（Popover+Command）→ 自动更新参数
参数 Tab:     Temperature、TopP、MaxTokens、Thinking、推理努力度等
权限 Tab:     工具权限（ask/allow/deny）+ 白/黑名单
提示词 Tab:   系统提示词、追加提示词
```

### 添加子 Agent
```
点击 Canvas "添加子 Agent" 按钮
  → Dialog 弹出，显示可用子 Agent（已过滤）
  → Command 搜索
  → 点击选择
  → addSubagent(agentId) [Store Action]
  → Canvas 自动显示新节点 + 边
```

### 管理子 Agent
```
Canvas 中子 Agent 节点：
  [眼睛] 按钮: toggleSubagentEnabled()
    → 虚线边表示禁用
    → 自动保存到 subagent.enabled

拖拽节点: 
  → updateSubagentPosition(subagentId, position)
  → Canvas viewport 自动保存
```

---

## 文件快速定位

| 需求 | 文件 |
|------|------|
| **改左侧列表** | `src/components/orchestration/AgentListPanel.tsx` |
| **改 Canvas 布局** | `src/components/orchestration/AgentCanvas.tsx` |
| **改节点样式** | `src/components/workflow/nodes/{Primary\|Subagent}Node.tsx` |
| **改配置编辑** | `src/components/orchestration/AgentConfigPanel.tsx` |
| **改状态管理** | `src/stores/orchestration.ts` |
| **改路由/布局** | `src/routes/orchestration.tsx` |
| **改类型定义** | `src/types/agent.ts` |

---

## Store Actions 速查

```typescript
// 加载 & CRUD
loadAgents()                                    // 加载所有 Agent
saveAgent(agent)                                // 保存单个
deleteAgent(agentId)                            // 删除

// 选择 & 视图
selectAgent(agentId | null)                     // 选中 Agent
setCanvasSelection({ type, id })               // Canvas 选中
updateCanvasViewport({ x, y, zoom })           // 保存视口

// 子 Agent 管理
addSubagent(agentId, position?)                // 添加
removeSubagent(subagentId)                      // 移除
updateSubagent(subagentId, updates)            // 更新
updateSubagentPosition(subagentId, pos)        // 拖拽
toggleSubagentEnabled(subagentId)              // 启用/禁用

// 委托规则
addDelegationRule(subagentId)                  // 添加规则
updateDelegationRule(ruleId, updates)          // 更新规则
removeDelegationRule(ruleId)                   // 删除规则
updateDelegationRuleset(updates)               // 更新规则集
```

---

## UI 组件速查

### Panel 尺寸（PANEL_CONFIG）
```typescript
list:   { defaultSize: 220, minSize: 180, maxSize: 320 }
config: { defaultSize: 360, minSize: 280, maxSize: 480 }
canvas: 自动 flex
```

### 对话框

#### 添加子 Agent Dialog
```
open: showAddSubagentDialog
TriggerButton: Canvas 右上角
Content: 400px max-width
Body: Command + 可用 Agents (已过滤)
Footer: [取消] 按钮
```

#### 删除确认 Dialog
```
AgentConfigPanel 内部
Body: "确认删除 Agent '名称'？此操作无法撤销。"
Footer: [取消] [删除] 按钮
DeleteConfirm: → 更新 store → 关闭面板
```

---

## Canvas 技术细节

### ReactFlow 配置
```
nodeTypes: { primaryAgent, subagent }
edgeTypes: 默认 (smoothstep)
markers: ArrowClosed (16x16)
defaultEdgeOptions:
  - type: smoothstep
  - strokeWidth: 1.5
  - strokeDasharray: "5,5" (disabled)
  - opacity: 0.5 (disabled)
```

### Node 数据结构
```
Primary:
  data: { config, name, description, isSelected, onConfigClick? }

Subagent:
  data: { config, name, description, category?, isSelected, ruleCount, onToggleEnabled? }
```

---

## 关键概念

### selectedAgentId
- 全局选中 Agent ID
- 决定 Canvas 显示内容
- 决定 ConfigPanel 编辑内容
- 决定 Dialog 中可用子 Agent 过滤

### canvasSelection
```typescript
{
  type: "primary" | "subagent" | "edge" | null,
  id: string | null
}
```
- 仅用于高亮当前选中节点
- 不影响实际操作

### SubagentConfig
- 轻量级配置（非完整 Agent）
- 包含 agentId（引用原 Agent）
- 可选 overrides（参数覆盖）
- triggers 列表（委托触发条件）

---

## 状态更新模式

### 直接更新（store state）
```typescript
selectAgent(agentId)          // 同步
setCanvasSelection(...)       // 同步
```

### 异步保存（RPC）
```typescript
await saveAgent(agent)        // async，调用后端
await deleteAgent(agentId)    // async，调用后端
```

### 位置更新（无 RPC）
```typescript
updateSubagentPosition(...)   // 同步，仅更新 store
updateCanvasViewport(...)     // 同步，仅保存 viewport
```

---

## 常见任务

### 获取当前选中 Agent
```typescript
const selectedAgent = getSelectedAgent();
if (!selectedAgent) return;  // 未选中
```

### 添加一个子 Agent（完整流程）
```typescript
const subagent = addSubagent(agentId);  // store action
if (!subagent) return;                  // 失败
// Canvas 自动更新（依赖 agent.subagents 变化）
```

### 修改子 Agent 启用状态
```typescript
toggleSubagentEnabled(subagentId);  // 自动翻转 enabled
// Edge 自动变为虚线
```

### 保存当前编辑的 Agent
```typescript
await saveAgent(editedAgent);  // Agent 对象必须完整
```

---

## 性能优化提示

1. **useMemo 过滤**: AgentListPanel 搜索使用 useMemo
2. **useCallback**: Canvas onChange 事件使用 useCallback
3. **memo**: 节点组件用 memo 包装
4. **ScrollArea**: 列表使用 ScrollArea（虚拟化）

---

## 已知限制 & TODO

1. ⚠️ 子 Agent 编辑面板在 Orchestration 中不存在
   - Workflow 有 SubagentEditor，Orchestration 无
   - 子 Agent 配置编辑需要单独实现或集成

2. ⚠️ 委托规则 UI 在 Orchestration 中不存在
   - 仅在 Workflow 系统中有 DelegationRuleEditor
   - Orchestration 系统有数据结构但无配置 UI

3. ⚠️ "reference 模式"未实现
   - PrimaryAgentNode 代码中有 mode: "reference" | "inline"
   - 仅有 inline 实现，reference 不可选

4. ⚠️ 子 Agent "overrides" 不可编辑
   - SubagentConfig 有 overrides 字段
   - UI 中无法手动设置参数覆盖

---

**最后更新**: 2026-01-18
