import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AccessMeta, AuthUser, PAGE_CATALOG, PRODUCT_OPTIONS, allAssignablePageIds } from '@/lib/access';
import {
  fetchAccessMeta,
  createDashboardUser,
  deleteDashboardUser,
  listDashboardUsers,
  updateDashboardUser,
} from '@/lib/api';

const EMPTY_FORM = {
  username: '',
  displayName: '',
  password: '',
  role: 'sub_admin' as 'admin' | 'sub_admin',
  products: [] as string[],
  pages: [] as string[],
  active: true,
};

const FALLBACK_META: AccessMeta = {
  pages: PAGE_CATALOG.map((section) => ({
    section: section.section,
    items: section.items.map((item) => ({ id: item.id, label: item.label, path: item.path })),
  })),
  products: PRODUCT_OPTIONS,
  roles: [
    { id: 'sub_admin', label: 'Sub-admin' },
    { id: 'admin', label: 'Admin' },
  ],
};

function productLabel(meta: AccessMeta | null, id: string) {
  return meta?.products.find((p) => p.id === id)?.label || id;
}

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [meta, setMeta] = useState<AccessMeta | null>(FALLBACK_META);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | 'new'>('new');
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selected = users.find((u) => u.id === selectedId) || null;
  const isNew = selectedId === 'new';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const m = await fetchAccessMeta().catch(() => FALLBACK_META);
      setMeta({
        ...FALLBACK_META,
        ...m,
        pages: m.pages?.length ? m.pages : FALLBACK_META.pages,
        products: m.products?.length ? m.products : FALLBACK_META.products,
      });
      try {
        setUsers(await listDashboardUsers());
      } catch (err) {
        setUsers([]);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setError('');
    setMessage('');
    if (isNew) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!selected) return;
    setForm({
      username: selected.username,
      displayName: selected.displayName,
      password: '',
      role: selected.role,
      products: selected.isAdmin ? (meta?.products.map((p) => p.id) || []) : [...selected.permissions.products.filter((p) => p !== '*')],
      pages: selected.isAdmin ? allAssignablePageIds() : [...selected.permissions.pages.filter((p) => p !== '*')],
      active: selected.active,
    });
  }, [selectedId, selected, isNew, meta]);

  const toggleProduct = (id: string) => {
    setForm((f) => ({
      ...f,
      products: f.products.includes(id) ? f.products.filter((x) => x !== id) : [...f.products, id],
    }));
  };

  const togglePage = (id: string) => {
    setForm((f) => ({
      ...f,
      pages: f.pages.includes(id) ? f.pages.filter((x) => x !== id) : [...f.pages, id],
    }));
  };

  const setSection = (ids: string[], on: boolean) => {
    setForm((f) => {
      const next = new Set(f.pages);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return { ...f, pages: [...next] };
    });
  };

  const selectAllPages = (on: boolean) => {
    setForm((f) => ({ ...f, pages: on ? allAssignablePageIds() : [] }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (form.role === 'sub_admin' && form.products.length === 0) {
        throw new Error('Assign at least one app (Banknote and/or Coinzy)');
      }
      if (form.role === 'sub_admin' && form.pages.length === 0) {
        throw new Error('Assign at least one page this person can open');
      }
      const permissions = { products: form.products, pages: form.pages };
      if (isNew) {
        const user = await createDashboardUser({
          username: form.username,
          password: form.password,
          displayName: form.displayName || form.username,
          role: form.role,
          permissions,
        });
        setUsers((prev) => [...prev, user].sort((a, b) => a.username.localeCompare(b.username)));
        setSelectedId(user.id);
        setMessage(`Created ${user.username}`);
      } else if (selected) {
        const user = await updateDashboardUser(selected.id, {
          displayName: form.displayName,
          role: form.role,
          active: form.active,
          permissions,
          password: form.password || undefined,
        });
        setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
        setMessage('Saved');
        setForm((f) => ({ ...f, password: '' }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.username}? They will lose access immediately.`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteDashboardUser(selected.id);
      setUsers((prev) => prev.filter((u) => u.id !== selected.id));
      setSelectedId('new');
      setMessage(`Deleted ${selected.username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(() => {
    if (form.role === 'admin') return 'Full access to every app and page';
    const apps = form.products.length ? form.products.map((id) => productLabel(meta, id)).join(', ') : 'no apps';
    return `${form.pages.length} pages · ${apps}`;
  }, [form, meta]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Users & access</h2>
          <p>Create sub-admins and choose which apps and pages each person can see. Admins always have full access.</p>
        </div>
      </div>

      <div className="page-content">
        {meta?.mongo && !meta.mongo.connected && (
          <div className="page-hint" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16 }}>
            MongoDB is not connected on this host. In Render → Environment add
            {' '}<code>MONGODB_URI</code> and <code>MONGODB_DB=analytics_dashboard</code>,
            then in Atlas → Network Access allow <code>0.0.0.0/0</code>, then Manual Deploy.
          </div>
        )}
        {loading ? (
          <div className="page-hint">Loading users…</div>
        ) : (
          <div className="admin-layout">
            <aside className="admin-list">
              <div className="admin-list-head">
                <strong>Accounts</strong>
                <button type="button" className="admin-ghost" onClick={() => setSelectedId('new')}>
                  <UserPlus size={14} /> New
                </button>
              </div>
              <button
                type="button"
                className={`admin-user${isNew ? ' active' : ''}`}
                onClick={() => setSelectedId('new')}
              >
                <span className="admin-avatar new"><UserPlus size={14} /></span>
                <span>
                  <b>New sub-admin</b>
                  <small>Username, password, permissions</small>
                </span>
              </button>
              {users.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  className={`admin-user${selectedId === u.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <span className={`admin-avatar ${u.role}`}>{u.isAdmin ? <Shield size={14} /> : <Users size={14} />}</span>
                  <span>
                    <b>{u.displayName}</b>
                    <small>
                      {u.username} · {u.isAdmin ? 'Admin' : 'Sub-admin'}
                      {!u.active ? ' · Disabled' : ''}
                    </small>
                  </span>
                </button>
              ))}
            </aside>

            <form className="admin-editor" onSubmit={onSubmit}>
              <div className="admin-editor-head">
                <div>
                  <h3>{isNew ? 'Create sub-admin' : `Edit ${selected?.displayName || selected?.username}`}</h3>
                  <p>{summary}</p>
                </div>
                {!isNew && selected && selected.id !== me?.id && (
                  <button type="button" className="admin-danger" onClick={onDelete} disabled={busy}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>

              <div className="admin-grid">
                <label>
                  Username
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    autoComplete="off"
                    required={isNew}
                    disabled={!isNew}
                    placeholder="jane"
                  />
                </label>
                <label>
                  Display name
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Jane"
                  />
                </label>
                <label>
                  {isNew ? 'Password' : 'New password (optional)'}
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                    required={isNew}
                    minLength={8}
                    placeholder={isNew ? 'At least 8 characters' : 'Leave blank to keep current'}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'sub_admin' }))}
                    disabled={!isNew && selected?.id === me?.id}
                  >
                    <option value="sub_admin">Sub-admin — limited access</option>
                    <option value="admin">Admin — full access</option>
                  </select>
                </label>
              </div>

              {!isNew && (
                <label className="admin-check-row">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    disabled={selected?.id === me?.id}
                  />
                  Account is active
                </label>
              )}

              <fieldset className="admin-fieldset" disabled={form.role === 'admin'}>
                <legend>Apps they can open</legend>
                <div className="admin-chips">
                  {(meta?.products || []).map((p) => (
                    <label key={p.id} className={`admin-chip${form.products.includes(p.id) ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.products.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
                {form.role === 'admin' && <p className="admin-note">Admins always see every app.</p>}
              </fieldset>

              <fieldset className="admin-fieldset" disabled={form.role === 'admin'}>
                <legend>
                  Pages they can see
                  <span className="admin-legend-actions">
                    <button type="button" onClick={() => selectAllPages(true)}>Select all</button>
                    <button type="button" onClick={() => selectAllPages(false)}>Clear</button>
                  </span>
                </legend>
                {(meta?.pages || []).map((section) => {
                  const ids = section.items.map((i) => i.id);
                  const allOn = ids.every((id) => form.pages.includes(id));
                  return (
                    <div key={section.section} className="admin-section">
                      <div className="admin-section-head">
                        <strong>{section.section}</strong>
                        <button type="button" onClick={() => setSection(ids, !allOn)}>
                          {allOn ? 'Clear section' : 'Select section'}
                        </button>
                      </div>
                      <div className="admin-checks">
                        {section.items.map((item) => (
                          <label key={item.id}>
                            <input
                              type="checkbox"
                              checked={form.pages.includes(item.id)}
                              onChange={() => togglePage(item.id)}
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </fieldset>

              {error && <div className="login-error">{error}</div>}
              {message && <div className="admin-ok"><Check size={14} /> {message}</div>}

              <div className="admin-actions">
                <button type="submit" disabled={busy}>
                  {busy ? <Loader2 size={16} className="spin" /> : null}
                  {isNew ? 'Create sub-admin' : 'Save access'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
