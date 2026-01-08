/**
 * Markdown 渲染组件
 * 支持 GitHub Flavored Markdown 和代码语法高亮
 * 
 * 性能优化：
 * 1. 代码高亮使用独立的 CodeBlock 组件（内部懒加载）
 * 2. react-syntax-highlighter 是最大的依赖，懒加载它
 */

import { memo, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

// 懒加载代码块组件（包含 react-syntax-highlighter）
const CodeBlock = lazy(() => import("./CodeBlock"));

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 内联代码组件
 */
function InlineCode({ children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm"
      {...props}
    >
      {children}
    </code>
  );
}

/**
 * 代码块渲染适配器
 */
function CodeRenderer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  // 检查是否是代码块（有语言标识）
  const match = /language-(\w+)/.exec(className || "");
  const codeContent = String(children).replace(/\n$/, "");

  // 判断是否是内联代码（没有语言标识且不包含换行符）
  const isInline = !match && !codeContent.includes("\n");

  if (isInline) {
    return <InlineCode {...props}>{children}</InlineCode>;
  }

  // 代码块使用懒加载的 CodeBlock 组件
  const language = match ? match[1] : "text";

  return (
    <Suspense
      fallback={
        <pre className="rounded-md bg-[#282c34] p-4 overflow-x-auto text-gray-300 text-sm my-2">
          <code>{codeContent}</code>
        </pre>
      }
    >
      <CodeBlock code={codeContent} language={language} />
    </Suspense>
  );
}

/**
 * 自定义 Markdown 组件映射
 */
const markdownComponents: Components = {
  // 代码块渲染
  code: CodeRenderer as Components["code"],

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

/**
 * Markdown 渲染器
 * 支持 GFM（表格、删除线、任务列表等）和代码高亮
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
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
});

export default MarkdownRenderer;
