import { type ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import styles from "./Dialog.module.css";

/**
 * Modal dialog primitive (FEAT-UX4, grown for UX7 — the first genuine modal). Built on
 * `@radix-ui/react-dialog` per ADR-0005 (Radix for the hard a11y widgets; SPIKE-06 validated the
 * Radix dialog axe-clean in light AND dark). Radix supplies the contract the brief flagged as the
 * risk: `role="dialog"` + `aria-modal`, a focus trap, ESC / overlay-click to close, and focus
 * RESTORE to the trigger on close.
 *
 * Controlled "always open while the route is mounted": the modal is route-driven (`/transactions/new`),
 * so `open` is hard-true and any dismissal (ESC, overlay, the × close) calls `onClose` — the route
 * component navigates back. The accessible NAME comes from `<Dialog.Title>` (Radix wires
 * `aria-labelledby`); when no `description` is given we pass `aria-describedby={undefined}` so Radix
 * does not warn about a missing description.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          // No description → tell Radix explicitly so it doesn't warn; with one, Radix wires
          // aria-describedby from <Dialog.Description> itself.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          ) : null}
          {children}
          <RadixDialog.Close asChild>
            <button type="button" className={styles.close} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
