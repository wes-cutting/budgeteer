import { useEffect, useState } from "react";
import { type Api, type EnvelopeView } from "./api";
import { EnvelopeLedger } from "./EnvelopeLedger";

/**
 * UX3 — route adapter for `/envelopes/:id`. The `EnvelopeLedger` needs the full envelope (name,
 * kind, balance, archived state), but a deep link / refresh carries only the id. This resolves the
 * id against the envelope list (no per-id endpoint exists) so the ledger is refresh-safe, then
 * renders the unchanged `EnvelopeLedger`.
 */
export function EnvelopeLedgerRoute({ api, envelopeId }: { api: Api; envelopeId: string }) {
  // undefined = loading · null = not found · EnvelopeView = resolved
  const [envelope, setEnvelope] = useState<EnvelopeView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    api
      .listEnvelopes()
      .then((envs) => {
        if (active) setEnvelope(envs.find((e) => e.id === envelopeId) ?? null);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn't load the envelope.");
      });
    return () => {
      active = false;
    };
  }, [api, envelopeId]);

  if (error) {
    return (
      <main>
        <h1>Envelope</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (envelope === undefined) {
    return (
      <main>
        <h1>Envelope</h1>
        <p>Loading…</p>
      </main>
    );
  }
  if (envelope === null) {
    return (
      <main>
        <h1>Envelope not found</h1>
        <p>That envelope doesn&rsquo;t exist.</p>
      </main>
    );
  }
  return <EnvelopeLedger api={api} envelope={envelope} />;
}
