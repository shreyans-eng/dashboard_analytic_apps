import { useDashboardStatus } from '@/hooks/useAnalytics';
import { fmtDateTime } from '@/lib/api';

export default function LastUpdated() {
  const { data, isLoading } = useDashboardStatus();

  if (isLoading) return <span className="last-updated">Loading status…</span>;

  const intraday = data?.intraday?.intradayEnabled;
  const label = intraday ? 'Auto-refresh every 10 min' : 'Daily export — no polling';

  return (
    <span className="last-updated" title={label}>
      Last updated: {fmtDateTime(data?.lastRefresh ?? null)}
      {!intraday && ' · Daily data'}
    </span>
  );
}
