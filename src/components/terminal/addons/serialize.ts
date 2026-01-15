/**
 * SerializeAddon - 序列化终端缓冲区内容
 *
 * 移植自 xterm.js addon-serialize，适配 ghostty-web。
 * 支持将终端内容序列化为字符串，可用于恢复终端状态。
 *
 * 用法：
 * ```typescript
 * const serializeAddon = new SerializeAddon();
 * term.loadAddon(serializeAddon);
 * const content = serializeAddon.serialize();
 * ```
 */

import type { ITerminalAddon, ITerminalCore, IBufferRange } from "ghostty-web";

// ============================================================================
// 缓冲区类型（匹配 ghostty-web 内部接口）
// ============================================================================

interface IBuffer {
  readonly type: "normal" | "alternate";
  readonly cursorX: number;
  readonly cursorY: number;
  readonly viewportY: number;
  readonly baseY: number;
  readonly length: number;
  getLine(y: number): IBufferLine | undefined;
  getNullCell(): IBufferCell;
}

interface IBufferLine {
  readonly length: number;
  readonly isWrapped: boolean;
  getCell(x: number): IBufferCell | undefined;
  translateToString(
    trimRight?: boolean,
    startColumn?: number,
    endColumn?: number
  ): string;
}

interface IBufferCell {
  getChars(): string;
  getCode(): number;
  getWidth(): number;
  getFgColorMode(): number;
  getBgColorMode(): number;
  getFgColor(): number;
  getBgColor(): number;
  isBold(): number;
  isItalic(): number;
  isUnderline(): number;
  isStrikethrough(): number;
  isBlink(): number;
  isInverse(): number;
  isInvisible(): number;
  isFaint(): number;
  isDim(): boolean;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface ISerializeOptions {
  /**
   * 要序列化的行范围。指定显式范围时，光标将获得最终重定位。
   */
  range?: ISerializeRange;
  /**
   * 要序列化的滚动缓冲区中的行数，从滚动缓冲区底部开始。
   * 未指定时，将序列化滚动缓冲区中的所有可用行。
   */
  scrollback?: number;
  /**
   * 是否从序列化中排除终端模式。
   * 默认：false
   */
  excludeModes?: boolean;
  /**
   * 是否从序列化中排除备用缓冲区。
   * 默认：false
   */
  excludeAltBuffer?: boolean;
}

export interface ISerializeRange {
  /**
   * 开始序列化的行（包含）。
   */
  start: number;
  /**
   * 结束序列化的行（包含）。
   */
  end: number;
}

export interface IHTMLSerializeOptions {
  /**
   * 要序列化的滚动缓冲区中的行数，从滚动缓冲区底部开始。
   */
  scrollback?: number;
  /**
   * 是否仅序列化选中内容。
   * 默认：false
   */
  onlySelection?: boolean;
  /**
   * 是否包含终端的全局背景。
   * 默认：false
   */
  includeGlobalBackground?: boolean;
  /**
   * 要序列化的范围。优先于 onlySelection。
   */
  range?: {
    startLine: number;
    endLine: number;
    startCol: number;
  };
}

// ============================================================================
// 辅助函数
// ============================================================================

function constrain(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

function equalFg(cell1: IBufferCell, cell2: IBufferCell): boolean {
  return (
    cell1.getFgColorMode() === cell2.getFgColorMode() &&
    cell1.getFgColor() === cell2.getFgColor()
  );
}

function equalBg(cell1: IBufferCell, cell2: IBufferCell): boolean {
  return (
    cell1.getBgColorMode() === cell2.getBgColorMode() &&
    cell1.getBgColor() === cell2.getBgColor()
  );
}

function equalFlags(cell1: IBufferCell, cell2: IBufferCell): boolean {
  return (
    !!cell1.isInverse() === !!cell2.isInverse() &&
    !!cell1.isBold() === !!cell2.isBold() &&
    !!cell1.isUnderline() === !!cell2.isUnderline() &&
    !!cell1.isBlink() === !!cell2.isBlink() &&
    !!cell1.isInvisible() === !!cell2.isInvisible() &&
    !!cell1.isItalic() === !!cell2.isItalic() &&
    !!cell1.isDim() === !!cell2.isDim() &&
    !!cell1.isStrikethrough() === !!cell2.isStrikethrough()
  );
}

// ============================================================================
// 基础序列化处理器
// ============================================================================

abstract class BaseSerializeHandler {
  constructor(protected readonly _buffer: IBuffer) {}

  public serialize(
    range: IBufferRange,
    excludeFinalCursorPosition?: boolean
  ): string {
    let oldCell = this._buffer.getNullCell();

    const startRow = range.start.y;
    const endRow = range.end.y;
    const startColumn = range.start.x;
    const endColumn = range.end.x;

    this._beforeSerialize(endRow - startRow + 1, startRow, endRow);

    for (let row = startRow; row <= endRow; row++) {
      const line = this._buffer.getLine(row);
      if (line) {
        const startLineColumn = row === range.start.y ? startColumn : 0;
        const endLineColumn = Math.min(endColumn, line.length);

        for (let col = startLineColumn; col < endLineColumn; col++) {
          const c = line.getCell(col);
          if (!c) {
            continue;
          }
          this._nextCell(c, oldCell, row, col);
          oldCell = c;
        }
      }
      this._rowEnd(row, row === endRow);
    }

    this._afterSerialize();

    return this._serializeString(excludeFinalCursorPosition);
  }

  protected _nextCell(
    _cell: IBufferCell,
    _oldCell: IBufferCell,
    _row: number,
    _col: number
  ): void {}
  protected _rowEnd(_row: number, _isLastRow: boolean): void {}
  protected _beforeSerialize(
    _rows: number,
    _startRow: number,
    _endRow: number
  ): void {}
  protected _afterSerialize(): void {}
  protected _serializeString(_excludeFinalCursorPosition?: boolean): string {
    return "";
  }
}

// ============================================================================
// 字符串序列化处理器
// ============================================================================

class StringSerializeHandler extends BaseSerializeHandler {
  private _rowIndex: number = 0;
  private _allRows: string[] = [];
  private _allRowSeparators: string[] = [];
  private _currentRow: string = "";
  private _nullCellCount: number = 0;
  private _cursorStyle: IBufferCell;
  private _firstRow: number = 0;
  private _lastContentCursorRow: number = 0;

  constructor(
    buffer: IBuffer,
    private readonly _terminal: ITerminalCore
  ) {
    super(buffer);
    this._cursorStyle = this._buffer.getNullCell();
  }

  protected _beforeSerialize(rows: number, start: number, _end: number): void {
    this._allRows = new Array<string>(rows);
    this._allRowSeparators = new Array<string>(rows);
    this._rowIndex = 0;

    this._currentRow = "";
    this._nullCellCount = 0;
    this._cursorStyle = this._buffer.getNullCell();

    this._lastContentCursorRow = start;
    this._firstRow = start;
  }

  protected _rowEnd(row: number, isLastRow: boolean): void {
    let rowSeparator = "";

    if (this._nullCellCount > 0) {
      this._currentRow += " ".repeat(this._nullCellCount);
      this._nullCellCount = 0;
    }

    if (!isLastRow) {
      const nextLine = this._buffer.getLine(row + 1);

      if (!nextLine?.isWrapped) {
        rowSeparator = "\r\n";
      }
    }

    this._allRows[this._rowIndex] = this._currentRow;
    this._allRowSeparators[this._rowIndex++] = rowSeparator;
    this._currentRow = "";
    this._nullCellCount = 0;
  }

  private _diffStyle(cell: IBufferCell, oldCell: IBufferCell): number[] {
    const sgrSeq: number[] = [];
    const fgChanged = !equalFg(cell, oldCell);
    const bgChanged = !equalBg(cell, oldCell);
    const flagsChanged = !equalFlags(cell, oldCell);

    if (fgChanged || bgChanged || flagsChanged) {
      if (this._isAttributeDefault(cell)) {
        if (!this._isAttributeDefault(oldCell)) {
          sgrSeq.push(0);
        }
      } else {
        if (flagsChanged) {
          if (!!cell.isInverse() !== !!oldCell.isInverse()) {
            sgrSeq.push(cell.isInverse() ? 7 : 27);
          }
          if (!!cell.isBold() !== !!oldCell.isBold()) {
            sgrSeq.push(cell.isBold() ? 1 : 22);
          }
          if (!!cell.isUnderline() !== !!oldCell.isUnderline()) {
            sgrSeq.push(cell.isUnderline() ? 4 : 24);
          }
          if (!!cell.isBlink() !== !!oldCell.isBlink()) {
            sgrSeq.push(cell.isBlink() ? 5 : 25);
          }
          if (!!cell.isInvisible() !== !!oldCell.isInvisible()) {
            sgrSeq.push(cell.isInvisible() ? 8 : 28);
          }
          if (!!cell.isItalic() !== !!oldCell.isItalic()) {
            sgrSeq.push(cell.isItalic() ? 3 : 23);
          }
          if (!!cell.isDim() !== !!oldCell.isDim()) {
            sgrSeq.push(cell.isDim() ? 2 : 22);
          }
          if (!!cell.isStrikethrough() !== !!oldCell.isStrikethrough()) {
            sgrSeq.push(cell.isStrikethrough() ? 9 : 29);
          }
        }
        if (fgChanged) {
          const color = cell.getFgColor();
          const mode = cell.getFgColorMode();
          if (mode === 2 || mode === 3 || mode === -1) {
            sgrSeq.push(
              38,
              2,
              (color >>> 16) & 0xff,
              (color >>> 8) & 0xff,
              color & 0xff
            );
          } else if (mode === 1) {
            // 调色板
            if (color >= 16) {
              sgrSeq.push(38, 5, color);
            } else {
              sgrSeq.push(color & 8 ? 90 + (color & 7) : 30 + (color & 7));
            }
          } else {
            sgrSeq.push(39);
          }
        }
        if (bgChanged) {
          const color = cell.getBgColor();
          const mode = cell.getBgColorMode();
          if (mode === 2 || mode === 3 || mode === -1) {
            sgrSeq.push(
              48,
              2,
              (color >>> 16) & 0xff,
              (color >>> 8) & 0xff,
              color & 0xff
            );
          } else if (mode === 1) {
            // 调色板
            if (color >= 16) {
              sgrSeq.push(48, 5, color);
            } else {
              sgrSeq.push(color & 8 ? 100 + (color & 7) : 40 + (color & 7));
            }
          } else {
            sgrSeq.push(49);
          }
        }
      }
    }

    return sgrSeq;
  }

  private _isAttributeDefault(cell: IBufferCell): boolean {
    const mode = cell.getFgColorMode();
    const bgMode = cell.getBgColorMode();

    if (mode === 0 && bgMode === 0) {
      return (
        !cell.isBold() &&
        !cell.isItalic() &&
        !cell.isUnderline() &&
        !cell.isBlink() &&
        !cell.isInverse() &&
        !cell.isInvisible() &&
        !cell.isDim() &&
        !cell.isStrikethrough()
      );
    }

    const fgColor = cell.getFgColor();
    const bgColor = cell.getBgColor();
    const nullCell = this._buffer.getNullCell();
    const nullFg = nullCell.getFgColor();
    const nullBg = nullCell.getBgColor();

    return (
      fgColor === nullFg &&
      bgColor === nullBg &&
      !cell.isBold() &&
      !cell.isItalic() &&
      !cell.isUnderline() &&
      !cell.isBlink() &&
      !cell.isInverse() &&
      !cell.isInvisible() &&
      !cell.isDim() &&
      !cell.isStrikethrough()
    );
  }

  protected _nextCell(
    cell: IBufferCell,
    _oldCell: IBufferCell,
    row: number,
    col: number
  ): void {
    const isPlaceHolderCell = cell.getWidth() === 0;

    if (isPlaceHolderCell) {
      return;
    }

    const codepoint = cell.getCode();
    const isInvalidCodepoint =
      codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff);
    const isGarbage =
      isInvalidCodepoint || (codepoint >= 0xf000 && cell.getWidth() === 1);
    const isEmptyCell =
      codepoint === 0 || cell.getChars() === "" || isGarbage;

    const sgrSeq = this._diffStyle(cell, this._cursorStyle);

    const styleChanged = isEmptyCell
      ? !equalBg(this._cursorStyle, cell)
      : sgrSeq.length > 0;

    if (styleChanged) {
      if (this._nullCellCount > 0) {
        this._currentRow += " ".repeat(this._nullCellCount);
        this._nullCellCount = 0;
      }

      this._lastContentCursorRow = row;

      this._currentRow += `\u001b[${sgrSeq.join(";")}m`;

      const line = this._buffer.getLine(row);
      const cellFromLine = line?.getCell(col);
      if (cellFromLine) {
        this._cursorStyle = cellFromLine;
      }
    }

    if (isEmptyCell) {
      this._nullCellCount += cell.getWidth();
    } else {
      if (this._nullCellCount > 0) {
        this._currentRow += " ".repeat(this._nullCellCount);
        this._nullCellCount = 0;
      }

      this._currentRow += cell.getChars();

      this._lastContentCursorRow = row;
    }
  }

  protected _serializeString(excludeFinalCursorPosition?: boolean): string {
    let rowEnd = this._allRows.length;

    if (this._buffer.length - this._firstRow <= this._terminal.rows) {
      rowEnd = this._lastContentCursorRow + 1 - this._firstRow;
    }

    let content = "";

    for (let i = 0; i < rowEnd; i++) {
      content += this._allRows[i];
      if (i + 1 < rowEnd) {
        content += this._allRowSeparators[i];
      }
    }

    if (!excludeFinalCursorPosition) {
      const absoluteCursorRow =
        (this._buffer.baseY ?? 0) + this._buffer.cursorY;
      const cursorRow = constrain(
        absoluteCursorRow - this._firstRow + 1,
        1,
        Number.MAX_SAFE_INTEGER
      );
      const cursorCol = this._buffer.cursorX + 1;
      content += `\u001b[${cursorRow};${cursorCol}H`;
    }

    return content;
  }
}

// ============================================================================
// SerializeAddon 类
// ============================================================================

export class SerializeAddon implements ITerminalAddon {
  private _terminal?: ITerminalCore;

