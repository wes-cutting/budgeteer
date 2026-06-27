import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/tokens.css";
import "./ui/base.css";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { httpApi } from "./api";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

// R12 — a render-only crash hook for the e2e error-boundary test. Gated on `import.meta.env.DEV`,
// so `vite build` constant-folds it to `false` and tree-shakes `CrashOnRender` out of the
// production bundle (the gate's build step is the proof). It throws during render, which is
// exactly the failure the top-level ErrorBoundary exists to catch.
function CrashOnRender(): never {
  throw new Error("Intentional render crash (dev-only e2e hook)");
}
const crashForTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has("boom");

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>{crashForTest ? <CrashOnRender /> : <App api={httpApi} />}</ErrorBoundary>
  </StrictMode>,
);
