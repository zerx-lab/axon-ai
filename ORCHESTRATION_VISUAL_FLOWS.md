# Orchestration UI - 视觉流程图集

## 1. 主界面布局 (Main Layout)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ /orchestration 路由                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────┐  ┌────────────────────────────────┐  ┌──────────────────┐ │
│  │          │  │                                │  │                  │ │
│  │ Agent    │  │         Canvas                 │  │   Config Panel   │ │
│  │ List     │  │       (React Flow)             │  │                  │ │
│  │          │  │                                │  │  [Tab Bar]       │ │
│  │ ┌──────┐ │  │  ╔═══════════════╗            │  │                  │ │
│  │ │+     │ │  │  ║   Primary     ║            │  │ [基本|模型|参数| │ │
│  │ └──────┘ │  │  ║     Node      ║            │  │  权限|提示词]   │ │
│  │          │  │  ╚═══════════════╝            │  │                  │ │
│  │ [Search] │  │         ↓                     │  │ ┌──────────────┐ │ │
│  │          │  │    ╔═════════════╗            │  │ │ Name:        │ │ │
│  │ ┌──────┐ │  │    ║ Subagent 1  ║            │  │ │ [_________] │ │ │
│  │ │ Ag 1 │ │  │    ╚═════════════╝            │  │ │              │ │ │
│  │ │ Ag 2 │ │  │         ↓                     │  │ │ Desc:        │ │ │
│  │ │ Ag 3 │ │  │    ╔═════════════╗            │  │ │ [_________] │ │ │
│  │ │ Ag 4 │ │  │    ║ Subagent 2  ║            │  │ │              │ │ │
│  │ │ Ag 5 │ │  │    ╚═════════════╝            │  │ │ ...          │ │ │
│  │ └──────┘ │  │                                │  │ │              │ │ │
│  │          │  │                                │  │ │ [Save] [Del]│ │ │
│  │ 5 个 A   │  │    [+Add Subagent] (右上)    │  │ └──────────────┘ │ │
│  │          │  │    [🗺 MiniMap] (右下)      │  │                  │ │
│  └──────────┘  └────────────────────────────────┘  └──────────────────┘ │
│  w: 220px      flex-1                            w: 360px               │
│  可调整: ◄─────                                         可调整: ────►    │
│        180-320                                          280-480         │
└─────────────────────────────────────────────────────────────────────────┘

ResizableHandle (可拖拽调整)
```

---

## 2. Agent 创建流程

```
用户界面
═════════════════════════════════════════════════════════════════

┌─ AgentListPanel (左侧)
│  ┌───────────────┐
│  │ Agent 列表 [+]◄─── 点击创建
│  └───────────────┘
│         │
│         │ onCreateAgent()
│         ↓
└─────────────────────────────────────────────────────────────

Store 层 (useOrchestrationStore)
═════════════════════════════════════════════════════════════════

handleCreateAgent() 回调函数：

1. createDefaultAgentDefinition({
     name: "新建 Agent",
     description: "自定义 Agent"
   })
   
   ↓ [返回新 Agent 对象]
   
2. await saveAgent(newAgent)
   ├─ agent.updatedAt = Date.now()
   ├─ await saveAgentToFile(agent)  ← RPC 调用后端
   └─ Zustand store 更新:
      ├─ agents: [...agents, newAgent]
      └─ agentSummaries: [..., summary]
   
   ↓ [Promise 完成]
   
3. selectAgent(newAgent.id)
   └─ selectedAgentId = newAgent.id
   
   ↓ [同步更新]
   
4. setShowConfigPanel(true)
   └─ 右侧面板显示
   
   ↓ [React 重新渲染]

UI 更新
═════════════════════════════════════════════════════════════════

AgentCanvas (中央)
  ├─ 接收 selectedAgent (新创建的 Agent)
  ├─ buildNodes() 生成 Primary Node
  ├─ buildEdges() 生成 Edges (初始为空)
  └─ ReactFlow 渲染
     └─ 显示单个节点

AgentConfigPanel (右侧)
  ├─ 接收 selectedAgent
  ├─ setEditedAgent(selectedAgent) 初始化本地编辑状态
  ├─ 显示 5 个 Tab
  └─ 用户可开始编辑配置
```

---

## 3. 添加子 Agent 流程

```
┌─ Canvas 右上角 "添加子 Agent" 按钮
│  └─ onClick: setShowAddSubagentDialog(true)
│
├─ Dialog 弹出 (orchestration.tsx)
│  ├─ availableSubagents = agents.filter(
│  │    a => a.id !== selectedAgentId &&
│  │         (a.runtime.mode === "subagent" || "all")
│  │  )
│  ├─ 显示 Command 搜索组件
│  └─ 显示可用 Agent 列表 (已添加的禁用)
│
├─ 用户点击选择一个 Agent
│  └─ onSelect(agentId)
│
├─ handleAddSubagent(agentId) 触发
│  └─ addSubagent(agentId) [Store Action]
│
├─ Store 处理:
│  ├─ selectedAgent = get().agents.find(...)
│  ├─ yOffset = selectedAgent.subagents.length * 120
│  ├─ newSubagent = createDefaultSubagentConfig(agentId, {
│  │    position: { x: 200, y: 300 + yOffset }
│  │  })
│  └─ set() 更新 Zustand:
│     └─ agents 中 selectedAgent.subagents 添加新项
│
└─ Canvas 自动更新:
   ├─ buildNodes() 重新生成
   │  └─ [Primary] + [Subagent-1] + [Subagent-2(新)]
   ├─ buildEdges() 重新生成
   │  └─ Primary → Subagent-1 + Primary → Subagent-2(新)
   └─ ReactFlow 重新渲染
      └─ 显示新节点和连线
