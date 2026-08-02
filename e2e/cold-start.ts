/**
 * BUD-S92 — the COLD-START stack: a second API + web pair, on its own ports, over its own empty
 * store. Shared by `playwright.config.ts` (which starts it) and `first-run.spec.ts` (which drives
 * it).
 *
 * Why a whole second stack rather than another spec on :3001/:5173: `global-setup.ts` POSTs
 * `/auth/setup` before the first spec runs, so the primary store has an admin from the moment the
 * suite starts and "zero users exist" is unreachable there. That is precisely the blind spot
 * `KIT_FEEDBACK` K42 names — every automated consumer provisions its credential out of band, so
 * the suite has only ever tested the app *after* the hard part. A test that shares the primary
 * stack could not fail for the right reason, however it were written.
 *
 * This stack is never signed into by `global-setup`, so a spec pointed at it CANNOT pass by way of
 * the shared `storageState` — the cookie in that state names a session row in the *other* store.
 * The isolation is structural, not a convention a later edit could quietly break.
 */
export const COLD_START_API_PORT = 3002;
export const COLD_START_WEB_PORT = 5174;
export const COLD_START_API_ORIGIN = `http://localhost:${COLD_START_API_PORT}`;
export const COLD_START_WEB_ORIGIN = `http://localhost:${COLD_START_WEB_PORT}`;

/** The admin the first-run journey creates. Nothing provisions it — the browser does, once. */
export const COLD_START_ADMIN = { username: "first-admin", password: "first-run-password-123" };
