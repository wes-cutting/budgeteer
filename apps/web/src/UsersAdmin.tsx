import { type FormEvent, useCallback, useEffect, useId, useState } from "react";
import { type Api, type Role, type UserView, ApiError } from "./api";
import { Button, Field, Input, Select, Skeleton, useToast } from "./ui";
import styles from "./Ledgers.module.css";

/**
 * BUD-S88 — the admin user-management page (`/users`, ADR-0009 §7). Admin-only: the API returns 403
 * for members, and the sidebar only shows this entry to admins, so a member never gets here — but if
 * one does (deep link), the page degrades to a permission notice. Add a member, disable/enable an
 * account, or reset a password; the last two revoke the target's sessions server-side.
 */
export function UsersAdmin({ api }: { api: Api }) {
  const [users, setUsers] = useState<UserView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
      setForbidden(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && /admin/i.test(err.message)) setForbidden(true);
      else setError(err instanceof ApiError ? err.message : "Couldn't load users.");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (forbidden) {
    return (
      <main>
        <p role="alert">You need admin access to manage users.</p>
      </main>
    );
  }

  return (
    <main>
      {error ? <p role="alert">{error}</p> : null}
      <AddMemberSection api={api} onDone={() => void refresh()} />
      <UserTable api={api} users={users} onChanged={() => void refresh()} onError={setError} />
    </main>
  );
}

function AddMemberSection({ api, onDone }: { api: Api; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="accent" onClick={() => setOpen(true)}>
        Add member
      </Button>
    );
  }
  return (
    <div>
      <AddMemberForm
        api={api}
        onDone={() => {
          onDone();
          setOpen(false);
        }}
      />
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function AddMemberForm({ api, onDone }: { api: Api; onDone: () => void }) {
  const uid = useId();
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api.createUser(username, password, role);
      showToast("Member added");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add the member.");
    }
  }

  return (
    <form aria-label="Add member" onSubmit={submit}>
      {error ? <p role="alert">{error}</p> : null}
      <Field label="Username" htmlFor={`${uid}-u`}>
        <Input
          id={`${uid}-u`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Password" htmlFor={`${uid}-p`}>
        <Input
          id={`${uid}-p`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Role" htmlFor={`${uid}-r`}>
        <Select id={`${uid}-r`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
      </Field>
      <Button type="submit" variant="accent">
        Add member
      </Button>
    </form>
  );
}

function UserTable({
  api,
  users,
  onChanged,
  onError,
}: {
  api: Api;
  users: UserView[] | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  if (users === null) return <Skeleton />;
  if (users.length === 0) return <p>No users yet.</p>;
  return (
    <div className="table-scroll">
      <table className={styles.table}>
        <caption className="sr-only">Users</caption>
        <thead>
          <tr>
            <th scope="col">Username</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} api={api} user={user} onChanged={onChanged} onError={onError} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  api,
  user,
  onChanged,
  onError,
}: {
  api: Api;
  user: UserView;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const uid = useId();
  const { showToast } = useToast();
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const disabled = user.disabledAt !== null;

  async function toggleDisabled() {
    try {
      await api.setUserDisabled(user.id, !disabled);
      showToast(disabled ? "User enabled" : "User disabled");
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Couldn't update the user.");
    }
  }
  async function submitReset(event: FormEvent) {
    event.preventDefault();
    try {
      await api.resetUserPassword(user.id, newPassword);
      showToast("Password reset");
      setResetting(false);
      setNewPassword("");
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Couldn't reset the password.");
    }
  }

  return (
    <tr>
      <td>{user.username}</td>
      <td>{user.role}</td>
      <td>{disabled ? "Disabled" : "Active"}</td>
      <td className={styles.actions}>
        <Button
          variant="ghost"
          onClick={() => void toggleDisabled()}
          aria-label={`${disabled ? "Enable" : "Disable"} ${user.username}`}
        >
          {disabled ? "Enable" : "Disable"}
        </Button>
        {resetting ? (
          <form aria-label={`Reset password for ${user.username}`} onSubmit={submitReset}>
            <Field label="New password" htmlFor={`${uid}-np`}>
              <Input
                id={`${uid}-np`}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Button type="submit" variant="accent">
              Set password
            </Button>
            <Button type="button" variant="ghost" onClick={() => setResetting(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setResetting(true)}
            aria-label={`Reset password for ${user.username}`}
          >
            Reset password
          </Button>
        )}
      </td>
    </tr>
  );
}
