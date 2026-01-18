/**
 * 工作流节点组件导出
 */

import type { NodeTypes } from "@xyflow/react";
import { PrimaryAgentNode, type PrimaryAgentNodeType } from "./PrimaryAgentNode";
import { SubagentNode, type SubagentNodeType } from "./SubagentNode";

export { PrimaryAgentNode, type PrimaryAgentNodeData, type PrimaryAgentNodeType } from "./PrimaryAgentNode";
export { SubagentNode, type SubagentNodeData, type SubagentNodeType } from "./SubagentNode";

/** React Flow 节点类型映射 */
export const nodeTypes: NodeTypes = {
  primary: PrimaryAgentNode,
  subagent: SubagentNode,
} as const;

/** 工作流节点联合类型 */
export type WorkflowNodeType = PrimaryAgentNodeType | SubagentNodeType;
