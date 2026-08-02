import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { type Api, ApiError } from "./api";
import { Button, Field, Input } from "./ui";
import { useNeedsSetup } from "./useNeedsSetup";
import styles from "./Login.module.css";

/** The server's own floor (`authService`); checked here too so the round trip is not the teacher. */
const MIN_PASSWORD_LEN = 8;

/**
 * BUD-S92 — first-run setup. A standalone route OUTSIDE the app shell, like `/login`: it is the
 * first thing a brand-new install shows, and it must render before any session or ledger data
 * exists. Creating the first admin was previously reachable only through the `create-admin` CLI or
 * a hand-made POST, so a fresh box was a sign-in page with no credential that could open it.
 *
 * One-shot. `/setup` redirects to `/login` the moment a user exists — the server enforces that
 * too (`/auth/setup` answers 409 forever after), which is the guarantee that matters now that the
 * endpoint is discoverable rather than obscure.
 *
 * Not to be confused with `FirstRunOnboarding`, the AUTHENTICATED first run ("my ledger is empty").
 * They compose: finish here, land on `/`, and that is what greets you.
 */
export function Setup({ api }: { api: Api }) {
  const navigate = useNavigate();
  const needsSetup = useNeedsSetup(api);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < MIN_PASSWORD_LEN)
      return setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
    setBusy(true);
    setError(null);
    try {
      await api.setup(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed.");
      setBusy(false);
      return;
    }
    // From here the account EXISTS. A failure below is a sign-in problem, never a setup failure —
    // reporting it as one would send the user back to this form, where they would meet a 409 and
    // reasonably conclude their account was never created. Hand them to `/login` and say why.
    try {
      await api.login(username, password);
    } catch {
      return void navigate("/login", {
        replace: true,
        state: { message: "Your account was created. Sign in to continue." },
      });
    }
    navigate("/");
  }

  // Nothing renders until the probe answers: showing this form to an install that already has an
  // owner — even for a frame — suggests the instance is unclaimed.
  if (needsSetup === "loading") return null;
  if (needsSetup === "no") return <Navigate to="/login" replace />;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Set up Budgeteer</h1>
        <p className={styles.intro}>
          No one has claimed this instance yet. Create the first account — it will be an
          administrator, and can add everyone else.
        </p>
        <form aria-label="Create the first account" onSubmit={onSubmit} className={styles.form}>
          {error !== null ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <Field label="Username" htmlFor="setup-username">
            <Input
              id="setup-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="setup-password" hint="At least 8 characters.">
            <Input
              id="setup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm password" htmlFor="setup-confirm">
            <Input
              id="setup-confirm"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </div>
    </main>
  );
}
