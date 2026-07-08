import * as RadixDialog from "@radix-ui/react-dialog";
import { Button } from "./Button";
import styles from "./Dialog.module.css";

/**
 * Destructive-action confirmation (FEAT-UX12). A *controlled, transient* modal — unlike the
 * route-driven {@link Dialog} (which is hard-`open` while its route is mounted), this one opens on
 * demand (a row's Archive/Delete click) and closes on confirm or cancel. Built on the same
 * `@radix-ui/react-dialog` primitive per ADR-0005, so it inherits the validated a11y contract
 * (SPIKE-06, axe-clean light + dark): `role="dialog"` + `aria-modal`, a focus trap, ESC / overlay
 * dismissal, and focus RESTORE to the trigger on close. No entrance animation is defined (see
 * Dialog.module.css), so it is reduced-motion-safe by construction.
 *
 * The state carried by the confirm button is its **text label** (`confirmLabel`), never colour: the
 * `danger` variant is emphasis, but the action word ("Archive" / "Delete") and the title/description
 * name the action independently. Radix auto-focuses the first tabbable element — Cancel is first in
 * DOM order, so the safe choice is focused by default on a destructive prompt.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        // Any dismissal (ESC, overlay-click) is a cancel; confirm is the explicit button only.
        if (!next) onCancel();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          ) : null}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
