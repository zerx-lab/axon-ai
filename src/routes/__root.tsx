import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { RootLayout } from "@/components/layout/RootLayout";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootLayout>
      <Outlet />
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </RootLayout>
  );
}
