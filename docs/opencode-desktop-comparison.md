# opencode Desktop vs axon_desktop 会话消息展示功能差异对比

> 调研日期：2026-01-08
> 目的：分析 opencode desktop 的代码高亮和消息展示实现，对比 axon_desktop 当前实现，明确功能差异和改进方向

## 一、项目架构对比

### opencode Desktop 架构

```
opencode/packages/
├── desktop/          # Tauri 壳（入口点）
│   └── src/index.tsx # 使用 @opencode-ai/app 的 App 组件
├── app/              # 核心应用逻辑（页面、组件）
│   └── src/
│       ├── pages/session.tsx      # 会话页面
│       └── components/            # 业务组件
├── ui/               # UI 组件库（消息渲染核心）
│   └── src/
│       ├── components/
│       │   ├── message-part.tsx   # 消息部件渲染
│       │   ├── basic-tool.tsx     # 工具基础组件
│       │   ├── markdown.tsx       # Markdown 渲染
│       │   ├── diff.tsx           # Diff 显示
│       │   └── code.tsx           # 代码显示
│       └── context/
│           └── marked.tsx         # Markdown 上下文（shiki 配置）
└── sdk/              # API 类型定义
```

### axon_desktop 架构

```
axon_desktop/
├── src-tauri/        # Rust 后端
│   └── src/commands/diff.rs       # Diff 计算
└── src/
    └── components/
        ├── chat/parts/
        │   ├── PartRenderer.tsx   # 消息部件渲染
        │   └── MarkdownRenderer.tsx
        └── diff/
            └── DiffViewer.tsx     # Diff 显示
```

## 二、代码语法高亮实现对比

### 2.1 技术栈对比

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **高亮库** | shiki 3.20.0 + @pierre/diffs | react-syntax-highlighter (Prism) |
| **主题系统** | 自定义 "OpenCode" 主题，使用 CSS 变量 | 固定 oneDark 主题 |
| **Markdown 解析** | marked + marked-shiki + marked-katex | react-markdown + remark-gfm + prism |
| **数学公式** | ✅ marked-katex-extension | ❌ 不支持 |
| **语言加载** | 按需懒加载 (bundledLanguages) | 预加载所有语言 |
| **Worker 处理** | Web Worker 池 (poolSize: 2) | 主线程同步渲染 |

### 2.2 opencode 的 shiki 主题配置

**文件**: `opencode/packages/ui/src/context/marked.tsx`

opencode 使用 CSS 变量定义语法颜色，支持动态主题切换：

```typescript
registerCustomTheme("OpenCode", () => {
  return Promise.resolve({
    name: "OpenCode",
    colors: {
      "editor.background": "transparent",
      "editor.foreground": "var(--text-base)",
      "gitDecoration.addedResourceForeground": "var(--syntax-diff-add)",
      "gitDecoration.deletedResourceForeground": "var(--syntax-diff-delete)",
    },
    tokenColors: [
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: "var(--syntax-comment)" },
      },
      {
        scope: "keyword",
        settings: { foreground: "var(--syntax-keyword)" },
      },
      {
        scope: ["string", "punctuation.definition.string"],
        settings: { foreground: "var(--syntax-string)" },
      },
      // ... 更多 token 配置
    ],
    semanticTokenColors: {
      comment: "var(--syntax-comment)",
      string: "var(--syntax-string)",
      keyword: "var(--syntax-keyword)",
      variable: "var(--syntax-variable)",
      function: "var(--syntax-primitive)",
      type: "var(--syntax-type)",
      // ...
    },
  })
})
```

### 2.3 opencode 的 Markdown 渲染配置

```typescript
export const { use: useMarked, provider: MarkedProvider } = createSimpleContext({
  name: "Marked",
  init: () => {
    return marked.use(
      {
        renderer: {
          link({ href, title, text }) {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
          },
        },
      },
      markedKatex({ throwOnError: false }),  // LaTeX 数学公式支持
      markedShiki({
        async highlight(code, lang) {
          const highlighter = await getSharedHighlighter({ themes: ["OpenCode"], langs: [] })
          if (!(lang in bundledLanguages)) {
            lang = "text"
          }
          if (!highlighter.getLoadedLanguages().includes(lang)) {
            await highlighter.loadLanguage(lang as BundledLanguage)  // 按需加载语言
          }
          return highlighter.codeToHtml(code, {
            lang: lang || "text",
            theme: "OpenCode",
            tabindex: false,
          })
        },
      }),
    )
  },
})
```

### 2.4 axon_desktop 当前实现

**文件**: `src/components/chat/parts/MarkdownRenderer.tsx`

