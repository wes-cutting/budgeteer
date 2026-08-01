import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { type Api, ApiError } from "./api";
import { Button, Field, Input } from "./ui";
import styles from "./Login.module.css";

/**
 * BUD-S87 — the sign-in page (ADR-0009). A standalone route OUTSIDE the app shell: when the API's
 * default-deny gate returns 401, the api client bounces here (the reactive auth guard). On success
 * we navigate home, where the now-authenticated data loads.
 *
 * The first admin is created out of band (the `create-admin` CLI or `POST /auth/setup`); this page
 * only signs an existing user in.
 */
export function Login({ api }: { api: Api }) {
  const navigate = useNavigate();
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
