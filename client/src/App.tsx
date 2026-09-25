import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ParcelRecord, User } from '../../shared/types';
import { createApi, type Api } from './api';
import { ApprovalForm, ImportForm, ParcelForm } from './Forms';
import { AuditView, OverviewView, ParcelsView, PolicyView } from './Views';
import { AccountView } from './views/AccountView';
import { BatchesView } from './views/BatchesView';
type View = 'account' | 'batches' | 'overview' | 'parcels' | 'insurance' | 'policy' | 'audit';
const navigation: [View, string, string][] = [
  ['account', '⚿', 'Account & access'],
  ['batches', '▦', 'Batches & results'],
  ['overview', '◫', 'Overview'],
  ['parcels', '▤', 'All parcels'],
  ['insurance', '◇', 'Insurance queue'],
  ['policy', '⚙', 'Routing policy'],
  ['audit', '≡', 'Audit trail'],
];
function Login({ api, onLogin }: { api: Api; onLogin: (user: User) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(
        await api<User>(
          '/login',
          { method: 'POST' },
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <section className="login-story">
        <a className="brand" href="/">
          ▧ <span>ParcelDesk</span>
        </a>
        <div>
          <p className="eyebrow">DELIVERY OPERATIONS, SIMPLIFIED</p>
          <h1>
            Every parcel.
            <br />A clear next step.
          </h1>
          <p>
            Route with confidence. Review exceptions.
            <br />
            Keep every decision accountable.
          </p>
        </div>
        <small>React + TypeScript · Parcel Routing System</small>
      </section>
      <main className="login-form">
        <p className="eyebrow">WELCOME BACK</p>
        <h2>Sign in to your workspace</h2>
        <p className="muted">Use your assigned operations account.</p>
        <form onSubmit={submit}>
          <label>
            Username
            <input name="username" autoComplete="username" required maxLength={80} />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={512}
            />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>
          <p className="form-error" role="alert">
            {error}
          </p>
        </form>
        <p className="security-note">
          Access is limited by role. Operational changes are recorded.
        </p>
      </main>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true),
    [view, setView] = useState<View>('overview'),
    [revision, setRevision] = useState(0),
    [modal, setModal] = useState<'parcel' | 'import' | ParcelRecord | null>(null),
    [notice, setNotice] = useState(''),
    [failure, setFailure] = useState(false);
  const unauthorized = useCallback(() => {
    setUser(null);
    setModal(null);
    setNotice('');
  }, []);
  const api = useMemo(() => createApi(user?.csrf, unauthorized), [user?.csrf, unauthorized]);
  useEffect(() => {
    let current = true;
    createApi(undefined, () => {})<User>('/me')
      .then((u) => {
        if (current) setUser(u);
      })
      .catch(() => {})
      .finally(() => {
        if (current) setChecking(false);
      });
    return () => {
      current = false;
    };
  }, []);
  function login(user: User) {
    setUser(user);
    setView('overview');
    setNotice('');
    setRevision((r) => r + 1);
  }
  function success(message: string) {
    setNotice(message);
    setFailure(false);
    setRevision((r) => r + 1);
  }
  async function logout() {
    try {
      await api('/logout', { method: 'POST' });
      unauthorized();
    } catch (error) {
      setNotice((error as Error).message);
      setFailure(true);
    }
  }
  if (checking)
    return (
      <main className="empty" role="status">
        Opening ParcelDesk…
      </main>
    );
  if (!user) return <Login api={api} onLogin={login} />;
  const props = {
    api,
    revision,
    role: user.role,
    onNew: () => setModal('parcel'),
    onImport: () => setModal('import'),
    onReview: (item: ParcelRecord) => setModal(item),
  };
  return (
    <div className={`app-workspace theme-${user.role}`} data-role={user.role}>
      <aside className="sidebar">
        <a className="brand" href="/">
          ▧ <span>ParcelDesk</span>
        </a>
        <div className="workspace-label">
          <span className="role-orb" />
          {user.role === 'admin'
            ? 'Administration'
            : user.role === 'insurer'
              ? 'Insurance desk'
              : 'Operations desk'}
          <small>
            {user.role === 'admin'
              ? 'Configure · govern · review'
              : user.role === 'insurer'
                ? 'Review · approve · protect'
                : 'Import · route · deliver'}
          </small>
        </div>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation
            .filter(([key]) => key !== 'audit' || user.role === 'admin')
            .map(([key, icon, label]) => (
              <button
                key={key}
                className={view === key ? 'active' : ''}
                aria-current={view === key ? 'page' : undefined}
                onClick={() => setView(key)}
              >
                {icon} <span>{label}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" /> Persistent workspace<p>Every decision has a history.</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Operations <span className="slash">/</span>
            <strong>{navigation.find(([key]) => key === view)![2]}</strong>
          </span>
          <div>
            <span id="identity">
              {user.username} <span className="role-pill">{user.role}</span>
            </span>
            <button className="text-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main id="main-content">
          {notice && (
            <div id="notice" className={failure ? 'error' : ''} role="status" aria-live="polite">
              {notice}
            </div>
          )}
          {view === 'account' && <AccountView api={api} role={user.role} onLogout={unauthorized} />}
          {view === 'batches' && <BatchesView api={api} revision={revision} />}
          {view === 'overview' && (
            <OverviewView
              {...props}
              onAll={() => setView('parcels')}
              onRefresh={() => setRevision((r) => r + 1)}
              onQueue={() => setView('insurance')}
            />
          )}
          {view === 'parcels' && <ParcelsView key="parcels" {...props} />}
          {view === 'insurance' && <ParcelsView key="insurance" {...props} insurance />}
          {view === 'policy' && <PolicyView {...props} onSuccess={success} />}
          {view === 'audit' && user.role === 'admin' && <AuditView {...props} />}
          <footer>
            ParcelDesk <span>Routing decisions you can explain.</span>
            <span>React · TypeScript · Node.js</span>
          </footer>
        </main>
      </div>
      {modal === 'parcel' && (
        <ParcelForm api={api} onClose={() => setModal(null)} onSuccess={success} />
      )}
      {modal === 'import' && (
        <ImportForm api={api} onClose={() => setModal(null)} onSuccess={success} />
      )}
      {modal && typeof modal === 'object' && (
        <ApprovalForm api={api} item={modal} onClose={() => setModal(null)} onSuccess={success} />
      )}
    </div>
  );
}
