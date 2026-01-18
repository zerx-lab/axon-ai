/**
 * Agent 列表面板
 * 
 * 显示所有 Agent，支持创建、选择、搜索
 */

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Bot, Brain, Search, BookOpen, Palette, FileText, Eye, Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOrchestrationStore } from "@/stores/orchestration";
import type { AgentDefinition } from "@/types/agent";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Bot,
  Brain,
  Search,
  BookOpen,
  Palette,
  FileText,
  Eye,
  Settings2,
};

interface AgentListPanelProps {
  onCreateAgent: () => void;
  onSelectAgent: (agent: AgentDefinition) => void;
  selectedAgentId?: string | null;
}

export function AgentListPanel({
  onCreateAgent,
  onSelectAgent,
  selectedAgentId,
}: AgentListPanelProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  
  const {
    agents,
    isLoadingAgents,
    agentsError,
    loadAgents,
  } = useOrchestrationStore();

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(
      agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  const getAgentIcon = (agent: AgentDefinition) => {
    return agent.icon && ICON_MAP[agent.icon] ? ICON_MAP[agent.icon] : Bot;
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border/50">
      <div className="flex items-center justify-between h-10 px-3 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground/80">
            {t("orchestration.agents", "Agent 列表")}
          </span>
        </div>
        
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreateAgent}
                className={cn(
                  "w-6 h-6 flex items-center justify-center",
                  "text-muted-foreground/70 hover:text-foreground",
                  "hover:bg-accent rounded transition-colors duration-150"
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("orchestration.createAgent", "创建 Agent")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="px-3 py-2 border-b border-sidebar-border/50">
        <Input
          placeholder={t("orchestration.searchAgents", "搜索 Agent...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
            </div>
          ) : agentsError ? (
            <div className="text-xs text-destructive/70 text-center py-8 px-4">
              {agentsError}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground/50 text-center mb-4">
                {searchQuery
                  ? t("orchestration.noSearchResults", "未找到匹配的 Agent")
                  : t("orchestration.noAgents", "暂无 Agent，点击上方按钮创建")}
              </p>
              {!searchQuery && (
                <Button onClick={onCreateAgent} size="sm" variant="outline">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {t("orchestration.createAgent", "创建 Agent")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredAgents.map((agent) => {
                const IconComponent = getAgentIcon(agent);
                const isSelected = selectedAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => onSelectAgent(agent)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 w-full",
                      "text-left rounded-md transition-colors duration-150",
                      isSelected
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${agent.color || "#3B82F6"}15` }}
                    >
                      <IconComponent
                        className="w-4 h-4"
                        style={{ color: agent.color || "#3B82F6" }}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{agent.name}</span>
                      {agent.description && (
                        <span className="text-xs text-muted-foreground/60 truncate">
                          {agent.description}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-sidebar-border/50 text-xs text-muted-foreground/50">
        {agents.length} 个 Agent
      </div>
    </div>
  );
}
