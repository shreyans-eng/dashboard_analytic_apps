import { useMemo, useState } from 'react';
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
  const [loadCountries, setLoadCountries] = useState(false);
  const useRowCountries = Array.isArray(extraCountries);
  // Load country options from the same date range (no country/platform filter).
  const listParams = useMemo(
    () => ({
      start_date: params.start_date,
      end_date: params.end_date,
    }),
    [params.start_date, params.end_date],
  );
  const countriesQ = useDashboardMetric(
    'countries',
    listParams,
    !useRowCountries && (loadCountries || Boolean(params.country)),
  );

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
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countriesQ.data, extraCountries, params.country, showChannel, useRowCountries]);

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
      <label>
        Country
        <select
          value={params.country || ''}
          onChange={(e) => onChange({ ...params, country: e.target.value || undefined })}
          onFocus={() => setLoadCountries(true)}
          disabled={countriesQ.isLoading && countries.length === 0 && loadCountries}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
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
