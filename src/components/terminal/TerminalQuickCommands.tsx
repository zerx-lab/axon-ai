/**
 * 快速命令面板组件
 *
 * 提供常用命令的快速访问：
 * - 预设命令列表
 * - 可执行命令
 * - 可编辑/删除
 */

import { useState } from "react";
import { Play, X, Plus, Edit2, Check, Trash2 } from "lucide-react";
import { useTerminal } from "@/stores/terminal";
import { cn } from "@/lib/utils";

interface TerminalQuickCommandsProps {
  onExecute: (command: string) => void;
  onClose: () => void;
}

export function TerminalQuickCommands({
  onExecute,
  onClose,
}: TerminalQuickCommandsProps) {
  const { quickCommands, addQuickCommand, removeQuickCommand, updateQuickCommand } =
    useTerminal();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCommand, setEditCommand] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleExecute = (command: string) => {
    onExecute(command);
  };

  const handleStartEdit = (cmd: (typeof quickCommands)[0]) => {
    setEditingId(cmd.id);
    setEditLabel(cmd.label);
    setEditCommand(cmd.command);
  };

  const handleSaveEdit = (id: string) => {
    updateQuickCommand(id, { label: editLabel, command: editCommand });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditCommand("");
  };

  const handleAdd = () => {
    if (newLabel && newCommand) {
      addQuickCommand({
        label: newLabel,
        command: newCommand,
        description: "",
      });
      setNewLabel("");
      setNewCommand("");
      setShowAddForm(false);
    }
  };

  const handleDelete = (id: string) => {
    removeQuickCommand(id);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/60 shadow-lg max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-accent/30">
        <span className="text-sm font-medium">快速命令</span>
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 space-y-1">
        {quickCommands.map((cmd) => (
          <div
            key={cmd.id}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded transition-colors group",
              "hover:bg-accent"
            )}
          >
            {editingId === cmd.id ? (
              <>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
                  placeholder="命令名称"
                />
                <input
                  type="text"
                  value={editCommand}
                  onChange={(e) => setEditCommand(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded font-mono"
                  placeholder="命令内容"
                />
                <button
                  onClick={() => handleSaveEdit(cmd.id)}
                  className="p-1 text-green-500 hover:text-green-400"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleExecute(cmd.command)}
                  className="flex items-center gap-1.5 px-2 py-1 text-sm text-foreground hover:bg-accent rounded transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{cmd.label}</span>
                  <code className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-accent/50 rounded">
                    {cmd.command}
                  </code>
                </button>

                <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleStartEdit(cmd)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cmd.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {showAddForm ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-accent/30">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded"
              placeholder="命令名称"
            />
            <input
              type="text"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded font-mono"
              placeholder="命令内容"
            />
            <button
              onClick={handleAdd}
              className="p-1 text-green-500 hover:text-green-400"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>添加命令</span>
          </button>
        )}
      </div>
    </div>
  );
}
