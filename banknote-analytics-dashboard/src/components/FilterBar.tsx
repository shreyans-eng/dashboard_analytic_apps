import { useMemo } from 'react';
import { QueryParams } from '@/lib/api';
import { useDashboardMetric } from '@/hooks/useAnalytics';

interface Props {
  params: QueryParams;
  onChange: (p: QueryParams) => void;
  onApply: () => void;
}

export default function FilterBar({ params, onChange, onApply }: Props) {
  // Load country options from the same date range (no country/platform filter).
  const listParams = useMemo(
    () => ({
      start_date: params.start_date,
      end_date: params.end_date,
    }),
    [params.start_date, params.end_date],
  );
  const countriesQ = useDashboardMetric('countries', listParams);

  const countries = useMemo(() => {
    const fromApi = (countriesQ.data ?? [])
      .map((r) => String(r.country ?? '').trim())
      .filter((c) => c && c !== 'Unknown');
    const selected = params.country?.trim();
    const set = new Set(fromApi);
    if (selected) set.add(selected);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countriesQ.data, params.country]);

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
          disabled={countriesQ.isLoading && countries.length === 0}
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
      <button type="button" onClick={onApply}>Apply</button>
    </div>
  );
}
