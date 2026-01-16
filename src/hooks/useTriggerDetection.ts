/**
 * 触发字符检测 Hook
 * 用于检测输入框中的 @ 和 / 触发字符，支持补全功能
 */

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * 触发类型
 */
export type TriggerType = "mention" | "command" | null;

/**
 * 触发状态
 */
export interface TriggerState {
  /** 触发类型：@ 为 mention，/ 为 command */
  type: TriggerType;
  /** 触发字符后的搜索词 */
  searchText: string;
  /** 触发字符在输入框中的起始位置 */
  startIndex: number;
  /** 触发字符在输入框中的结束位置（包含搜索词） */
  endIndex: number;
}

/**
 * Hook 返回值
 */
export interface UseTriggerDetectionReturn {
  /** 当前触发状态 */
  trigger: TriggerState | null;
  /** 是否显示 @ 提及弹窗 */
  showMention: boolean;
  /** 是否显示 / 命令弹窗 */
  showCommand: boolean;
  /** 检测输入值变化 */
  detectTrigger: (value: string, cursorPosition: number) => void;
  /** 关闭弹窗 */
  closeTrigger: () => void;
  /** 选择补全项后替换输入 */
  replaceWithSelection: (
    currentValue: string,
    replacement: string
  ) => { newValue: string; newCursorPosition: number };
}

/**
 * 检测输入框中的触发字符
 * 
 * @param value 输入框当前值
 * @param cursorPosition 光标位置
 * @returns 触发状态或 null
 */
function detectTriggerFromValue(
  value: string,
  cursorPosition: number
): TriggerState | null {
  if (!value || cursorPosition === 0) return null;

  // 获取光标前的文本
  const textBeforeCursor = value.slice(0, cursorPosition);
  
  // 检测 @ 触发（任意位置，但前面需要是空格或开头）
  const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  if (mentionMatch) {
    const searchText = mentionMatch[1];
    // 计算 @ 的位置（需要考虑前面的空格）
    const startIndex = textBeforeCursor.lastIndexOf("@");
    return {
      type: "mention",
      searchText,
      startIndex,
      endIndex: cursorPosition,
    };
  }

  // 检测 / 触发（仅在行首或整个输入开头）
  // 找到当前行的开头
  const lastNewline = textBeforeCursor.lastIndexOf("\n");
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const currentLine = textBeforeCursor.slice(lineStart);
  
  // 检查当前行是否以 / 开头
  const commandMatch = currentLine.match(/^\/([^\s]*)$/);
  if (commandMatch) {
    const searchText = commandMatch[1];
    return {
      type: "command",
      searchText,
      startIndex: lineStart,
      endIndex: cursorPosition,
    };
  }

  return null;
}

/**
 * 触发字符检测 Hook
 * 
 * 使用示例:
 * ```tsx
 * const { trigger, showMention, showCommand, detectTrigger, closeTrigger, replaceWithSelection } = useTriggerDetection();
 * 
 * // 在输入变化时检测
 * const handleChange = (e) => {
 *   setValue(e.target.value);
 *   detectTrigger(e.target.value, e.target.selectionStart);
 * };
 * 
 * // 选择补全项
 * const handleSelect = (item) => {
 *   const { newValue, newCursorPosition } = replaceWithSelection(value, item.value);
 *   setValue(newValue);
 *   // 设置光标位置...
 * };
 * ```
 */
export function useTriggerDetection(): UseTriggerDetectionReturn {
  const [trigger, setTrigger] = useState<TriggerState | null>(null);
  
  // 使用 ref 避免闭包问题
  const triggerRef = useRef<TriggerState | null>(null);
  
  useEffect(() => {
    triggerRef.current = trigger;
  }, [trigger]);

  /**
   * 检测输入值变化
   */
  const detectTrigger = useCallback((value: string, cursorPosition: number) => {
    const detected = detectTriggerFromValue(value, cursorPosition);
    setTrigger(detected);
  }, []);

  /**
   * 关闭弹窗
   */
  const closeTrigger = useCallback(() => {
    setTrigger(null);
  }, []);

  /**
   * 选择补全项后替换输入
   */
  const replaceWithSelection = useCallback(
    (currentValue: string, replacement: string) => {
      const currentTrigger = triggerRef.current;
      if (!currentTrigger) {
        return { newValue: currentValue, newCursorPosition: currentValue.length };
      }

      const { startIndex, endIndex } = currentTrigger;
      const before = currentValue.slice(0, startIndex);
      const after = currentValue.slice(endIndex);
      
      // 构建新值：前面的文本 + 替换内容 + 空格 + 后面的文本
      const newValue = before + replacement + " " + after;
      const newCursorPosition = before.length + replacement.length + 1;

      // 关闭弹窗
      setTrigger(null);

      return { newValue, newCursorPosition };
    },
    []
  );

  return {
    trigger,
    showMention: trigger?.type === "mention",
    showCommand: trigger?.type === "command",
    detectTrigger,
    closeTrigger,
    replaceWithSelection,
  };
}
