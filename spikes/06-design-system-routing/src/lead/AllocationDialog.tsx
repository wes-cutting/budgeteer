// Axis C, option 1 — the allocation editor as a React Aria Components Dialog.
// React Aria handles: focus trap, Esc-to-close, focus restore, aria-modal, labelling via <Heading>.
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";
import { ENVELOPES, formatCents, type Txn } from "../data";
import styles from "./register.module.css";

export function AllocationDialog({ txn, defaultOpen = false }: { txn: Txn; defaultOpen?: boolean }) {
  return (
    <DialogTrigger defaultOpen={defaultOpen}>
      <Button className={styles.btn}>Edit split</Button>
      <ModalOverlay className={styles.overlay} isDismissable>
        <Modal className={styles.modal}>
          <Dialog className={styles.dialog}>
            {({ close }) => (
              <>
                <Heading slot="title" className={styles.dialogHeading}>
                  Edit split — {txn.payee} ({formatCents(txn.amountCents)})
                </Heading>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    close();
                  }}
                >
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
                    <Button className={styles.btn} onPress={close}>
                      Cancel
                    </Button>
                    <Button type="submit" className={`${styles.btn} ${styles.btnAccent}`}>
                      Save split
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
