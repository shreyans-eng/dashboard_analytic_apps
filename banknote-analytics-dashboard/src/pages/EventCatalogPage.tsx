import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import AppMark from '@/components/AppMark';
import { useEventCatalog } from '@/hooks/useAnalytics';
import type { EventCatalogUniqueRow } from '@/lib/api';

type AppFilter = 'all' | 'banknote' | 'coinzy' | 'shared';

const ORIGIN_LABEL: Record<string, string> = {
  app: 'In app',
  ga4: 'GA4 auto',
  'dashboard-only': 'Not in app',
};

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

function OriginChip({ origin }: { origin: string }) {
  return (
    <span className={`catalog-chip origin-${origin}`}>
      {ORIGIN_LABEL[origin] || origin}
    </span>
  );
}

function EventRowMeta({ row }: { row: EventCatalogUniqueRow }) {
  return (
    <>
      <div className="catalog-chips">
        <OriginChip origin={row.origin} />
        {row.shared_name && <span className="catalog-chip shared">Shared name</span>}
        {row.roles.slice(0, 3).map((role) => (
          <span key={role} className={`catalog-chip role-${role}`}>{role}</span>
        ))}
      </div>
      <div className="catalog-surfaces">
        {row.surfaces.slice(0, 4).map((surface) => (
          <span key={surface} className="catalog-surface">{surface}</span>
        ))}
        {row.surfaces.length > 4 && (
          <span className="catalog-surface more">+{row.surfaces.length - 4}</span>
        )}
      </div>
    </>
  );
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
      if (app === 'shared') {
        if (!r.shared_name) return false;
      } else if (app !== 'all' && r.product !== app) {
        return false;
      }
      if (!q) return true;
      return (
        r.event.toLowerCase().includes(q)
        || r.used_in.toLowerCase().includes(q)
        || r.app.toLowerCase().includes(q)
        || (ORIGIN_LABEL[r.origin] || '').toLowerCase().includes(q)
      );
    });
  }, [unique, app, q]);

  const visibleUsages = useMemo(() => {
    const allowed = new Set(visibleUnique.map((r) => `${r.product}:${r.event}`));
    return usages.filter((r) => allowed.has(`${r.product}:${r.event}`));
  }, [usages, visibleUnique]);

  function downloadUnique(): void {
    downloadCsv(
      `event-catalog-unique-${app}.csv`,
      ['App', 'Event', 'Origin', 'In app', 'Shared name', 'Used in', 'Roles', 'Tabs'],
      visibleUnique.map((r) => [
        r.app,
        r.event,
        r.origin,
        r.in_app ? 'yes' : 'no',
        r.shared_name ? 'yes' : 'no',
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
    <div className="catalog-page">
      <div className="page-header">
        <div>
          <h2>Event catalog</h2>
          <p>
            Dashboard mappings matched to the live app catalogs:
            Banknote <span className="mono">src/util/analytics.ts</span>
            {' · '}
            Coinzy <span className="mono">docs/firebase_events.csv</span>.
            Shared names exist in both apps. GA4 autos are not in those files.
          </p>
        </div>
      </div>

      <div className="page-content">
        {catalog.isLoading && <div className="empty-state">Loading catalog…</div>}
        {catalog.error && (
          <div className="empty-state error">{catalog.error.message}</div>
        )}

        {summary && (
          <div className="catalog-kpis">
            <div className="catalog-kpi banknote">
              <AppMark product="banknote" size={40} />
              <div>
                <div className="label">Banknote</div>
                <div className="value">{summary.banknote}</div>
                <div className="why">Mapped events</div>
              </div>
            </div>
            <div className="catalog-kpi coinzy">
              <AppMark product="coinzy" size={40} />
              <div>
                <div className="label">Coinzy</div>
                <div className="value">{summary.coinzy}</div>
                <div className="why">Mapped events</div>
              </div>
            </div>
            <div className="catalog-kpi shared">
              <div>
                <div className="label">Shared names</div>
                <div className="value">{summary.sharedNames ?? summary.shared}</div>
                <div className="why">Same string in both app catalogs</div>
              </div>
            </div>
            <div className="catalog-kpi">
              <div>
                <div className="label">In app source</div>
                <div className="value">{summary.inApp ?? '—'}</div>
                <div className="why">
                  {summary.dashboardOnly ?? 0} aliases / not in app
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="catalog-legend">
          <span><i className="catalog-dot app" /> Logged in the app</span>
          <span><i className="catalog-dot ga4" /> GA4 automatic</span>
          <span><i className="catalog-dot missing" /> Dashboard alias, not in source</span>
          <span><i className="catalog-dot shared" /> Name exists in both apps</span>
        </div>

        <div className="catalog-toolbar">
          <div className="catalog-app-filter" role="group" aria-label="App">
            <button type="button" className={app === 'all' ? 'active' : ''} onClick={() => setApp('all')}>
              Both apps
            </button>
            <button
              type="button"
              className={`banknote ${app === 'banknote' ? 'active' : ''}`}
              onClick={() => setApp('banknote')}
            >
              <AppMark product="banknote" size={18} />
              Banknote
            </button>
            <button
              type="button"
              className={`coinzy ${app === 'coinzy' ? 'active' : ''}`}
              onClick={() => setApp('coinzy')}
            >
              <AppMark product="coinzy" size={18} />
              Coinzy
            </button>
            <button
              type="button"
              className={`shared ${app === 'shared' ? 'active' : ''}`}
              onClick={() => setApp('shared')}
            >
              Shared names
            </button>
          </div>
          <label className="catalog-search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              placeholder="Search event, tab, or funnel…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="catalog-actions">
            <button type="button" onClick={downloadUnique} disabled={visibleUnique.length === 0}>
              <Download size={14} /> Unique CSV
            </button>
            <button type="button" className="secondary" onClick={downloadUsages} disabled={visibleUsages.length === 0}>
              <Download size={14} /> Usage CSV
            </button>
          </div>
        </div>

        <p className="muted small catalog-count">
          Showing {visibleUnique.length} unique events
          {q || app !== 'all' ? ` (filtered from ${unique.length})` : ''}.
        </p>

        <div className="table-wrap catalog-table-wrap">
          <table>
            <thead>
              <tr>
                <th>App</th>
                <th>Event</th>
                <th>Match</th>
                <th>Used in</th>
              </tr>
            </thead>
            <tbody>
              {visibleUnique.map((r: EventCatalogUniqueRow) => (
                <tr key={`${r.product}:${r.event}`} className={`catalog-row ${r.product}`}>
                  <td>
                    <span className={`catalog-app ${r.product}`}>
                      <AppMark product={r.product} size={22} />
                      {r.app}
                    </span>
                  </td>
                  <td className="mono catalog-event">{r.event}</td>
                  <td>
                    <div className="catalog-chips">
                      <OriginChip origin={r.origin} />
                      {r.shared_name && <span className="catalog-chip shared">Shared</span>}
                    </div>
                  </td>
                  <td className="catalog-used-in">
                    <div className="catalog-surfaces">
                      {r.surfaces.slice(0, 3).map((surface) => (
                        <span key={surface} className="catalog-surface">{surface}</span>
                      ))}
                      {r.surfaces.length > 3 && (
                        <span className="catalog-surface more">+{r.surfaces.length - 3}</span>
                      )}
                    </div>
                    <span className="catalog-roles">{r.roles_label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!catalog.isLoading && visibleUnique.length === 0 && (
            <div className="empty-state">No mapped events match this filter.</div>
          )}
        </div>

        <div className="catalog-cards">
          {visibleUnique.map((r) => (
            <article key={`${r.product}:${r.event}`} className={`catalog-card ${r.product}`}>
              <header>
                <span className={`catalog-app ${r.product}`}>
                  <AppMark product={r.product} size={28} />
                  {r.app}
                </span>
              </header>
              <code className="catalog-event">{r.event}</code>
              <EventRowMeta row={r} />
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
