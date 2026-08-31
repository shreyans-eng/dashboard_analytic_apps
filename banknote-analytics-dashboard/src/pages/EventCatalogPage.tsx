import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useEventCatalog } from '@/hooks/useAnalytics';
import type { EventCatalogUniqueRow } from '@/lib/api';

type AppFilter = 'all' | 'banknote' | 'coinzy';

function csvEscape(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const body = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventCatalogPage() {
  const catalog = useEventCatalog();
  const [app, setApp] = useState<AppFilter>('all');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const unique = catalog.data?.unique || [];
  const usages = catalog.data?.usages || [];
  const summary = catalog.data?.summary;

  const visibleUnique = useMemo(() => {
    return unique.filter((r) => {
      if (app !== 'all' && r.product !== app) return false;
      if (!q) return true;
      return (
        r.event.toLowerCase().includes(q)
        || r.used_in.toLowerCase().includes(q)
        || r.app.toLowerCase().includes(q)
      );
    });
  }, [unique, app, q]);

  const visibleUsages = useMemo(() => {
    return usages.filter((r) => {
      if (app !== 'all' && r.product !== app) return false;
      if (!q) return true;
      return (
        r.event.toLowerCase().includes(q)
        || r.surface.toLowerCase().includes(q)
        || r.step.toLowerCase().includes(q)
        || r.app.toLowerCase().includes(q)
      );
    });
  }, [usages, app, q]);

  function downloadUnique(): void {
    downloadCsv(
      `event-catalog-unique-${app}.csv`,
      ['App', 'Event', 'Used in', 'Roles', 'Tabs'],
      visibleUnique.map((r) => [
        r.app,
        r.event,
        r.used_in,
        r.roles_label,
        r.tabs.join(' | '),
      ]),
    );
  }

  function downloadUsages(): void {
    downloadCsv(
      `event-catalog-usages-${app}.csv`,
      ['App', 'Event', 'Surface', 'Tab', 'Step', 'Role'],
      visibleUsages.map((r) => [r.app, r.event, r.surface, r.tab, r.step, r.role]),
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Event catalog</h2>
          <p>
            Every Firebase event the dashboard maps for Banknote and Coinzy.
            Names are suffix-stripped (`_android` / `_ios`). Live hit counts are on Event inventory.
          </p>
        </div>
      </div>

      <div className="page-content">
        {catalog.isLoading && <div className="empty-state">Loading catalog…</div>}
        {catalog.error && (
          <div className="empty-state error">{catalog.error.message}</div>
        )}

        {summary && (
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="label">Banknote events</div>
              <div className="value">{summary.banknote}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Coinzy events</div>
              <div className="value">{summary.coinzy}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Same name on both</div>
              <div className="value">{summary.shared}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Mapped usages</div>
              <div className="value">{summary.totalUsages}</div>
            </div>
          </div>
        )}

        <div className="events-toolbar catalog-toolbar">
          <div className="catalog-app-filter">
            {([
              ['all', 'Both apps'],
              ['banknote', 'Banknote'],
              ['coinzy', 'Coinzy'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={app === id ? 'active' : ''}
                onClick={() => setApp(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search event, tab, or funnel…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" onClick={downloadUnique} disabled={visibleUnique.length === 0}>
            <Download size={14} /> Unique events CSV
          </button>
          <button type="button" onClick={downloadUsages} disabled={visibleUsages.length === 0}>
            <Download size={14} /> Full usage CSV
          </button>
        </div>

        <p className="muted small catalog-count">
          Showing {visibleUnique.length} unique events
          {q || app !== 'all' ? ` (filtered from ${unique.length})` : ''}.
          Unique CSV is one row per app × event. Full usage CSV is every funnel step and KPI that uses it.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Event</th>
                <th>Used in</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {visibleUnique.map((r: EventCatalogUniqueRow) => (
                <tr key={`${r.product}:${r.event}`}>
                  <td>{r.app}</td>
                  <td className="mono">{r.event}</td>
                  <td className="catalog-used-in">{r.used_in}</td>
                  <td className="muted">{r.roles_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!catalog.isLoading && visibleUnique.length === 0 && (
            <div className="empty-state">No mapped events match this filter.</div>
          )}
        </div>
      </div>
    </>
  );
}
