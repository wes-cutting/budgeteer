import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { type Api, ApiError } from "./api";
import { Button, Field, Input } from "./ui";
import { useNeedsSetup } from "./useNeedsSetup";
import styles from "./Login.module.css";

/**
 * BUD-S87 — the sign-in page (ADR-0009). A standalone route OUTSIDE the app shell: when the API's
 * default-deny gate returns 401, the api client bounces here (the reactive auth guard). On success
 * we navigate home, where the now-authenticated data loads.
 *
 * BUD-S92 — this page signs an EXISTING user in, so on a store with no user it is a dead end: every
 * credential is wrong and the 401 is deliberately indistinguishable from a wrong password
 * (enumeration-safety, BUD-S89), which is why it takes a separate probe to know. While the store is
 * empty we hand off to `/setup`, which hands back once it isn't.
 */
export function Login({ api }: { api: Api }) {
  const navigate = useNavigate();
  const location = useLocation();
  const needsSetup = useNeedsSetup(api);
  // Carried by `/setup` when the account was created but the automatic sign-in did not take — the
  // one case where landing here is good news and needs saying.
  const handoff = (location.state as { message?: string } | null)?.message;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  // Hold the form back until the probe answers, so a brand-new install never flashes a sign-in page
  // it has no credential for on its way to `/setup`.
  if (needsSetup === "loading") return null;
  if (needsSetup === "yes") return <Navigate to="/setup" replace />;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in to Budgeteer</h1>
        <form aria-label="Sign in" onSubmit={onSubmit} className={styles.form}>
          {error !== null ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          {error === null && handoff !== undefined ? (
            <p role="status" className={styles.intro}>
              {handoff}
            </p>
          ) : null}
          <Field label="Username" htmlFor="login-username">
            <Input
              id="login-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
