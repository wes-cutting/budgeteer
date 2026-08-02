import { useEffect, useState } from "react";
import type { Api } from "./api";

/** `"loading"` until the probe answers — neither auth page may render or redirect before then. */
export type NeedsSetupState = "loading" | "yes" | "no";

/**
 * BUD-S92 — "does this install still have no user?", shared by the two standalone auth pages:
 * `/login` sends you to `/setup` while it is `"yes"`, and `/setup` sends you to `/login` once it is
 * `"no"`. Neither page is a dead end, and the same one probe decides both.
 *
 * A FAILED probe resolves to `"no"`, deliberately, and this is the only place that choice is made.
 * Treating an unreachable API as "needs setup" would let a transient blip invite a stranger to
 * claim an instance that already belongs to someone; treating it as "already set up" merely lands
 * them on `/login`, where the existing error path can speak for itself. The failure is swallowed
 * rather than raised because there is nothing for a caller to do with it that is safer than this.
 */
export function useNeedsSetup(api: Api): NeedsSetupState {
  const [state, setState] = useState<NeedsSetupState>("loading");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let needs = false;
      try {
        needs = await api.needsSetup();
      } catch {
        needs = false; // see above: unreachable ⇒ assume claimed, never offer to claim it
      }
      if (!cancelled) setState(needs ? "yes" : "no");
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);
  return state;
}
