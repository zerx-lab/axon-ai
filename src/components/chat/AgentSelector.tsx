import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import type { Agent } from "@/types/chat";

interface AgentSelectorProps {
  agents: Agent[];
  currentAgent: Agent | null;
  onSelectAgent: (agentName: string) => void;
  onAfterSelect?: () => void;
  disabled?: boolean;
  className?: string;
}

export function AgentSelector({
  agents,
  currentAgent,
  onSelectAgent,
  onAfterSelect,
  disabled,
  className,
}: AgentSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (agents.length === 0) {
    return null;
  }

  const displayName = currentAgent?.name ?? t("chat.selectAgent");

  const handleSelect = (agentName: string) => {
    onSelectAgent(agentName);
    setOpen(false);
    onAfterSelect?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5",
            "h-8 px-2.5 rounded-lg",
            "text-sm text-muted-foreground",
            "hover:bg-muted/50 hover:text-foreground",
            "transition-colors duration-100",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            disabled && "pointer-events-none opacity-50",
            className
          )}
          disabled={disabled}
          title={t("chat.agent")}
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="capitalize">{displayName}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-0 rounded-lg shadow-lg border border-border"
        align="start"
        sideOffset={8}
      >
        <Command className="rounded-lg">
          <CommandList>
            <CommandGroup heading={t("chat.agent")}>
              {agents.map((agent) => {
                const isSelected = agent.name === currentAgent?.name;

                return (
                  <CommandItem
                    key={agent.name}
                    value={agent.name}
                    onSelect={() => handleSelect(agent.name)}
                    className="gap-2"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center h-4 w-4 shrink-0",
                        "rounded-sm border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="capitalize truncate">{agent.name}</span>
                      {agent.description && (
                        <span className="text-xs text-muted-foreground truncate">
                          {agent.description}
                        </span>
                      )}
                    </div>
                    {agent.color && (
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: agent.color }}
                      />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default AgentSelector;
