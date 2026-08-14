import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  AccessMeta,
  AuthUser,
  PAGE_CATALOG,
  PRODUCT_OPTIONS,
  allAssignablePageIds,
  pageLabel,
  productLabel,
} from '@/lib/access';
import {
  fetchAccessMeta,
  createDashboardUser,
  deleteDashboardUser,
  listDashboardUsers,
  updateDashboardUser,
  fetchReportSettings,
  saveReportSettings,
  sendMonthlyReportsNow,
  type ReportSettings,
} from '@/lib/api';
import { useToast } from '@/lib/toast';

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  username: '',
  displayName: '',
  email: '',
  receiveReports: true,
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

function pagesText(user: AuthUser) {
  if (user.isAdmin || user.permissions.pages.includes('*')) return 'All pages';
  const labels = user.permissions.pages.map(pageLabel);
  if (!labels.length) return 'None';
  if (labels.length <= 4) return labels.join(', ');
  return `${labels.slice(0, 4).join(', ')} +${labels.length - 4} more`;
}

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'list' | 'edit' | 'reports'>('list');
  const [meta, setMeta] = useState<AccessMeta | null>(FALLBACK_META);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | 'new'>('new');
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportSettings, setReportSettings] = useState<ReportSettings | null>(null);
  const [reportPeriod, setReportPeriod] = useState('');
  const [extraRecipients, setExtraRecipients] = useState('');

  const selected = users.find((u) => u.id === selectedId) || null;
  const isNew = selectedId === 'new';

  const loadMeta = async () => {
    const m = await fetchAccessMeta().catch(() => FALLBACK_META);
    setMeta({
      ...FALLBACK_META,
      ...m,
      pages: m.pages?.length ? m.pages : FALLBACK_META.pages,
      products: m.products?.length ? m.products : FALLBACK_META.products,
    });
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await listDashboardUsers({
        page,
        limit: PAGE_SIZE,
        q: query,
        product: productFilter,
      });
      setUsers(result.users);
      setTotal(result.total);
      setPages(result.pages);
    } catch (err) {
      setUsers([]);
      setTotal(0);
      toast.error('Could not load users', err instanceof Error ? err.message : 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const data = await fetchReportSettings();
      setReportSettings(data.settings);
      setReportPeriod(data.period.label);
      setExtraRecipients((data.settings.extraRecipients || []).join(', '));
    } catch {
      setReportSettings({
        enabled: true,
        sendToUsers: true,
        extraRecipients: [],
        lastSentKey: null,
        lastSentAt: null,
        smtp: { configured: false, host: '', from: '' },
      });
    }
  };

  useEffect(() => {
    loadMeta();
    loadReports();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [page, query, productFilter]);

  useEffect(() => {
    if (tab !== 'edit') return;
    if (isNew) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!selected) return;
    setForm({
      username: selected.username,
      displayName: selected.displayName,
      email: selected.email || '',
      receiveReports: selected.receiveReports !== false,
      password: '',
      role: selected.role,
      products: selected.isAdmin ? (meta?.products.map((p) => p.id) || []) : [...selected.permissions.products.filter((p) => p !== '*')],
      pages: selected.isAdmin ? allAssignablePageIds() : [...selected.permissions.pages.filter((p) => p !== '*')],
      active: selected.active,
    });
  }, [selectedId, selected, isNew, meta, tab]);

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

  const openNew = () => {
    setSelectedId('new');
    setTab('edit');
  };

  const openUser = (id: string) => {
    setSelectedId(id);
    setTab('edit');
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
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
          email: form.email,
          receiveReports: form.receiveReports,
          role: form.role,
          permissions,
        });
        toast.success('Sub-admin created', `${user.username} can now sign in`);
        setSelectedId(user.id);
        setPage(1);
        await loadUsers();
      } else if (selected) {
        await updateDashboardUser(selected.id, {
          displayName: form.displayName,
          email: form.email,
          receiveReports: form.receiveReports,
          role: form.role,
          active: form.active,
          permissions,
          password: form.password || undefined,
        });
        toast.success('Access saved', `Updated ${selected.username}`);
        setForm((f) => ({ ...f, password: '' }));
        await loadUsers();
      }
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteDashboardUser(selected.id);
      setSelectedId('new');
      setConfirmDelete(false);
      toast.success('Account deleted', `${selected.username} no longer has access`);
      await loadUsers();
      setTab('list');
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const saveReports = async () => {
    setBusy(true);
    try {
      const settings = await saveReportSettings({
        enabled: reportSettings?.enabled !== false,
        sendToUsers: reportSettings?.sendToUsers !== false,
        extraRecipients: extraRecipients.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setReportSettings(settings);
      toast.success('Report settings saved');
    } catch (err) {
      toast.error('Could not save settings', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    setBusy(true);
    try {
      const result = await sendMonthlyReportsNow();
      if (result.skipped) {
        toast.info(result.reason === 'already-sent' ? 'Already sent for this month' : 'Send skipped');
      } else {
        const delivered = (result.sent || []).filter((s) => !s.skipped).length;
        toast.success(`Reports sent`, `${result.period?.label || 'Last month'} · ${delivered} app email${delivered === 1 ? '' : 's'}`);
        await loadReports();
      }
    } catch (err) {
      toast.error('Could not send reports', err instanceof Error ? err.message : 'Check SMTP settings');
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(() => {
    if (form.role === 'admin') return 'Full access to every app and page';
    const apps = form.products.length ? form.products.map(productLabel).join(', ') : 'no apps';
    return `${form.pages.length} pages · ${apps}`;
  }, [form]);

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Users & access</h2>
          <p>See who can open which apps and pages, edit access, and send a monthly report per app.</p>
        </div>
      </div>

      <div className="page-content">
        {meta?.mongo && !meta.mongo.connected && (
          <div className="page-hint" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 16 }}>
            MongoDB is not connected. Add <code>MONGODB_URI</code> on Render, allow <code>0.0.0.0/0</code> in Atlas, then redeploy.
          </div>
        )}

        <div className="admin-tabs">
          <button type="button" className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
            <Users size={14} /> Access list
          </button>
          <button type="button" className={tab === 'edit' ? 'active' : ''} onClick={openNew}>
            <UserPlus size={14} /> {isNew ? 'Create / edit' : `Edit ${selected?.username || ''}`}
          </button>
          <button type="button" className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
            <Mail size={14} /> Monthly reports
          </button>
        </div>

        {tab === 'list' && (
          <div className="admin-table-card">
            <form className="admin-table-tools" onSubmit={onSearch}>
              <div className="admin-search">
                <Search size={14} />
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Search name, username, email"
                />
              </div>
              <select
                value={productFilter}
                onChange={(e) => { setPage(1); setProductFilter(e.target.value); }}
              >
                <option value="">All apps</option>
                {(meta?.products || PRODUCT_OPTIONS).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button type="submit">Search</button>
              <button type="button" className="admin-ghost" onClick={openNew}>
                <UserPlus size={14} /> New
              </button>
            </form>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Apps</th>
                    <th>Pages</th>
                    <th>Email / reports</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">
                        <Loader2 size={16} className="spin" /> Loading accounts…
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">
                        No accounts match this filter.
                      </td>
                    </tr>
                  ) : users.map((u) => (
                    <tr key={u.id} onClick={() => openUser(u.id)}>
                      <td>
                        <strong>{u.displayName}</strong>
                        <div className="admin-muted">{u.username}</div>
                      </td>
                      <td>
                        <span className={`pill ${u.isAdmin ? 'pill-accent' : 'pill-muted'}`}>
                          {u.isAdmin ? 'Admin' : 'Sub-admin'}
                        </span>
                      </td>
                      <td>
                        <div className="chip-row">
                          {(u.isAdmin || u.permissions.products.includes('*')
                            ? ['banknote', 'coinzy']
                            : u.permissions.products
                          ).map((id) => (
                            <span key={id} className="mini-chip">{productLabel(id)}</span>
                          ))}
                          {!u.isAdmin && !u.permissions.products.length ? <span className="admin-muted">None</span> : null}
                        </div>
                      </td>
                      <td title={u.isAdmin ? 'All pages' : u.permissions.pages.map(pageLabel).join(', ')}>
                        {pagesText(u)}
                      </td>
                      <td>
                        {u.email || <span className="admin-muted">No email</span>}
                        {u.email ? (
                          <div className="admin-muted">{u.receiveReports === false ? 'Reports off' : 'Reports on'}</div>
                        ) : null}
                      </td>
                      <td>
                        <span className={`pill ${u.active ? 'pill-ok' : 'pill-warn'}`}>
                          {u.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-pager">
              <span>{rangeStart}–{rangeEnd} of {total}</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} /> Prev
                </button>
                <span>Page {page} of {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'edit' && (
          <form className="admin-editor" onSubmit={onSubmit}>
            <div className="admin-editor-head">
              <div>
                <h3>{isNew ? 'Create sub-admin' : `Edit ${selected?.displayName || selected?.username}`}</h3>
                <p>{summary}</p>
              </div>
              {!isNew && selected && selected.id !== me?.id && (
                <button type="button" className="admin-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
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
                Email (for monthly reports)
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
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
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={form.receiveReports}
                onChange={(e) => setForm((f) => ({ ...f, receiveReports: e.target.checked }))}
              />
              Send monthly app reports to this email
            </label>

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
                  <button type="button" onClick={() => setSection(allAssignablePageIds(), true)}>Select all</button>
                  <button type="button" onClick={() => setSection(allAssignablePageIds(), false)}>Clear</button>
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

            <div className="admin-actions">
              <button type="submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : null}
                {isNew ? 'Create sub-admin' : 'Save access'}
              </button>
            </div>
          </form>
        )}

        {tab === 'reports' && (
          <div className="admin-editor">
            <div className="admin-editor-head">
              <div>
                <h3>Monthly email reports</h3>
                <p>
                  One email per app (Banknote and Coinzy) for {reportPeriod || 'the previous month'}.
                  Admins get both. Sub-admins only get apps they can access.
                </p>
              </div>
            </div>
            {!reportSettings?.smtp?.configured && (
              <div className="page-hint" style={{ marginBottom: 16 }}>
                Add on Render: <code>SMTP_HOST</code>, <code>SMTP_PORT</code> (587),
                <code> SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>.
                Gmail: use an App Password.
              </div>
            )}
            <label>
              Extra recipient emails (comma-separated — always get every app)
              <input
                value={extraRecipients}
                onChange={(e) => setExtraRecipients(e.target.value)}
                placeholder="founder@company.com, ops@company.com"
              />
            </label>
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={reportSettings?.enabled !== false}
                onChange={(e) => setReportSettings((s) => ({ ...(s as ReportSettings), enabled: e.target.checked }))}
              />
              Send automatically on the 1st of each month (08:00 UTC)
            </label>
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={reportSettings?.sendToUsers !== false}
                onChange={(e) => setReportSettings((s) => ({ ...(s as ReportSettings), sendToUsers: e.target.checked }))}
              />
              Also email users who have an address and reports enabled
            </label>
            {reportSettings?.lastSentAt && (
              <p className="admin-note">Last sent: {reportSettings.lastSentKey} ({new Date(reportSettings.lastSentAt).toLocaleString()})</p>
            )}
            <div className="admin-actions" style={{ gap: 8 }}>
              <button type="button" className="admin-ghost" onClick={saveReports} disabled={busy}>Save settings</button>
              <button type="button" onClick={sendNow} disabled={busy || !reportSettings?.smtp?.configured}>
                {busy ? <Loader2 size={16} className="spin" /> : <Mail size={16} />}
                Send {reportPeriod || 'last month'} now
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && selected && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          onClick={() => { if (!busy) setConfirmDelete(false); }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 id="delete-user-title">Delete {selected.username}?</h3>
            <p>They will lose access immediately. This cannot be undone.</p>
            <div className="admin-actions">
              <button type="button" className="admin-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="admin-danger" onClick={onDelete} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
