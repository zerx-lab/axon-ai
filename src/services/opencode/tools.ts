import { getOpencodeService } from "./service";

export interface ToolInfo {
  id: string;
  description: string;
  parameters: object;
}

export async function getToolIds(): Promise<string[]> {
  const service = getOpencodeService();
  const state = service.getState();
  
  if (!state.endpoint) {
    throw new Error("OpenCode not connected");
  }
  
  const response = await fetch(
    `${state.endpoint}/experimental/tool/ids`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tool IDs: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function getTools(
  provider: string,
  model: string
): Promise<ToolInfo[]> {
  const service = getOpencodeService();
  const state = service.getState();
  
  if (!state.endpoint) {
    throw new Error("OpenCode not connected");
  }
  
  const url = new URL(`${state.endpoint}/experimental/tool`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("model", model);
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tools: ${response.statusText}`);
  }
  
  return await response.json();
}

export async function getToolsSimple(): Promise<{ id: string; description?: string }[]> {
  const service = getOpencodeService();
  const state = service.getState();
  
  if (!state.endpoint) {
    throw new Error("OpenCode not connected");
  }
  
  try {
    const ids = await getToolIds();
    console.log('[getToolsSimple] 从API获取到的工具ID列表:', ids);
    console.log('[getToolsSimple] 工具数量:', ids.length);
    
    const tools = ids.map(id => ({
      id,
      description: getToolDescription(id),
    }));
    
    console.log('[getToolsSimple] 处理后的工具列表:', tools);
    return tools;
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    return [];
  }
}

function getToolDescription(id: string): string {
  const descriptions: Record<string, string> = {
    bash: "执行 Shell 命令",
    read: "读取文件内容",
    edit: "编辑文件",
    write: "写入文件",
    glob: "文件模式匹配",
    grep: "内容搜索",
    task: "创建子任务",
    todowrite: "写入待办事项",
    todoread: "读取待办事项",
    webfetch: "获取网页内容",
    websearch: "网页搜索",
    codesearch: "代码搜索",
    skill: "技能系统",
    lsp: "LSP 语言服务",
    batch: "批量操作",
    invalid: "错误处理",
    question: "交互式提问",
  };
  
  return descriptions[id] || "未知工具";
}

export const TOOL_CATEGORIES = {
  file: ["read", "write", "edit", "glob", "grep"],
  execution: ["bash", "task"],
  web: ["webfetch", "websearch", "codesearch"],
  utility: ["todowrite", "todoread", "skill", "lsp", "batch"],
};

export function getToolCategory(toolId: string): string {
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    if (tools.includes(toolId)) {
      return category;
    }
  }
  return "other";
}

export const CATEGORY_NAMES: Record<string, string> = {
  file: "文件操作",
  execution: "执行",
  web: "网络",
  utility: "工具",
  other: "其他",
};