```typescript
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// 代码块渲染
<SyntaxHighlighter
  style={oneDark}
  language={language}
  PreTag="div"
  customStyle={{
    margin: 0,
    borderRadius: "0.375rem",
    fontSize: "0.8125rem",
  }}
>
  {codeContent}
</SyntaxHighlighter>
```

## 三、Diff 差异显示实现对比

### 3.1 技术对比

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **Diff 库** | @pierre/diffs (专业 Diff 组件) | 自建 Rust similar + React 组件 |
| **语法高亮** | ✅ Diff 内代码高亮 | ❌ 纯文本显示 |
| **视图模式** | unified / split，word-level diff | unified / split，行级 diff |
| **行号显示** | ✅ 响应式（移动端隐藏） | ✅ 固定显示 |
| **扩展行数** | expansionLineCount: 20 | contextLines: 3 |
| **Worker 处理** | ✅ Web Worker 池 | ✅ Rust 后端计算 |

### 3.2 opencode 的 Diff 组件实现

**文件**: `opencode/packages/ui/src/components/diff.tsx`

```typescript
import { FileDiff } from "@pierre/diffs"
import { getWorkerPool } from "../pierre/worker"

export function Diff<T>(props: DiffProps<T>) {
  let container!: HTMLDivElement
  const mobile = createMediaQuery("(max-width: 640px)")

  const options = createMemo(() => {
    const opts = {
      ...createDefaultOptions(props.diffStyle),
      ...others,
    }
    if (!mobile()) return opts
    return { ...opts, disableLineNumbers: true }  // 移动端隐藏行号
  })

  let instance: FileDiff<T> | undefined

  createEffect(() => {
    instance?.cleanUp()
    instance = new FileDiff<T>(opts, workerPool)
    
    instance.render({
      oldFile: { ...local.before, contents: beforeContents, cacheKey: checksum(beforeContents) },
      newFile: { ...local.after, contents: afterContents, cacheKey: checksum(afterContents) },
      lineAnnotations: annotations,
      containerWrapper: container,
    })
  })

  return <div data-component="diff" style={styleVariables} ref={container} />
}
```

### 3.3 opencode 的 Diff 默认选项

**文件**: `opencode/packages/ui/src/pierre/index.ts`

```typescript
export function createDefaultOptions<T>(style: FileDiffOptions<T>["diffStyle"]) {
  return {
    theme: "OpenCode",           // 使用自定义主题
    themeType: "system",         // 跟随系统明暗主题
    disableLineNumbers: false,
    overflow: "wrap",
    diffStyle: style ?? "unified",
    diffIndicators: "bars",      // 使用条形指示器
    expansionLineCount: 20,      // 展开行数
    lineDiffType: style === "split" ? "word-alt" : "none",  // split 模式启用 word-level diff
    maxLineDiffLength: 1000,
    maxLineLengthForHighlighting: 1000,
    disableFileHeader: true,
  }
}

export const styleVariables = {
  "--diffs-font-family": "var(--font-family-mono)",
  "--diffs-font-size": "var(--font-size-small)",
  "--diffs-line-height": "24px",
  "--diffs-tab-size": 2,
}
```

### 3.4 opencode 的 Worker Pool 配置

**文件**: `opencode/packages/ui/src/pierre/worker.ts`

```typescript
import { WorkerPoolManager } from "@pierre/diffs/worker"
import ShikiWorkerUrl from "@pierre/diffs/worker/worker.js?worker&url"

function createPool(lineDiffType: "none" | "word-alt") {
  const pool = new WorkerPoolManager(
    {
      workerFactory: () => new Worker(ShikiWorkerUrl, { type: "module" }),
      poolSize: 2,  // 工作线程池大小
    },
    {
      theme: "OpenCode",
      lineDiffType,
    },
  )
  pool.initialize()
  return pool
}
```

## 四、消息类型渲染对比

### 4.1 组件架构

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **Part 注册** | PART_MAPPING 注册表模式 | switch-case 模式 |
| **Tool 注册** | ToolRegistry.register() | switch-case 模式 |
| **动态渲染** | `<Dynamic component={...} />` | 条件渲染 |

opencode 的注册表模式：

```typescript
// Part 注册
export const PART_MAPPING: Record<string, PartComponent | undefined> = {}
PART_MAPPING["text"] = function TextPartDisplay(props) { ... }
PART_MAPPING["reasoning"] = function ReasoningPartDisplay(props) { ... }
PART_MAPPING["tool"] = function ToolPartDisplay(props) { ... }

// Tool 注册
export const ToolRegistry = {
  register: registerTool,
  render: getTool,
}
ToolRegistry.register({ name: "bash", render(props) { ... } })
ToolRegistry.register({ name: "edit", render(props) { ... } })
```

