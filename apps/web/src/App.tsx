import { useMemo } from "react";
import { RouterProvider } from "react-router";
import { type Api } from "./api";
import { ApiProvider } from "./api-context";
import { createAppRouter } from "./routes";

/**
 * UX3 — the app is a React Router data router behind a persistent shell (ADR-0006), replacing the
 * old hand-rolled `view` state machine. `api` is injected once (tests pass a fake) and provided via
 * context so route elements can reach it; the router elements reference `useApi()` rather than
 * closing over `api`, so the router is created once.
 */
export function App({ api }: { api: Api }) {
  const router = useMemo(() => createAppRouter(), []);
  return (
    <ApiProvider value={api}>
      <RouterProvider router={router} />
    </ApiProvider>
  );
}
