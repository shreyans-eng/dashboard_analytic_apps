import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useEventDetail, useEventInventory } from '@/hooks/useAnalytics';
import { fmtNumber, QueryParams } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';

interface Props {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

export default function EventsExplorerPage({ params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { chart } = useTheme();

  const inventory = useEventInventory({ ...params, search: appliedSearch }, !isCompare);
  const detail = useEventDetail(selected, params, Boolean(selected) && !isCompare);
  const rows = inventory.data?.rows || [];

  const tipStyle = useMemo(
    () => ({
      background: chart.tooltipBg,
      border: `1px solid ${chart.tooltipBorder}`,
      color: 'var(--text)',
    }),
    [chart],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Event inventory</h2>
          <p>
            Live Firebase events from BigQuery · {product.shortName}
            {inventory.data?.source ? ` · source: ${inventory.data.source}` : ''}
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {inventory.data?.unique_users_note && !isCompare && (
          <p className="muted small" style={{ marginBottom: 12 }}>{inventory.data.unique_users_note}</p>
        )}
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> to inspect events.
          </div>
        )}

        {!isCompare && (
          <>
            <div className="events-toolbar">
              <input
                type="search"
                placeholder="Search event name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedSearch(search.trim());
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setAppliedSearch(search.trim());
                  applyFilters();
                }}
              >
                Search
              </button>
            </div>

            {inventory.isLoading && <div className="empty-state">Loading events…</div>}
            {inventory.error && (
              <div className="empty-state error">{inventory.error.message}</div>
            )}

            <div className="events-layout">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Hits</th>
                      <th>Users</th>
                      <th>Hits/user</th>
                      <th>First</th>
                      <th>Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const name = String(r.event_name);
                      return (
                        <tr
                          key={name}
                          className={selected === name ? 'selected' : ''}
                          onClick={() => setSelected(name)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="mono">{name}</td>
                          <td>{fmtNumber(Number(r.hits || 0))}</td>
                          <td>{fmtNumber(Number(r.unique_users || 0))}</td>
                          <td>{Number(r.hits_per_user || 0).toFixed(2)}</td>
                          <td>{String(r.first_seen || '').slice(0, 10)}</td>
                          <td>{String(r.last_seen || '').slice(0, 10)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!inventory.isLoading && rows.length === 0 && (
                  <div className="empty-state">No events in this date range.</div>
                )}
              </div>

              <div className="events-detail">
                {!selected && (
                  <div className="empty-state">Select an event to see daily trend and parameters.</div>
                )}
                {selected && (
                  <>
                    <h3 className="mono">{selected}</h3>
                    <p className="muted">
                      Range: {fmtNumber(Number(detail.data?.hits || 0))} hits ·{' '}
                      {fmtNumber(Number(detail.data?.unique_users || 0))} unique users
                      {detail.data?.hits_per_user != null
                        ? ` · ${Number(detail.data.hits_per_user).toFixed(2)} hits/user`
                        : ''}
                    </p>
                    <p className="muted small">{detail.data?.unique_users_note}</p>

                    <ChartCard title="Daily hits vs unique users" loading={detail.isLoading}>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={detail.data?.daily || []}>
                          <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="event_date"
                            tick={{ fill: chart.tick, fontSize: 11 }}
                            tickFormatter={(v) => String(v).slice(5)}
                          />
                          <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                          <Tooltip contentStyle={tipStyle} />
                          <Line type="monotone" dataKey="hits" stroke="#4f8cff" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="unique_users" stroke="#34d399" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Parameter</th>
                            <th>Type</th>
                            <th>Example</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.data?.parameters || []).map((p) => (
                            <tr key={`${p.parameter_name}-${p.parameter_type}`}>
                              <td className="mono">{String(p.parameter_name)}</td>
                              <td>{String(p.parameter_type)}</td>
                              <td className="mono muted">{String(p.example_value ?? '')}</td>
                              <td>{fmtNumber(Number(p.occurrence_count || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!detail.isLoading && !(detail.data?.parameters || []).length && (
                        <div className="empty-state">No parameters for this event in range.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
