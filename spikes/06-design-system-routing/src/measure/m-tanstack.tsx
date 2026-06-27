// Isolated bundle probe — TanStack Router's realistic used surface (React externalized).
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // TanStack's typed params: `params` is checked against the path template.
  component: () => <Link to="/accounts/$id" params={{ id: "chk" }}>chk</Link>,
});
const acctRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/accounts/$id",
  component: () => null,
});
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, acctRoute]) });

export function M() {
  return <RouterProvider router={router} />;
}