```

---

## 4. Canvas 交互流程

### 4a. 拖拽节点位置

```
用户拖拽节点
    ↓
ReactFlow onNodesChange
    ├─ changes: { id, type: "position", position, dragging }
    └─ dragging = false (拖拽结束)
    ↓
handleNodesChange() 处理
    ├─ if (change.id === "primary")
    │  └─ updatePrimaryPosition(change.position)
    └─ else
       └─ updateSubagentPosition(change.id, change.position)
    ↓
Store 更新
    ├─ 查找 selectedAgent
    └─ 更新:
       ├─ agent.primaryPosition = position (如果是主节点)
       └─ subagent.position = position (如果是子节点)
    ↓
状态持久化
    └─ hasUnsavedChanges = true
```

### 4b. 切换子 Agent 启用状态

```
用户点击子 Agent 节点上的 [眼睛] 图标
    ↓
SubagentNode onClick: onToggleEnabled?.()
    ↓
toggleSubagentEnabled(subagentId) [Store Action]
    ├─ subagent.enabled = !subagent.enabled
    └─ hasUnsavedChanges = true
    ↓
Edge 样式自动更新
    ├─ strokeDasharray: enabled ? undefined : "5,5"
    └─ opacity: enabled ? 1 : 0.5
    
    结果: 禁用时显示虚线 + 半透明
```

### 4c. 选中节点高亮

```
用户点击节点
    ↓
ReactFlow onNodeClick(event, node)
    ├─ if (node.id === "primary")
    │  └─ setCanvasSelection({ type: "primary", id: null })
    └─ else
       └─ setCanvasSelection({ type: "subagent", id: node.id })
    ↓
Store 更新 canvasSelection 状态
    ↓
buildNodes() 重新生成
    ├─ node.data.isSelected = (selection.type === type && selection.id === node.id)
    ↓
Node 组件 re-render
    └─ className={cn(
         isSelected && "border-primary ring-primary/20"
       )}
    
    结果: 节点边框变蓝 + 显示光环
```

---

## 5. 配置编辑流程

```
┌─ AgentConfigPanel (右侧面板)
│
├─ Tab 选择: [基本|模型|参数|权限|提示词]
│
├─ 用户输入 (以基本 Tab 为例)
│  ├─ 名称: onChange → updateField("name", value)
│  ├─ 描述: onChange → updateField("description", value)
│  ├─ 图标: onClick → updateField("icon", iconName)
│  ├─ 颜色: onClick → updateField("color", colorValue)
│  ├─ 类别: onValueChange → updateMetadataField("category", value)
│  └─ 成本: onValueChange → updateMetadataField("cost", value)
│
├─ 每次修改
│  └─ setEditedAgent(prev => ({
│      ...prev,
│      [key]: value,
│      updatedAt: Date.now()
│    }))
│
└─ 点击 "保存修改"
   ├─ handleSave()
   └─ await saveAgent(editedAgent)
      ├─ 调用 store action
      ├─ agent.updatedAt = Date.now()
      ├─ await saveAgentToFile(agent)  ← RPC
      ├─ 更新 Zustand store
      └─ 返回 Promise<void>
```

---

## 6. 模型选择流程 (智能参数更新)

```
┌─ 模型 Tab → Popover 按钮
│
├─ 用户点击按钮
│  └─ setModelPopoverOpen(true)
│
├─ Popover 弹出
│  └─ Command + CommandList
│     ├─ CommandInput: 搜索框
│     ├─ CommandGroup (按 provider)
│     │  └─ 列出所有模型
│     └─ onSelect 回调
│
├─ 用户选择模型
│  ├─ const capabilities = getCachedModelDefaults(modelValue)
│  │
│  └─ 智能更新参数:
│     ├─ Temperature:
│     │  ├─ 不支持? → undefined
│     │  ├─ 有默认值? → 使用默认值
│     │  └─ 否则 → 0.7
│     │
│     ├─ TopP:
│     │  ├─ 有默认值? → 使用
│     │  └─ 否则 → 1.0
│     │
│     ├─ MaxTokens:
│     │  ├─ 有默认值? → 使用
│     │  ├─ 有最大值? → Min(16384, maxOutput)
│     │  └─ 否则 → undefined
│     │
│     └─ Thinking (Claude 专用):
│        ├─ supportsReasoning? → enabled = true, budgetTokens = 10000
│        └─ 否则 → enabled = false, budgetTokens = undefined
│
└─ 模型信息更新
   └─ editedAgent.model = { modelId, provider }
   └─ editedAgent.parameters = newParams
```

---

## 7. 删除 Agent 流程

```
┌─ AgentConfigPanel 底部 "删除 Agent" 按钮
│
├─ onClick: setShowDeleteDialog(true)
│
├─ 删除确认 Dialog 弹出
│  └─ "确定要删除 Agent '名称' 吗？此操作无法撤销。"
│
├─ 用户选择 [取消] 或 [删除]
│  
│  ├─ 取消: setShowDeleteDialog(false) → 关闭 Dialog
│  │
│  └─ 删除: handleDeleteConfirm()
│     ├─ onDelete(editedAgent.id)
│     ├─ await deleteAgent(agentId)
│     │  ├─ await deleteAg
