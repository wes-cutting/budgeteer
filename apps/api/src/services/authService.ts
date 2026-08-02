import { randomBytes } from "node:crypto";
import { type Kysely, sql } from "kysely";
import type { DB } from "../db/schema";
import { type Clock, toISO } from "../util/dates";
import { hashPassword, verifyPassword } from "../util/password";
import { asDuplicateName, isUniqueViolation } from "./dbErrors";
import { NotFoundError, ValidationError } from "./errors";

/** The authenticated caller (ADR-0009). Derived from the session; scopes every request. */
export interface Principal {
  userId: string;
  householdId: string;
  role: "admin" | "member";
}

export type Role = "admin" | "member";

/** A user as the admin management UI sees it (BUD-S88) — never the password hash. */
export interface UserView {
  id: string;
  username: string;
  role: Role;
  disabledAt: string | null;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_PASSWORD_LEN = 8;
// A fixed decoy hash: verified when the username is unknown/disabled so a failed login costs the
// same scrypt work whether or not the account exists (enumeration-safety, SECURITY.md §3).
const DECOY_HASH = hashPassword("decoy-not-a-real-password");

/**
 * Authentication + session lifecycle (ADR-0009 · BUD-S87). Unlike the domain services this is NOT
 * scope-bound — it *establishes* the principal every other request is scoped by, so it queries the
 * `users`/`sessions` tables directly (username is globally unique in shape A). Constructed once with
 * `db` + the injected clock (session expiry, EH7); safe to build outside the per-request container.
 */
export function makeAuthService(db: Kysely<DB>, clock: Clock) {
  return {
    /** Create a member. Bootstrap/admin-only at the call site; throws on a taken username. */
    async createUser(input: {
      username: string;
      password: string;
      role: Role;
      householdId: string;
    }): Promise<{ id: string; username: string; role: Role }> {
      const username = input.username.trim();
      if (username.length === 0) throw new ValidationError("Username is required.");
      if (input.password.length < MIN_PASSWORD_LEN)
        throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      const row = await asDuplicateName("That username is already taken.", () =>
        db
          .insertInto("users")
          .values({
            household_id: input.householdId,
            username,
            password_hash: hashPassword(input.password),
            role: input.role,
          })
          .returning(["id", "username", "role"])
          .executeTakeFirstOrThrow(),
      );
      return { id: row.id, username: row.username, role: row.role as Role };
    },

    /**
     * Whether this store still has no user — what `GET /auth/needs-setup` reports so the SPA can
     * route a brand-new install to `/setup` (BUD-S92). Strictly one bit: no counts, no usernames.
     * It is NOT the gate on creating that user — see {@link createFirstAdmin}, which cannot rely on
     * a separate read.
     */
    async needsSetup(): Promise<boolean> {
      const row = await db.selectFrom("users").select("id").limit(1).executeTakeFirst();
      return row === undefined;
    },

    /**
     * Create the first admin, atomically (BUD-S92 · SECURITY.md §3). Returns false when the store
     * already has a user — the caller maps that to `409`.
     *
     * The emptiness test is INSIDE the insert, and the `bootstrap` partial unique index (migration
     * `0004`) settles the case the statement alone cannot: under READ COMMITTED two concurrent
     * transactions can both see an empty table, so the loser is rejected by the index (`23505`)
     * rather than by a count that raced. Either way exactly one admin exists afterwards, and the
     * decision belongs to the database.
     */
    async createFirstAdmin(input: {
      username: string;
      password: string;
      householdId: string;
    }): Promise<boolean> {
      const username = input.username.trim();
      if (username.length === 0) throw new ValidationError("Username is required.");
      if (input.password.length < MIN_PASSWORD_LEN)
        throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      const passwordHash = hashPassword(input.password);
      try {
        const result = await sql<{ id: string }>`
          insert into users (household_id, username, password_hash, role, bootstrap)
          select ${input.householdId}::uuid, ${username}, ${passwordHash}, 'admin', true
          where not exists (select 1 from users)
          returning id
        `.execute(db);
        return result.rows.length > 0;
      } catch (e) {
        if (isUniqueViolation(e)) return false; // lost the race, or the handle is taken
        throw e;
      }
    },

    /**
     * Verify credentials and open a session. Returns the opaque token + expiry, or null on ANY
     * failure (unknown user, wrong password, disabled account) — the caller returns an identical
     * 401 for all three (enumeration-safe). A decoy verify equalizes timing on the miss paths.
     */
    async login(
      username: string,
      password: string,
    ): Promise<{ token: string; expiresAt: Date } | null> {
      const user = await db
        .selectFrom("users")
        .select(["id", "password_hash", "disabled_at"])
        .where(sql<boolean>`lower(username) = ${username.trim().toLowerCase()}`)
        .executeTakeFirst();
      if (!user || user.disabled_at !== null) {
        verifyPassword(password, DECOY_HASH); // equalize timing; ignore result
        return null;
      }
      if (!verifyPassword(password, user.password_hash)) return null;

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(clock().getTime() + SESSION_TTL_MS);
      await db
        .insertInto("sessions")
        .values({ id: token, user_id: user.id, expires_at: expiresAt })
        .execute();
      return { token, expiresAt };
    },

    /** Resolve a session token to its principal, or null if missing/expired/disabled. */
    async resolvePrincipal(token: string): Promise<Principal | null> {
      const row = await db
        .selectFrom("sessions as s")
        .innerJoin("users as u", "u.id", "s.user_id")
        .select([
          "u.id as userId",
          "u.household_id as householdId",
          "u.role as role",
          "u.disabled_at as disabledAt",
          "s.expires_at as expiresAt",
        ])
        .where("s.id", "=", token)
        .executeTakeFirst();
      if (!row || row.disabledAt !== null) return null;
      if (new Date(row.expiresAt).getTime() <= clock().getTime()) {
        await db.deleteFrom("sessions").where("id", "=", token).execute(); // expired → clean up
        return null;
      }
      return { userId: row.userId, householdId: row.householdId, role: row.role as Role };
    },

    /** End one session (logout). Idempotent. */
    async logout(token: string): Promise<void> {
      await db.deleteFrom("sessions").where("id", "=", token).execute();
    },

    // --- User management (BUD-S88; admin-gated at the route, household-scoped here) ---

    /** List a household's users (admin UI). Never returns the password hash. */
    async listUsers(householdId: string): Promise<UserView[]> {
      const rows = await db
        .selectFrom("users")
        .select(["id", "username", "role", "disabled_at"])
        .where("household_id", "=", householdId)
        .orderBy("username")
        .execute();
      return rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role as Role,
        disabledAt: toISO(r.disabled_at),
      }));
    },

    /** Resolve a username to its id within a household (CLI convenience), or null. */
    async userIdByUsername(username: string, householdId: string): Promise<string | null> {
      const row = await db
        .selectFrom("users")
        .select("id")
        .where(sql<boolean>`lower(username) = ${username.trim().toLowerCase()}`)
        .where("household_id", "=", householdId)
        .executeTakeFirst();
      return row?.id ?? null;
    },

    /**
     * Enable/disable an account. Disabling **revokes every session** (a row delete), so a disabled
     * user is logged out everywhere on the next request (SECURITY.md §3). Scoped to the household.
     */
    async setDisabled(userId: string, disabled: boolean, householdId: string): Promise<UserView> {
      const target = await db
        .selectFrom("users")
        .select(["id", "role"])
        .where("id", "=", userId)
        .where("household_id", "=", householdId)
        .executeTakeFirst();
      if (!target) throw new NotFoundError("user");
      // Last-admin protection (BUD-S89): a household must keep at least one active admin, or nobody
      // could ever manage users again. Blocks disabling the final active admin (self-disable is
      // already blocked at the route).
      if (disabled && target.role === "admin") {
        const { n } = await db
          .selectFrom("users")
          .select(db.fn.countAll<string>().as("n"))
          .where("household_id", "=", householdId)
          .where("role", "=", "admin")
          .where("disabled_at", "is", null)
          .executeTakeFirstOrThrow();
        if (Number(n) <= 1) throw new ValidationError("Can't disable the last admin.");
      }
      await db
        .updateTable("users")
        .set({ disabled_at: disabled ? clock() : null })
        .where("id", "=", userId)
        .execute();
      if (disabled) await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
      const row = await db
        .selectFrom("users")
        .select(["id", "username", "role", "disabled_at"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();
      return {
        id: row.id,
        username: row.username,
        role: row.role as Role,
        disabledAt: toISO(row.disabled_at),
      };
    },

    /** Set a new password and **revoke every existing session** (force re-login everywhere). */
    async resetPassword(userId: string, newPassword: string, householdId: string): Promise<void> {
      if (newPassword.length < MIN_PASSWORD_LEN)
        throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      const target = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", userId)
        .where("household_id", "=", householdId)
        .executeTakeFirst();
      if (!target) throw new NotFoundError("user");
      await db
        .updateTable("users")
        .set({ password_hash: hashPassword(newPassword) })
        .where("id", "=", userId)
        .execute();
      await db.deleteFrom("sessions").where("user_id", "=", userId).execute();
    },
  };
}

export type AuthService = ReturnType<typeof makeAuthService>;
