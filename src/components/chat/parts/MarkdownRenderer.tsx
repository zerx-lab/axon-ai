/**
 * Markdown 渲染组件
 * 支持 GitHub Flavored Markdown 和代码语法高亮
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown 渲染器
 * 支持 GFM（表格、删除线、任务列表等）和代码高亮
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        // 自定义样式覆盖
        "prose-p:my-2 prose-p:leading-relaxed",
        "prose-pre:p-0 prose-pre:bg-transparent",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-headings:mt-4 prose-headings:mb-2",
        "prose-ul:my-2 prose-ol:my-2",
        "prose-li:my-0.5",
        "prose-blockquote:my-2 prose-blockquote:border-l-primary",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-table:my-2",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * 自定义 Markdown 组件映射
 */
const markdownComponents: Components = {
  // 代码块渲染
  code({ className, children, ...props }) {
    // 检查是否是代码块（有语言标识）
    const match = /language-(\w+)/.exec(className || "");
    const codeContent = String(children).replace(/\n$/, "");
    
    // 判断是否是内联代码（没有语言标识且不包含换行符）
    const isInline = !match && !codeContent.includes("\n");
    
    if (isInline) {
      // 内联代码
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm"
          {...props}
        >
          {children}
        </code>
      );
    }

    // 代码块
    const language = match ? match[1] : "text";
    
    return (
      <div className="relative group my-2">
        {/* 语言标签 */}
        {match && (
          <div className="absolute right-2 top-2 text-xs text-muted-foreground opacity-70 z-10">
            {language}
          </div>
        )}
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: "0.375rem",
            fontSize: "0.8125rem",
            lineHeight: "1.5",
          }}
          codeTagProps={{
            style: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    );
  },

  // 预格式化文本
  pre({ children }) {
    // 直接返回 children，因为代码块渲染在 code 组件中处理
    return <>{children}</>;
  },

  // 链接 - 在新窗口打开
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
        {...props}
      >
        {children}
      </a>
    );
  },

  // 表格样式增强
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse border border-border">
          {children}
        </table>
      </div>
    );
  },

  th({ children }) {
    return (
      <th className="border border-border bg-muted px-3 py-2 text-left font-medium">
        {children}
      </th>
    );
  },

  td({ children }) {
    return (
      <td className="border border-border px-3 py-2">
        {children}
      </td>
    );
  },

  // 任务列表项
  li({ children, className, ...props }) {
    // 检查是否是任务列表项（GFM task list）
    const isTaskListItem = className?.includes("task-list-item");
    
    if (isTaskListItem) {
      return (
        <li className="flex items-start gap-2 list-none" {...props}>
          {children}
        </li>
      );
    }
    
    return <li {...props}>{children}</li>;
  },

  // 复选框样式
  input({ type, checked, ...props }) {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mt-1 h-4 w-4 rounded border-border"
          {...props}
        />
      );
    }
    return <input type={type} {...props} />;
  },

  // 引用块样式
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
        {children}
      </blockquote>
    );
  },

  // 水平分割线
  hr() {
    return <hr className="my-4 border-border" />;
  },
};

export default MarkdownRenderer;
