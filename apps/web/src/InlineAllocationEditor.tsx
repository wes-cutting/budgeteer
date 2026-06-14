import {
  type AllocationDraft,
  type EnvelopeView,
  type TemplateView,
  type TransactionView,
} from "./api";
import { centsToInput } from "./format";
import { AllocationEditor } from "./AllocationEditor";

interface Props {
  /** The transaction being allocated; supplies the magnitude and current allocations. */
  txn: TransactionView;
  envelopes: EnvelopeView[];
  templates: TemplateView[];
  /** Whether this row's editor is expanded. Parent-owned so only one opens at a time. */
  open: boolean;
  /** Whether a save for this row is in flight. */
  submitting: boolean;
  /** Toggle-button text (also its accessible name): "Edit split" / "Allocate". */
  toggleLabel: string;
  /** Save-button text inside the editor: "Save split" / "Save allocation". */
  saveLabel: string;
  onToggle: () => void;
  onSave: (allocations: AllocationDraft[]) => void;
}

/**
 * The per-row "expand to edit a transaction's allocations" control shared by the register
 * (Edit split) and Needs-allocation (Allocate). Owns the toggle button and pre-fills the
 * AllocationEditor from the transaction's current allocations (archived envelopes filtered out);
 * open/submitting state stays with the parent list so only one editor is open at a time.
 */
export function InlineAllocationEditor({
  txn,
  envelopes,
  templates,
  open,
  submitting,
  toggleLabel,
  saveLabel,
  onToggle,
  onSave,
}: Props) {
  return (
    <>
      <button type="button" onClick={onToggle}>
        {toggleLabel}
      </button>
      {open ? (
        <AllocationEditor
          magnitudeCents={Math.abs(txn.amountCents)}
          envelopes={envelopes
            .filter((e) => e.archivedAt === null)
            .map((e) => ({ id: e.id, name: e.name }))}
          templates={templates}
          initial={txn.allocations.map((a) => ({
            envelopeId: a.envelopeId,
            amount: centsToInput(Math.abs(a.amountCents)),
            // A row whose sign opposes the transaction's direction is a refund (FEAT-008).
            refund: txn.amountCents < 0 ? a.amountCents > 0 : a.amountCents < 0,
          }))}
          submitting={submitting}
          saveLabel={saveLabel}
          onSave={onSave}
        />
      ) : null}
    </>
  );
}
