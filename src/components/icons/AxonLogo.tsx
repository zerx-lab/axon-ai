/**
 * Axon Logo 组件
 * 神经元节点 + 字母 A 融合设计
 */

import { cn } from "@/lib/utils";

interface AxonLogoProps {
  className?: string;
  size?: number;
}

export function AxonLogo({ className, size = 20 }: AxonLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <defs>
        {/* 主渐变：增加层次感 */}
        <linearGradient id="axonMainGradient" x1="64" y1="16" x2="64" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6"/>
        </linearGradient>

        {/* 节点发光效果 */}
        <filter id="axonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 左主线 - 从顶点到左下节点 */}
      <path
        d="M64 28 L28 100"
        stroke="url(#axonMainGradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* 右主线 - 从顶点到右下节点 */}
      <path
        d="M64 28 L100 100"
        stroke="url(#axonMainGradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* 横线左段 - 带断口 */}
      <path
        d="M40 76 L56 76"
        stroke="url(#axonMainGradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* 横线右段 - 带断口 */}
      <path
        d="M72 76 L88 76"
        stroke="url(#axonMainGradient)"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* 顶部主节点 - 较大，视觉焦点 */}
      <circle
        cx="64"
        cy="24"
        r="10"
        fill="currentColor"
        filter="url(#axonGlow)"
      />

      {/* 左下节点 */}
      <circle
        cx="26"
        cy="104"
        r="7"
        fill="currentColor"
        opacity="0.7"
      />

      {/* 右下节点 */}
      <circle
        cx="102"
        cy="104"
        r="7"
        fill="currentColor"
        opacity="0.7"
      />

      {/* 中心断口装饰 - 小菱形，代表信号/数据流 */}
      <rect
        x="60"
        y="72"
        width="8"
        height="8"
        rx="1"
        fill="currentColor"
        transform="rotate(45 64 76)"
      />
    </svg>
  );
}
