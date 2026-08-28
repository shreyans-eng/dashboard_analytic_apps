import { useDashboardStatus } from '@/hooks/useAnalytics';
import { fmtDateTime } from '@/lib/api';

export default function LastUpdated() {
  const { data, isLoading } = useDashboardStatus();

  if (isLoading) return <span className="last-updated">Loading status…</span>;

  const complete = data?.latestCompleteDate;
  const intraday = data?.intraday?.intradayEnabled;
  const label = complete
    ? `Complete Firebase export through ${complete}. Later dates are not in BigQuery yet.`
    : intraday
      ? 'Auto-refresh every 10 min'
      : 'Daily export — no polling';

  return (
    <span className="last-updated" title={label}>
      {complete
        ? `Complete through ${complete}`
        : `Last updated: ${fmtDateTime(data?.lastRefresh ?? null)}`}
      {!intraday && ' · Daily export'}
    </span>
  );
}
