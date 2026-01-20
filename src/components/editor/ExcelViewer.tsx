/**
 * Excel 预览组件
 * 
 * 基于 SheetJS 实现的 Excel 文档预览器
 * 支持：多 Sheet 切换、虚拟滚动、搜索筛选、导出
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Download,
  FileSpreadsheet,
  Loader2,
  FileX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

// 动态导入 xlsx 以减少初始加载
let XLSX: any = null;

interface ExcelViewerProps {
  path: string;
  data: ArrayBuffer | string; // Base64 或 ArrayBuffer
  maxRows?: number; // 每页最大行数
  onError?: (error: string) => void;
}

interface SheetData {
  name: string;
  data: any[][];
  headers: string[];
  rowCount: number;
  colCount: number;
}

interface WorkbookData {
  sheets: SheetData[];
  activeSheet: number;
}

// 每页默认行数
const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500];

// 列宽度计算
function calculateColumnWidth(header: string, data: any[]): number {
  const maxLength = Math.max(
    header.length,
    ...data.slice(0, 100).map(row => String(row || "").length)
  );
  return Math.min(Math.max(maxLength * 8, 60), 300); // 最小60px，最大300px
}

export function ExcelViewer({ 
  data, 
  maxRows = DEFAULT_PAGE_SIZE,
  onError 
}: Omit<ExcelViewerProps, 'path'>) {
  // 工作簿数据
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  // 当前显示的 Sheet
  const [currentSheet, setCurrentSheet] = useState(0);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(maxRows);
  
  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredData, setFilteredData] = useState<any[][]>([]);
  
  // 虚拟滚动容器
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 加载 XLSX 库
  useEffect(() => {
    const loadXLSX = async () => {
      if (!XLSX) {
        try {
          // @ts-ignore
          const module = await import("xlsx");
          XLSX = module.default || module;
        } catch (err) {
          setError("无法加载 Excel 处理库");
          onError?.("无法加载 Excel 处理库");
        }
      }
    };
    loadXLSX();
  }, [onError]);
  
  // 解析 Excel 文件
  useEffect(() => {
    const parseExcel = async () => {
      if (!XLSX || !data) return;
      
      try {
        setIsLoading(true);
        setError("");
        
        // 处理数据格式
        let workbookData: ArrayBuffer;
        if (typeof data === "string") {
          // Base64 字符串
          const base64 = data.replace(/^data:.*?;base64,/, "");
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          workbookData = bytes.buffer;
        } else {
          workbookData = data;
        }
        
        // 读取工作簿
        const wb = XLSX.read(workbookData, { type: "array", cellDates: true });
        
        // 解析所有 Sheet
        const sheets: SheetData[] = wb.SheetNames.map((name: string) => {
          const sheet = wb.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { 
            header: 1, 
            defval: "",
            blankrows: false 
          });
          
          // 获取表头和数据
          const headers = jsonData[0] as string[] || [];
          const rows = jsonData.slice(1) as any[][];
          
          // 确保所有行具有相同的列数
          const colCount = headers.length;
          const normalizedRows = rows.map(row => {
            const normalized = [...row];
            while (normalized.length < colCount) {
              normalized.push("");
            }
            return normalized.slice(0, colCount);
          });
          
          return {
            name,
            headers: headers.map((h, i) => h || `列${i + 1}`),
            data: normalizedRows,
            rowCount: normalizedRows.length,
            colCount,
          };
        });
        
        setWorkbook({
          sheets,
          activeSheet: 0,
        });
        setCurrentSheet(0);
        setCurrentPage(1);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Excel 解析失败";
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };
    
    parseExcel();
  }, [data, onError]);
  
  // 获取当前 Sheet 数据
  const currentSheetData = useMemo(() => {
    if (!workbook || currentSheet >= workbook.sheets.length) {
      return null;
    }
    return workbook.sheets[currentSheet];
  }, [workbook, currentSheet]);
  
  // 筛选数据
  useEffect(() => {
    if (!currentSheetData) {
      setFilteredData([]);
      return;
    }
    
    if (!searchQuery) {
      setFilteredData(currentSheetData.data);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = currentSheetData.data.filter(row =>
      row.some(cell => String(cell || "").toLowerCase().includes(query))
    );
    
    setFilteredData(filtered);
    setCurrentPage(1); // 重置到第一页
  }, [currentSheetData, searchQuery]);
  
  // 计算分页数据
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);
  
  // 计算总页数
  const totalPages = Math.ceil(filteredData.length / pageSize);
  
  // 切换 Sheet
  const handleSheetChange = useCallback((sheetIndex: string) => {
    const index = parseInt(sheetIndex, 10);
    setCurrentSheet(index);
    setCurrentPage(1);
    setSearchQuery("");
  }, []);
  
  // 分页控制
  const goToFirstPage = useCallback(() => setCurrentPage(1), []);
  const goToLastPage = useCallback(() => setCurrentPage(totalPages), [totalPages]);
  const goToPreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);
  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  }, [totalPages]);
  
  // 导出功能
  const exportAsCSV = useCallback(() => {
    if (!currentSheetData || !XLSX) return;
    
    const ws = XLSX.utils.aoa_to_sheet([
      currentSheetData.headers,
      ...currentSheetData.data
    ]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    // 创建下载链接
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentSheetData.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [currentSheetData]);
  
  const exportAsJSON = useCallback(() => {
    if (!currentSheetData) return;
    
    const jsonData = currentSheetData.data.map(row => {
      const obj: any = {};
      currentSheetData.headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });
    
    const json = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentSheetData.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [currentSheetData]);
  
  // 页面大小改变
  const handlePageSizeChange = useCallback((value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);
  
  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // 错误状态
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileX className="h-12 w-12 opacity-50" />
        <span className="text-sm font-medium">Excel 加载失败</span>
        <span className="text-xs opacity-70">{error}</span>
      </div>
    );
  }
  
  // 无数据状态
  if (!currentSheetData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileSpreadsheet className="h-12 w-12 opacity-50" />
        <span className="text-sm">无数据</span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background">
      {/* 工具栏 */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 bg-muted/10 px-3">
        {/* 左侧：Sheet 选择 */}
        <div className="flex items-center gap-3">
          <Select value={String(currentSheet)} onValueChange={handleSheetChange}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workbook?.sheets.map((sheet, index) => (
                <SelectItem key={index} value={String(index)}>
                  {sheet.name} ({sheet.rowCount} 行 × {sheet.colCount} 列)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <span className="text-xs text-muted-foreground">
            共 {filteredData.length} 行
            {searchQuery && ` (已筛选)`}
          </span>
        </div>
        
        {/* 中间：搜索框 */}
        <div className="flex items-center gap-2 flex-1 max-w-md mx-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索内容..."
              className="h-8 pl-8"
            />
          </div>
        </div>
        
        {/* 右侧：导出按钮 */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={exportAsCSV}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </TooltipTrigger>
            <TooltipContent>导出为 CSV</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={exportAsJSON}
              >
                <Download className="h-4 w-4 mr-1" />
                JSON
              </Button>
            </TooltipTrigger>
            <TooltipContent>导出为 JSON</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* 表格内容 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-12 text-center bg-muted/50">#</TableHead>
              {currentSheetData.headers.map((header, index) => (
                <TableHead
                  key={index}
                  className="bg-muted/50"
                  style={{ minWidth: calculateColumnWidth(header, currentSheetData.data.map(row => row[index])) }}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={currentSheetData.headers.length + 1}
                  className="text-center text-muted-foreground py-8"
                >
                  {searchQuery ? "没有找到匹配的数据" : "表格为空"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => {
                const actualRowIndex = (currentPage - 1) * pageSize + rowIndex + 1;
                return (
                  <TableRow key={rowIndex} className="hover:bg-muted/30">
                    <TableCell className="w-12 text-center text-muted-foreground text-xs">
                      {actualRowIndex}
                    </TableCell>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="text-sm">
                        {cell !== null && cell !== undefined ? String(cell) : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex h-10 items-center justify-between border-t border-border/60 bg-muted/10 px-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">每页显示</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-7 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(size => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">行</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>第一页</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上一页</TooltipContent>
            </Tooltip>
            
            <span className="text-xs text-muted-foreground px-2">
              第 {currentPage} / {totalPages} 页
            </span>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下一页</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>最后一页</TooltipContent>
            </Tooltip>
          </div>
          
          <div className="text-xs text-muted-foreground">
            显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredData.length)} 行
          </div>
        </div>
      )}
    </div>
  );
}