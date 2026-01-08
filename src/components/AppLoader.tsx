/**
 * 应用加载状态组件
 * 
 * 简化版本：直接显示主界面，下载/启动等状态在标题栏 ServiceStatus 中展示
 * 不再阻塞主界面加载
 */

import type { ReactNode } from "react";

interface AppLoaderProps {
  children: ReactNode;
}

/**
 * AppLoader 组件
 * 
 * 直接渲染子组件，不再显示全屏 loading
 * 下载进度等状态由标题栏的 ServiceStatus 组件负责展示
 */
export function AppLoader({ children }: AppLoaderProps) {
  // 直接显示主界面，不再阻塞
  // 下载、启动等状态在右上角 ServiceStatus 组件中展示
  return <>{children}</>;
}
