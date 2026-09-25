import { useCallback, useState, type FormEvent } from 'react';
import type { Role } from '../../../shared/types';
import type { Api } from '../api';
import { Heading, LoadStatus, useResource } from '../components';
export function AccountView({
  api,
  role,
  onLogout,
}: {
  api: Api;
  role: Role;
  onLogout: () => void;
}) {
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  const users = useResource(
    useCallback(
      () =>
        role === 'admin'
          ? api<{ items: { username: string; role: Role; disabled: number }[] }>('/users')
          : Promise.resolve(undefined),
      [api, role],
    ),
    revision,
  );
  async function submit(e: FormEvent<HTMLFormElement>, path: string) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(path, { method: 'POST' }, Object.fromEntries(new FormData(form)));
      form.reset();
      if (path === '/password') onLogout();
      else {
        setRevision((r) => r + 1);
        setNotice(
          'Account approved and created. Share the username and initial password securely with its owner. They can now sign in.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Account & access"
        eyebrow="SECURITY"
        description="Password changes revoke existing sessions. The single administrator approves access by creating named operator and insurer accounts."
      />
      <article className="panel">
        <h2>Change password</h2>
        <form onSubmit={(e) => void submit(e, '/password')}>
          <label>
            Current password
            <input name="current" type="password" autoComplete="current-password" required />
          </label>
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button disabled={busy}>Change password and sign out</button>
        </form>
      </article>
      {role === 'admin' && (
        <article className="panel">
          <h2>Users</h2>
          <LoadStatus {...users} />
          {users.data?.items.map((u) => (
            <p key={u.username}>
              {u.username} · {u.role} · {u.disabled ? 'disabled' : 'active'}{' '}
              {!u.disabled && u.role !== 'admin' && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api('/users/' + encodeURIComponent(u.username) + '/disable', {
                        method: 'POST',
                      });
                      setRevision((r) => r + 1);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Disable
                </button>
              )}
            </p>
          ))}
          <h3>Approve and create account</h3>
          <p>
            Create multiple operators and insurers with individual usernames and passwords. Public
            registration is unavailable. Only one administrator is permitted.
          </p>
          <form onSubmit={(e) => void submit(e, '/users')}>
            <label>
              Username
              <input name="username" required pattern="[A-Za-z0-9_.-]+" maxLength={80} />
            </label>
            <label>
              Role
              <select name="role">
                <option>operator</option>
                <option>insurer</option>
              </select>
            </label>
            <label>
              Initial password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button disabled={busy}>Create user</button>
          </form>
        </article>
      )}
      <p role="status">{notice}</p>
      <p role="alert">{error}</p>
    </>
  );
}