### 4.2 Text 文本消息

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **节流渲染** | ✅ 100ms throttle | ❌ 直接渲染 |
| **路径相对化** | ✅ 自动去除工作目录前缀 | ✅ 已实现 |
| **样式** | `margin-top: 32px`, `font-size: base` | prose 样式系统 |

opencode 的节流实现：

```typescript
const TEXT_RENDER_THROTTLE_MS = 100

function createThrottledValue(getValue: () => string) {
  const [value, setValue] = createSignal(getValue())
  let timeout: ReturnType<typeof setTimeout> | undefined
  let last = 0

  createEffect(() => {
    const next = getValue()
    const now = Date.now()
    const remaining = TEXT_RENDER_THROTTLE_MS - (now - last)
    if (remaining <= 0) {
      last = now
      setValue(next)
      return
    }
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      last = Date.now()
      setValue(next)
    }, remaining)
  })

  return value
}
```

### 4.3 Reasoning 推理消息

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **透明度** | `opacity: 0.5` | `opacity: 0.7` |
| **字体样式** | `font-style: italic` | 正常字体 |
| **边距** | `margin-top: 24px` | 较小边距 |

opencode 样式：

```css
[data-component="reasoning-part"] {
  width: 100%;
  opacity: 0.5;

  [data-component="markdown"] {
    margin-top: 24px;
    font-style: italic !important;
  }
}
```

### 4.4 Tool 工具消息

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **折叠组件** | Collapsible (kobalte) | Radix Collapsible |
| **工具图标** | 丰富的自定义图标库 | lucide-react 图标 |
| **权限请求** | ✅ 带动画边框高亮 | ❌ 无权限请求 UI |
| **错误展示** | Card variant="error" | 红色文本提示 |

opencode 的权限请求边框动画：

```css
[data-component="tool-part-wrapper"][data-permission="true"] {
  position: sticky;
  z-index: 20;
  border-radius: 6px;
  box-shadow: var(--shadow-xs-border-base);
}

/* 渐变边框动画 */
&::before {
  background:
    linear-gradient(var(--background-base) 0 0) padding-box,
    conic-gradient(
      from var(--border-angle),
      transparent 0deg,
      var(--border-warning-strong) 300deg,
      var(--border-warning-base) 360deg
    ) border-box;
  animation: chase-border 2.5s linear infinite;
}

@keyframes chase-border {
  from { --border-angle: 0deg; }
  to { --border-angle: 360deg; }
}
```

## 五、各工具类型展示对比

