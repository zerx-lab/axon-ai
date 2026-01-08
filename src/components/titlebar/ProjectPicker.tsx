/**
 * 项目选择器组件
 * 
 * 类似 VSCode 的项目选择器，点击标题栏中间区域弹出
 * - 搜索已有项目列表
 * - 快速打开系统目录选择器
 * - 显示最近访问的项目
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  Clock,
  Star,
} from "lucide-react";
import type { Project } from "@/types/project";

// ============== 类型定义 ==============

interface ProjectPickerProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 项目列表 */
  projects: Project[];
  /** 当前项目目录 */
  currentDirectory?: string;
  /** 选择项目回调 */
  onSelectProject: (directory: string) => void;
  /** 打开目录选择器回调 */
  onOpenDirectoryPicker: () => void;
}

// ============== 主组件 ==============

export function ProjectPicker({
  open,
  onOpenChange,
  projects,
  currentDirectory,
  onSelectProject,
  onOpenDirectoryPicker,
}: ProjectPickerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  // 关闭时重置搜索
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  // 过滤项目列表
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    
    const query = searchQuery.toLowerCase();
    return projects.filter((project) => {
      const nameMatch = project.name.toLowerCase().includes(query);
      const pathMatch = project.directory.toLowerCase().includes(query);
      return nameMatch || pathMatch;
    });
  }, [projects, searchQuery]);

  // 选择项目
  const handleSelectProject = useCallback(
    (project: Project) => {
      onSelectProject(project.directory);
      onOpenChange(false);
    },
    [onSelectProject, onOpenChange]
  );

  // 打开目录选择器
  const handleOpenFolder = useCallback(() => {
    onOpenChange(false);
    onOpenDirectoryPicker();
  }, [onOpenChange, onOpenDirectoryPicker]);

  // 检查是否为当前项目
  const isCurrentProject = useCallback(
    (directory: string) => {
      if (!currentDirectory) return false;
      const normalizedCurrent = currentDirectory.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
      const normalizedDir = directory.replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
      return normalizedCurrent === normalizedDir;
    },
    [currentDirectory]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 gap-0 overflow-hidden",
          // VSCode 风格：固定宽度
          "w-[560px] max-w-[90vw]",
          // 精致的阴影和边框
          "border border-border/60 shadow-2xl",
          // Zed 风格小圆角
          "rounded-lg"
        )}
      >
        <Command 
          className="rounded-lg border-0"
          shouldFilter={false} // 手动过滤
        >
          {/* 搜索输入框 */}
          <CommandInput
            placeholder={t("projectPicker.searchPlaceholder", "搜索项目或输入路径...")}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="border-0"
          />

          <CommandList className="max-h-[400px]">
            {/* 空状态 */}
            <CommandEmpty className="py-8 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Folder className="h-10 w-10 opacity-40" />
                <span className="text-sm">{t("projectPicker.noResults", "未找到匹配的项目")}</span>
              </div>
            </CommandEmpty>

            {/* 快捷操作 */}
            <CommandGroup heading={t("projectPicker.actions", "操作")}>
              <CommandItem
                onSelect={handleOpenFolder}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-medium">
                    {t("projectPicker.openFolder", "打开文件夹...")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("projectPicker.openFolderDesc", "浏览并选择一个项目文件夹")}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {/* 最近项目 */}
            {filteredProjects.length > 0 && (
              <CommandGroup 
                heading={
                  searchQuery 
                    ? t("projectPicker.searchResults", "搜索结果") 
                    : t("projectPicker.recentProjects", "最近项目")
                }
              >
                {filteredProjects.map((project) => {
                  const isCurrent = isCurrentProject(project.directory);
                  
                  return (
                    <CommandItem
                      key={project.id}
                      value={project.id}
                      onSelect={() => handleSelectProject(project)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                        isCurrent && "bg-accent/50"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md",
                        project.isDefault 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {project.isDefault ? (
                          <Star className="h-4 w-4" />
                        ) : (
                          <Folder className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {project.name}
                          </span>
                          {isCurrent && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-primary/15 text-primary rounded">
                              {t("projectPicker.current", "当前")}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">
                          {project.directory}
                        </span>
                      </div>
                      {!project.isDefault && (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>

          {/* 底部提示 */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd>
                {t("projectPicker.navigate", "导航")}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd>
                {t("projectPicker.select", "选择")}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd>
                {t("projectPicker.close", "关闭")}
              </span>
            </div>
            <span>
              {projects.length} {t("projectPicker.projectsCount", "个项目")}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
