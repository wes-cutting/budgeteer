import { useMemo } from "react";
import { RouterProvider } from "react-router";
import { type Api } from "./api";
import { ApiProvider } from "./api-context";
import { createAppRouter } from "./routes";
import { ToastProvider } from "./ui";

/**
 * UX3 — the app is a React Router data router behind a persistent shell (ADR-0006), replacing the
 * old hand-rolled `view` state machine. `api` is injected once (tests pass a fake) and provided via
 * context so route elements can reach it; the router elements reference `useApi()` rather than
 * closing over `api`, so the router is created once.
 *
 * UX12c — `ToastProvider` wraps the router (not a route) so success toasts survive navigation: the
 * global quick-add navigates away on save, and the toast lives at the app root above it.
 */
export function App({ api }: { api: Api }) {
  const router = useMemo(() => createAppRouter(), []);
  return (
    <ApiProvider value={api}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ApiProvider>
  );
}