  /**
   * 激活插件（由 Terminal.loadAddon 调用）
   */
  public activate(terminal: ITerminalCore): void {
    this._terminal = terminal;
  }

  /**
   * 释放插件并清理资源
   */
  public dispose(): void {
    this._terminal = undefined;
  }

  /**
   * 将终端行序列化为字符串，可写回终端以恢复状态。
   * 光标也会被定位到正确的单元格。
   *
   * @param options 自定义选项，允许控制序列化内容。
   */
  public serialize(options?: ISerializeOptions): string {
    if (!this._terminal) {
      throw new Error("插件尚未加载，无法使用");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const terminal = this._terminal as any;
    const buffer = terminal.buffer;

    if (!buffer) {
      return "";
    }

    const normalBuffer = buffer.normal || buffer.active;
    const altBuffer = buffer.alternate;

    if (!normalBuffer) {
      return "";
    }

    let content = options?.range
      ? this._serializeBufferByRange(normalBuffer, options.range, true)
      : this._serializeBufferByScrollback(normalBuffer, options?.scrollback);

    if (
      !options?.excludeAltBuffer &&
      buffer.active?.type === "alternate" &&
      altBuffer
    ) {
      const alternateContent = this._serializeBufferByScrollback(
        altBuffer,
        undefined
      );
      content += `\u001b[?1049h\u001b[H${alternateContent}`;
    }

    return content;
  }

  /**
   * 将终端内容序列化为纯文本（无转义序列）
   * @param options 自定义选项，允许控制序列化内容。
   */
  public serializeAsText(options?: {
    scrollback?: number;
    trimWhitespace?: boolean;
  }): string {
    if (!this._terminal) {
      throw new Error("插件尚未加载，无法使用");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const terminal = this._terminal as any;
    const buffer = terminal.buffer;

    if (!buffer) {
      return "";
    }

    const activeBuffer = buffer.active || buffer.normal;
    if (!activeBuffer) {
      return "";
    }

    const maxRows = activeBuffer.length;
    const scrollback = options?.scrollback;
    const correctRows =
      scrollback === undefined
        ? maxRows
        : constrain(scrollback + this._terminal.rows, 0, maxRows);

    const startRow = maxRows - correctRows;
    const endRow = maxRows - 1;
    const lines: string[] = [];

    for (let row = startRow; row <= endRow; row++) {
      const line = activeBuffer.getLine(row);
      if (line) {
        const text = line.translateToString(options?.trimWhitespace ?? true);
        lines.push(text);
      }
    }

    // 如果需要，修剪尾部空行
    if (options?.trimWhitespace) {
      while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
    }

    return lines.join("\n");
  }

  private _serializeBufferByScrollback(
    buffer: IBuffer,
    scrollback?: number
  ): string {
    const maxRows = buffer.length;
    const rows = this._terminal?.rows ?? 24;
    const correctRows =
      scrollback === undefined
        ? maxRows
        : constrain(scrollback + rows, 0, maxRows);
    return this._serializeBufferByRange(
      buffer,
      {
        start: maxRows - correctRows,
        end: maxRows - 1,
      },
      false
    );
  }

  private _serializeBufferByRange(
    buffer: IBuffer,
    range: ISerializeRange,
    excludeFinalCursorPosition: boolean
  ): string {
    const handler = new StringSerializeHandler(buffer, this._terminal!);
    const cols = this._terminal?.cols ?? 80;
    return handler.serialize(
      {
        start: { x: 0, y: range.start },
        end: { x: cols, y: range.end },
      },
      excludeFinalCursorPosition
    );
  }
}
