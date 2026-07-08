import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as RadixToast from "@radix-ui/react-toast";
import styles from "./Toast.module.css";

/**
 * Success-feedback toast (FEAT-UX12c — the last UX12 thread). Built on `@radix-ui/react-toast` per
 * ADR-0005 (Radix reserved for the hard a11y widgets — toast is one), so it inherits the announce
 * contract: Radix renders each toast `role="status"` and mirrors it into a polite live region
 * (`aria-live="polite"` — we use `type="background"`, NEVER foreground/`role="alert"`, so a routine
 * success confirmation announces without interrupting the screen-reader user). It auto-dismisses
 * (5s) and carries an explicit Dismiss button plus Radix's swipe/ESC.
 *
 * A11y motion: the entrance is TRANSFORM-only (a slide, in Toast.module.css) — no text-opacity
 * animation (that tripped the UX3 route-fade contrast gate) — and the global
 * `prefers-reduced-motion` reset in base.css zeroes it, so it is reduced-motion-safe. The state is
 * carried by the message TEXT, never colour.
 */
type ToastItem = { id: number; message: string };
type ToastApi = { showToast: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

const NOOP: ToastApi = { showToast: () => {} };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((cur) => [...cur, { id, message }]);
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((t) => (
          <RadixToast.Root
            key={t.id}
            type="background"
            className={styles.toast}
            onOpenChange={(open) => {
              if (!open) setToasts((cur) => cur.filter((x) => x.id !== t.id));
            }}
          >
            <RadixToast.Title className={styles.title}>{t.message}</RadixToast.Title>
            <RadixToast.Close className={styles.close} aria-label="Dismiss">
              <span aria-hidden="true">×</span>
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} label="Notifications" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

/**
 * A toast is an AUXILIARY success affordance: rendered without a `ToastProvider` (e.g. a view
 * mounted in isolation by a unit test), `showToast` is a silent no-op rather than a throw — mirroring
 * the "auxiliary UI degrades rather than breaks" pattern used elsewhere (e.g. the shell's
 * needs-allocation badge). Wrap a component in `<ToastProvider>` when a test needs to assert the toast.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}
