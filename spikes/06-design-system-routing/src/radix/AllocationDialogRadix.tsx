// Axis C, option 2 — the allocation editor as a Radix Primitives Dialog.
// Radix handles focus trap, Esc, focus restore, aria-modal, labelling via Title/Description.
import * as Dialog from "@radix-ui/react-dialog";
import { ENVELOPES, formatCents, type Txn } from "../data";
import styles from "../lead/register.module.css";

export function AllocationDialogRadix({ txn, defaultOpen = false }: { txn: Txn; defaultOpen?: boolean }) {
  return (
    <Dialog.Root defaultOpen={defaultOpen}>
      <Dialog.Trigger className={styles.btn}>Edit split</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.radixContent}>
          <Dialog.Title className={styles.dialogHeading}>
            Edit split — {txn.payee} ({formatCents(txn.amountCents)})
          </Dialog.Title>
          <Dialog.Description className={styles.label}>
            Split this transaction across one or more envelopes.
          </Dialog.Description>
          <form onSubmit={(e) => e.preventDefault()}>
            {[0, 1].map((i) => (
              <div key={i} className={styles.allocRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Envelope</span>
                  <select className={styles.input} defaultValue={ENVELOPES[i].id}>
                    {ENVELOPES.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Amount</span>
                  <input className={styles.input} type="text" defaultValue="0.00" inputMode="decimal" />
                </label>
              </div>
            ))}
            <div className={styles.dialogActions}>
              <Dialog.Close className={styles.btn}>Cancel</Dialog.Close>
              <button type="submit" className={`${styles.btn} ${styles.btnAccent}`}>
                Save split
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
