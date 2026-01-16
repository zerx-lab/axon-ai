/**
 * Agent 节点组件
 */

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrchestrationNodeData } from "@/stores/orchestration";

type AgentNodeType = Node<OrchestrationNodeData, "agent">;

export const AgentNode = memo(function AgentNode({
  data,
  selected,
}: NodeProps<AgentNodeType>) {
  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 bg-background shadow-sm",
        "min-w-[120px] text-center",
        selected ? "border-blue-500" : "border-blue-300",
        "transition-colors duration-150"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500 border-2 border-background"
      />
      
      <div className="flex items-center gap-2 justify-center">
        <Bot className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium">{data.label}</span>
      </div>
      
      {data.description && (
        <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500 border-2 border-background"
      />
    </div>
  );
});