### 5.1 Bash/Shell 工具

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **展示方式** | Markdown 代码块 (\`\`\`command) | CollapsibleOutput |
| **命令显示** | `$ command` 前缀 | 纯输出文本 |
| **语法高亮** | ✅ shiki 高亮 | ❌ 纯文本 |
| **最大高度** | 240px + 滚动 | 自动展开 |

opencode 实现：

```typescript
ToolRegistry.register({
  name: "bash",
  render(props) {
    return (
      <BasicTool icon="console" trigger={{ title: "Shell", subtitle: props.input.description }}>
        <div data-component="tool-output" data-scrollable>
          <Markdown
            text={`\`\`\`command\n$ ${props.input.command}${props.output ? "\n\n" + props.output : ""}\n\`\`\``}
          />
        </div>
      </BasicTool>
    )
  },
})
```

### 5.2 Edit 编辑工具

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **变更统计** | DiffChanges 组件 (bars/text) | DiffStatsDisplay (+N/-M) |
| **Diff 视图** | @pierre/diffs 带语法高亮 | 自建 DiffViewer 无高亮 |
| **诊断信息** | ✅ LSP 错误显示 | ❌ 未实现 |
| **最大高度** | 420px | 无限制 |

opencode 实现：

```typescript
ToolRegistry.register({
  name: "edit",
  render(props) {
    const diffComponent = useDiffComponent()
    const diagnostics = createMemo(() => getDiagnostics(props.metadata.diagnostics, props.input.filePath))
    
    return (
      <BasicTool
        icon="code-lines"
        trigger={
          <div data-component="edit-trigger">
            <div data-slot="message-part-title-area">
              <div data-slot="message-part-title">Edit</div>
              <div data-slot="message-part-path">
                <span data-slot="message-part-directory">{getDirectory(...)}</span>
                <span data-slot="message-part-filename">{getFilename(...)}</span>
              </div>
            </div>
            <div data-slot="message-part-actions">
              <DiffChanges changes={props.metadata.filediff} />
            </div>
          </div>
        }
      >
        <div data-component="edit-content">
          <Dynamic
            component={diffComponent}
            before={{ name: filePath, contents: oldString }}
            after={{ name: filePath, contents: newString }}
          />
        </div>
        <DiagnosticsDisplay diagnostics={diagnostics()} />
      </BasicTool>
    )
  },
})
```

### 5.3 Write 写入工具

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **代码展示** | Code 组件带语法高亮 | CollapsibleOutput 纯文本 |
| **诊断信息** | ✅ LSP 错误显示 | ❌ 未实现 |
| **最大高度** | 240px | 自动展开 |

### 5.4 Task 子任务工具

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **默认展开** | ✅ defaultOpen=true | ✅ 已实现 |
| **子任务列表** | 带图标的工具摘要列表 | 简单文本列表 |
| **自动滚动** | ✅ createAutoScroll | ❌ 无 |
| **权限传递** | ✅ 子会话权限请求 | ❌ 未实现 |
| **会话跳转** | ✅ 点击跳转到子会话 | ❌ 未实现 |

### 5.5 TodoWrite 待办工具

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **进度显示** | `completed/total` | ❌ 无进度显示 |
| **复选框** | Checkbox 组件 | ❌ 无视觉复选框 |
| **完成状态** | data-completed 样式 | 简单列表 |

opencode 实现：

```typescript
ToolRegistry.register({
  name: "todowrite",
  render(props) {
    return (
      <BasicTool
        defaultOpen
        icon="checklist"
        trigger={{
          title: "To-dos",
          subtitle: `${completed}/${total}`,  // 完成进度
        }}
      >
        <div data-component="todos">
          <For each={props.input.todos}>
            {(todo: Todo) => (
              <Checkbox readOnly checked={todo.status === "completed"}>
                <div data-slot="message-part-todo-content" data-completed={todo.status === "completed"}>
                  {todo.content}
                </div>
              </Checkbox>
            )}
          </For>
        </div>
      </BasicTool>
    )
  },
})
```

### 5.6 搜索工具 (glob/grep/list)

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **参数显示** | args 数组 (pattern=xxx) | 搜索模式文本 |
| **结果渲染** | Markdown 渲染 | CollapsibleOutput |
| **最大高度** | 240px + 滚动 | 自动展开 |

## 六、UI 交互差异

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **折叠动画** | CSS transition | Radix Collapsible |
| **权限请求边框** | ✅ 渐变动画边框 | ❌ 无 |
| **消息导航** | SessionMessageRail 侧边栏 | ❌ 无消息导航 |
| **Review 面板** | ✅ 独立的文件变更面板 | ❌ 无 |
| **自动滚动** | createAutoScroll hook | 简单 scrollIntoView |
| **滚动条** | 隐藏 (scrollbar-width: none) | 默认显示 |

### 6.1 opencode 的 DiffChanges 变更统计组件

支持两种显示模式：
- **default**: 显示 `+N -M` 文本
- **bars**: 显示 5 个彩色条形图（绿色=新增，红色=删除，灰色=中性）

```typescript
export function DiffChanges(props: {
  changes: { additions: number; deletions: number }
  variant?: "default" | "bars"
}) {
  const ADD_COLOR = "var(--icon-diff-add-base)"
  const DELETE_COLOR = "var(--icon-diff-delete-base)"
  const NEUTRAL_COLOR = "var(--icon-weak-base)"

  // 计算条形图块数（最多5块）
  const blockCounts = createMemo(() => {
    const TOTAL_BLOCKS = 5
    // 智能分配增/删/中性块...
  })

  return (
    <Switch>
      <Match when={variant() === "bars"}>
        <svg viewBox="0 0 18 12">
          <For each={visibleBlocks()}>
            {(color, i) => <rect x={i() * 4} width="2" height="12" rx="1" fill={color} />}
          </For>
        </svg>
      </Match>
      <Match when={variant() === "default"}>
        <span data-slot="diff-changes-additions">+{additions()}</span>
        <span data-slot="diff-changes-deletions">-{deletions()}</span>
      </Match>
    </Switch>
  )
}
```

### 6.2 opencode 的工具输出样式

```css
[data-component="tool-output"] {
  white-space: pre;
  padding: 8px 12px;
  height: fit-content;
}

[data-component="tool-output"][data-scrollable] {
  height: auto;
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: none;
}

[data-component="edit-content"] {
  border-top: 1px solid var(--border-weaker-base);
  max-height: 420px;
  overflow-y: auto;
}

[data-component="write-content"] {
  max-height: 240px;
  overflow-y: auto;
}
```

## 七、性能优化差异

| 特性 | opencode Desktop | axon_desktop |
|------|------------------|--------------|
| **文本渲染** | 100ms 节流 | 直接渲染 |
| **Diff 计算** | Web Worker 池 | Rust 后端 (更好) |
| **语法高亮** | 异步 + 缓存 | 同步渲染 |
| **滚动处理** | requestAnimationFrame | 直接处理 |

### 7.1 opencode 的自动滚动 hook

```typescript
export function createAutoScroll(options: {
  working: () => boolean
  onUserInteracted?: () => void
}) {
  let scrollRef: HTMLDivElement | undefined
  let contentRef: HTMLDivElement | undefined
  let userScrolled = false
  
  const handleScroll = () => {
    if (!scrollRef) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef
    const atBottom = scrollHeight - scrollTop - clientHeight < 10
    if (!atBottom) userScrolled = true
    else userScrolled = false
  }

  const forceScrollToBottom = () => {
    scrollRef?.scrollTo({ top: scrollRef.scrollHeight, behavior: "auto" })
  }

  // 当 working 时自动滚动到底部
  createEffect(() => {
    if (options.working() && !userScrolled) {
      requestAnimationFrame(forceScrollToBottom)
    }
  })

  return { scrollRef, contentRef, handleScroll, forceScrollToBottom }
}
```

## 八、待实现功能优先级

### 高优先级

1. **Diff 语法高亮**
   - 使用 shiki 为 DiffViewer 添加代码高亮
   - 参考 @pierre/diffs 的实现方式
   - 或考虑直接集成 @pierre/diffs

2. **Markdown 数学公式**
   - 添加 marked-katex-extension 或 remark-math + rehype-katex
   - 支持行内公式 `$...$` 和块级公式 `$$...$$`

3. **Bash 输出语法高亮**
   - 命令输出使用 Markdown 代码块渲染
   - 添加 `$ command` 前缀显示

### 中优先级

4. **诊断信息展示**
   - 显示 LSP 错误/警告
   - edit/write 工具完成后显示文件诊断

5. **权限请求 UI**
   - 带动画边框的权限确认
   - Allow once / Allow always / Deny 按钮

6. **文本渲染节流**
   - 100ms 节流避免频繁更新
   - 提升流式输出时的性能

7. **工具输出高度限制**
   - 添加 max-height 和滚动
   - 隐藏滚动条美化 UI

### 低优先级

8. **消息导航侧边栏**
   - SessionMessageRail 组件
   - 快速跳转到不同消息

9. **Review 面板**
   - 独立的文件变更预览面板
   - 支持 unified/split 视图切换

10. **子任务会话跳转**
    - Task 工具点击跳转到子会话
    - 子会话权限请求传递

11. **TodoWrite 视觉优化**
    - 添加进度显示 `completed/total`
    - 添加复选框视觉效果

## 九、关键依赖对比

### opencode Desktop

```json
{
  "dependencies": {
    "shiki": "3.20.0",
    "marked": "17.0.1",
    "marked-shiki": "1.2.1",
    "marked-katex-extension": "5.1.6",
    "@pierre/diffs": "1.0.2",
    "@shikijs/transformers": "3.9.2"
  }
}
```

### axon_desktop

```json
{
  "dependencies": {
    "react-markdown": "^9.x",
    "react-syntax-highlighter": "^16.1.0",
    "remark-gfm": "^4.x"
  }
}
```

### 建议添加的依赖

```json
{
  "shiki": "^3.x",
  "marked-katex-extension": "^5.x"  // 或 remark-math + rehype-katex
}
```

## 十、参考文件路径

### opencode Desktop 关键文件

- `opencode/packages/ui/src/context/marked.tsx` - Markdown 配置和 shiki 主题
- `opencode/packages/ui/src/components/message-part.tsx` - 消息部件渲染
- `opencode/packages/ui/src/components/basic-tool.tsx` - 工具基础组件
- `opencode/packages/ui/src/components/diff.tsx` - Diff 显示
- `opencode/packages/ui/src/components/diff-changes.tsx` - 变更统计
- `opencode/packages/ui/src/pierre/index.ts` - Diff 配置
- `opencode/packages/ui/src/pierre/worker.ts` - Worker Pool
- `opencode/packages/app/src/pages/session.tsx` - 会话页面

### axon_desktop 关键文件

- `src/components/chat/parts/PartRenderer.tsx` - 消息部件渲染
- `src/components/chat/parts/MarkdownRenderer.tsx` - Markdown 渲染
- `src/components/diff/DiffViewer.tsx` - Diff 显示
- `src-tauri/src/commands/diff.rs` - Rust Diff 计算
