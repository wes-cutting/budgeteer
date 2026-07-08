import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { type AccountView, type Api, type EnvelopeView, type TemplateView } from "./api";
import { AddTransactionForm } from "./AddTransactionForm";
import { Alert, Dialog, Skeleton, useToast } from "./ui";

/**
 * UX7 — the global quick-add transaction, mounted as a MODAL ROUTE at `/transactions/new` so PRD
 * journey #1 (the common case) is no longer buried behind opening an account register. It REUSES the
 * register's editor stack (`AddTransactionForm` → `AllocationEditor`) in its account-picker mode —
 * the only new thing the global entry needs is choosing WHICH account to post to.
 *
 * The modal is the `Dialog` primitive (Radix; ADR-0005) → focus trap, ESC / overlay close,
 * return-focus, `role="dialog"`. On save (or dismiss) we navigate back to "where you were"; a partial
 * allocation is allowed and its remainder surfaces in needs-allocation exactly as the register's does
 * (the same `createTransaction` fan-out — no new endpoint). Reads degrade per-state (loading / error /
 * no-accounts) so the modal never opens onto a dead form.
 */
export function QuickAddTransaction({ api }: { api: Api }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  // Return to where you were. A direct deep-link (no prior in-app entry) has key "default" → there is
  // nothing to pop, so fall back to the home rather than leaving the app.
  const close = useCallback(() => {
    if (location.key === "default") navigate("/");
    else navigate(-1);
  }, [navigate, location.key]);

  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeView[]>([]);
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.listAccounts(), api.listEnvelopes(), api.listTemplates()])
      .then(([accts, envs, tpls]) => {
        if (!active) return;
        setAccounts(accts.filter((a) => a.archivedAt === null));
        setEnvelopes(envs);
        setTemplates(tpls);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the form.");
      });
    return () => {
      active = false;
    };
  }, [api]);

  return (
    <Dialog
      title="Add a transaction"
      description="Pick an account, enter the amount, then allocate it across your envelopes."
      onClose={close}
    >
      {error ? (
        <Alert>{error}</Alert>
      ) : accounts === null ? (
        <Skeleton rows={4} />
      ) : accounts.length === 0 ? (
        <p>
          You need an account first. <Link to="/accounts">Add an account</Link> to record a
          transaction.
        </p>
      ) : (
        <AddTransactionForm
          api={api}
          accounts={accounts}
          envelopes={envelopes}
          templates={templates}
          onCreated={() => {
            showToast("Transaction added");
            close();
          }}
        />
      )}
    </Dialog>
  );
}
