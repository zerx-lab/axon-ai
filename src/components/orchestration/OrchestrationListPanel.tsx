import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Workflow, Search, Loader2, Copy, Trash2, MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrchestrationStoreV2 } from "@/stores/orchestration-v2";
import type { OrchestrationGroup } from "@/types/orchestration";

interface OrchestrationListPanelProps {
  onCreateGroup: () => void;
  onSelectGroup: (group: OrchestrationGroup) => void;
  selectedGroupId?: string | null;
}

export function OrchestrationListPanel({
  onCreateGroup,
  onSelectGroup,
  selectedGroupId,
}: OrchestrationListPanelProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<OrchestrationGroup | null>(null);

  const {
    groups,
    isLoading,
    error,
    loadGroups,
    deleteGroup,
    duplicateGroup,
  } = useOrchestrationStoreV2();

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
    );
  }, [groups, searchQuery]);

  const handleDeleteClick = (group: OrchestrationGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setGroupToDelete(group);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (groupToDelete) {
      await deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleDuplicate = async (group: OrchestrationGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    await duplicateGroup(group.id);
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border/50">
      <div className="flex items-center justify-between h-10 px-3 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground/80">
            {t("orchestration.groups", "编排组")}
          </span>
        </div>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreateGroup}
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
              {t("orchestration.createGroup", "创建编排组")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="px-3 py-2 border-b border-sidebar-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            placeholder={t("orchestration.searchGroups", "搜索编排组...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
            </div>
          ) : error ? (
            <div className="text-xs text-destructive/70 text-center py-8 px-4">
              {error}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Workflow className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-xs text-muted-foreground/50 text-center mb-4">
                {searchQuery
                  ? t("orchestration.noSearchResults", "未找到匹配的编排组")
                  : t("orchestration.noGroups", "暂无编排组，点击上方按钮创建")}
              </p>
              {!searchQuery && (
                <Button onClick={onCreateGroup} size="sm" variant="outline">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {t("orchestration.createGroup", "创建编排组")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredGroups.map((group) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <div
                    key={group.id}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 w-full",
                      "rounded-md transition-colors duration-150 cursor-pointer",
                      isSelected
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                    onClick={() => onSelectGroup(group)}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${group.color || "#8B5CF6"}15` }}
                    >
                      <Workflow
                        className="w-4 h-4"
                        style={{ color: group.color || "#8B5CF6" }}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{group.name}</span>
                      <span className="text-xs text-muted-foreground/60 truncate">
                        {group.subagents.length} 个子 Agent
                      </span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "w-6 h-6 flex items-center justify-center rounded",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            "text-muted-foreground/70 hover:text-foreground hover:bg-accent"
                          )}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={(e) => handleDuplicate(group, e as unknown as React.MouseEvent)}>
                          <Copy className="w-3.5 h-3.5 mr-2" />
                          复制
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteClick(group, e as unknown as React.MouseEvent)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-sidebar-border/50 text-xs text-muted-foreground/50">
        {groups.length} 个编排组
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除编排组</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 "{groupToDelete?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
