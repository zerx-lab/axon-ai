import { Outlet, createRootRoute } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { RootLayout } from "@/components/layout/RootLayout";

// 是否显示 TanStack Router DevTools（开发时按需启用）
// const SHOW_ROUTER_DEVTOOLS = false;

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootLayout>
      <Outlet />
      {/* 暂时禁用 DevTools，需要时取消注释即可
      {import.meta.env.DEV && SHOW_ROUTER_DEVTOOLS && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
      */}
    </RootLayout>
  );
}
