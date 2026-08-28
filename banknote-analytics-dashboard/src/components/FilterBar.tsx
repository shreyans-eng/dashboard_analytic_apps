import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryParams, defaultDateRange } from '@/lib/api';
import { useDashboardMetric } from '@/hooks/useAnalytics';

interface Props {
  params: QueryParams;
  onChange: (p: QueryParams) => void;
  onApply: (next?: QueryParams) => void;
  showChannel?: boolean;
  showPresets?: boolean;
  extraCountries?: string[];
}

export default function FilterBar({
  params,
  onChange,
  onApply,
  showChannel = false,
  showPresets = false,
  extraCountries,
}: Props) {
  const useRowCountries = Array.isArray(extraCountries) && extraCountries.length > 0;
  const listParams = useMemo(
    () => ({
      start_date: params.start_date,
      end_date: params.end_date,
    }),
    [params.start_date, params.end_date],
  );
  const countriesQ = useDashboardMetric('country-list', listParams, !useRowCountries);

  const countries = useMemo(() => {
    const fromApi = useRowCountries
      ? extraCountries
      : (countriesQ.data ?? [])
          .map((r) => String(r.country ?? '').trim())
          .filter((c) => c && (showChannel || c !== 'Unknown'));
    const selected = params.country?.trim();
    const set = new Set(fromApi.map((c) => String(c || '').trim()).filter(Boolean));
    if (selected) set.add(selected);
    if (showChannel) set.add('Unknown');
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [countriesQ.data, extraCountries, params.country, showChannel, useRowCountries]);

  const loadingList = !useRowCountries && countriesQ.isFetching && countries.length === 0;
  const loadFailed = !useRowCountries && Boolean(countriesQ.error) && countries.length === 0;

  return (
    <div className="filters">
      <label>
        Start date
        <input
          type="date"
          value={params.start_date || ''}
          onChange={(e) => onChange({ ...params, start_date: e.target.value })}
        />
      </label>
      <label>
        End date
        <input
          type="date"
          value={params.end_date || ''}
          onChange={(e) => onChange({ ...params, end_date: e.target.value })}
        />
      </label>
      <CountryPicker
        value={params.country || ''}
        countries={countries}
        loading={loadingList}
        failed={loadFailed}
        onChange={(country) => onChange({ ...params, country })}
      />
      <label>
        Platform
        <select
          value={params.platform || ''}
          onChange={(e) => onChange({ ...params, platform: e.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
      </label>
      {showChannel && (
        <label>
          Channel
          <select
            value={params.install_channel || ''}
            onChange={(e) => onChange({ ...params, install_channel: e.target.value || undefined })}
          >
            <option value="">All channels</option>
            <option value="Organic">Organic</option>
            <option value="Paid">Paid</option>
            <option value="Direct">Direct</option>
          </select>
        </label>
      )}
      {showPresets && (
        <div className="ltv-presets" role="group" aria-label="Install date range">
          {[30, 90, 180, 210].map((days) => (
            <button
              key={days}
              type="button"
              className={params.days === days ? 'on' : ''}
              onClick={() => {
                const next = { ...params, ...defaultDateRange(days) };
                onChange(next);
                onApply(next);
              }}
            >
              Last {days}d
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onApply()}>Apply</button>
    </div>
  );
}

function CountryPicker({
  value,
  countries,
  loading,
  failed,
  onChange,
}: {
  value: string;
  countries: string[];
  loading: boolean;
  failed: boolean;
  onChange: (country: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => c.toLowerCase().includes(needle));
  }, [countries, query]);

  let triggerLabel = value || 'All countries';
  if (loading) triggerLabel = 'Loading countries…';
  else if (failed) triggerLabel = 'Could not load countries';

  return (
    <div className="filter-country" ref={rootRef}>
      <span>Country</span>
      <button
        type="button"
        className="filter-country-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Country"
        title={countries.length ? `${countries.length} countries in this date range` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="filter-country-panel">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search countries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search countries"
          />
          <ul role="listbox" aria-label="Countries">
            <li>
              <button
                type="button"
                className={!value ? 'on' : ''}
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                  setQuery('');
                }}
              >
                All countries
              </button>
            </li>
            {filtered.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  className={value === c ? 'on' : ''}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {c}
                </button>
              </li>
            ))}
            {!loading && filtered.length === 0 && (
              <li className="filter-country-empty">No matching countries</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
