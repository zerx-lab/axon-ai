/**
 * 环形进度条组件
 *
 * 参考 OpenCode 的设计，用于显示上下文使用百分比
 * 特点：
 * - 紧凑的环形设计
 * - 支持自定义大小和线宽
 * - 平滑的进度动画
 */

import { cn } from "@/lib/utils";

export interface ProgressCircleProps {
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 圆形大小 (默认 16px) */
  size?: number;
  /** 线条宽度 (默认 2px) */
  strokeWidth?: number;
  /** 自定义类名 */
  className?: string;
  /** 进度条颜色 (默认使用 primary) */
  progressColor?: string;
  /** 背景轨道颜色 */
  trackColor?: string;
}

export function ProgressCircle({
  percentage,
  size = 16,
  strokeWidth = 2,
  className,
  progressColor,
  trackColor,
}: ProgressCircleProps) {
  // 固定 viewBox 大小为 16，通过 width/height 缩放
  const viewBoxSize = 16;
  const center = viewBoxSize / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  // 计算偏移量（用于显示进度）
  const clampedPercentage = Math.max(0, Math.min(100, percentage || 0));
  const offset = circumference * (1 - clampedPercentage / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      fill="none"
      className={cn("transform -rotate-90", className)}
      aria-label={`${Math.round(clampedPercentage)}% 使用量`}
      role="progressbar"
      aria-valuenow={clampedPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* 背景轨道 */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={strokeWidth}
        className={cn(!trackColor && "stroke-muted-foreground/20")}
        style={trackColor ? { stroke: trackColor } : undefined}
        fill="none"
      />
      {/* 进度弧 */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={cn(
          "transition-[stroke-dashoffset] duration-300 ease-out",
          !progressColor && "stroke-primary"
        )}
        style={progressColor ? { stroke: progressColor } : undefined}
        fill="none"
      />
    </svg>
  );
}
