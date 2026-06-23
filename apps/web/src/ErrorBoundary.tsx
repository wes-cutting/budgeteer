import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * R12 — a single reusable error boundary. React error boundaries are class components that
 * catch errors thrown during the **render / lifecycle of their descendants** — NOT event
 * handlers, NOT async/promise rejections (those already surface via each view's own `loadError`
 * state). Its job is narrow and real: a render-time throw (a malformed shape that throws
 * mid-`.map()`, an undefined access during a derived-data calc) would otherwise unmount the whole
 * React tree to a blank screen, because `main.tsx` renders `<App/>` directly.
 *
 * Placed twice: once at the top level wrapping `<App>` (never blank-screen the whole app; recovery
 * = reload) and once per active analysis view inside `AnalysisSection` (localized recovery — the
 * sub-nav stays usable; recovery = back to the Dashboard). `key=` on the boundary makes the parent
 * reset it (e.g. `key={tab}` so switching tabs mounts a fresh, error-free boundary).
 *
 * The fallback is a semantic, high-contrast panel: a `<main>` landmark, an `<h1>`, a `role="alert"`
 * live region announcing the failure, and a real recovery `<button>` (WCAG 2.2 AA).
 */
type Props = {
  children: ReactNode;
  /** Label for the recovery button. Defaults to "Reload" (the top-level full-page recovery). */
  resetLabel?: string;
  /** Recovery action run after the boundary clears its error (e.g. navigate away). Defaults to a
   *  full-page reload when omitted. */
  onReset?: () => void;
};

type State = { error: Error | null };

// An emergency surface that must stay readable no matter the page's color scheme — the rest of the
// app inherits the browser default (a light canvas), but a render crash can happen under any
// `prefers-color-scheme`, so the fallback pins its own high-contrast colors (#1a1a1a on #fff,
// ~16:1) rather than inheriting. The dark-red border signals "error" as a supplement to the
// heading text, never as the sole cue.
const PANEL: React.CSSProperties = {
  maxWidth: "40rem",
  margin: "2rem auto",
  padding: "1.5rem",
  border: "2px solid #991b1b",
  borderRadius: "0.5rem",
  background: "#fff",
  color: "#1a1a1a",
  // Pin the subtree to light-mode UA rendering so the native recovery <button> keeps dark-on-light
  // contrast on the white card even when the browser is in dark mode.
  colorScheme: "light",
};

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for diagnosis. Structured server-side logging is R13's concern; the
    // browser console is the right sink for a client render crash.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
    else window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <main>
          <div role="alert" style={PANEL}>
            <h1>Something went wrong</h1>
            <p>
              This view hit an unexpected error and couldn&rsquo;t be displayed. Your data is safe
              &mdash; nothing was changed.
            </p>
            <button type="button" onClick={this.handleReset}>
              {this.props.resetLabel ?? "Reload"}
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
