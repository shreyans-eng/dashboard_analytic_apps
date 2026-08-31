/**
 * Dashboard data hooks. Every query key includes the active product so switching
 * Banknote / Coinzy / Compare does not reuse the wrong cache.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchConfig,
  fetchDashboardStatus,
  fetchKpi,
  runDashboardQuery,
  fetchFunnel,
  fetchEventInventory,
  fetchEventDetail,
  fetchEventCatalog,
  QueryParams,
} from '@/lib/api';
import { queryKey, STALE_TIME, REFETCH_INTERVAL_INTRADAY } from '@/lib/query-client';
import { useAuth } from '@/lib/auth';
import { useProduct } from '@/lib/product';

function withProduct(params: QueryParams, productId: string): QueryParams {
  return { ...params, product: productId };
}

export function useAppConfig() {
  const { authenticated, loading } = useAuth();
  return useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: STALE_TIME.STATUS,
    enabled: authenticated && !loading,
  });
}

export function useDashboardStatus() {
  const { data: config } = useAppConfig();
  const { productId, products } = useProduct();
  const intraday = config?.intraday?.intradayEnabled ?? false;
  const product =
    productId === 'compare'
      ? products[0]?.id || config?.primaryProduct || 'banknote'
      : productId;

  return useQuery({
    queryKey: ['dashboard-status', product],
    queryFn: () => fetchDashboardStatus(product),
    staleTime: STALE_TIME.STATUS,
    refetchInterval: intraday ? REFETCH_INTERVAL_INTRADAY : false,
  });
}

function dashboardQueryVersion(name: string) {
  if (name === 'mvp-time-to-first-scan') return 'v5';
  if (name === 'mvp-scans-per-user') return 'v7';
  if (name === 'install-day-usage') return 'v2';
  if (name === 'd0-d1-percentiles') return 'v1';
  if (name === 'mvp-catalogue' || name === 'mvp-retention') return 'v6';
  if (name === 'mvp-identify-funnel') return 'v5';
  if (name === 'country-list') return 'v2';
  if (name === 'free-scan-quota') return 'v1';
  return 'v4';
}

export function useDashboardMetric(name: string, params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  // compare-* and LTV/subscriptions while on Compare must hit the multi-product facade.
  const product =
    name.startsWith('compare')
    || (name === 'ltv' && productId === 'compare')
    || (name === 'subscription-tiers' && productId === 'compare')
    || ((name === 'country-list' || name === 'countries') && productId === 'compare')
      ? 'compare'
      : productId;
  const p = withProduct(params, product);
  const staleTime = name === 'events' ? STALE_TIME.EVENTS : STALE_TIME.DAILY;
  return useQuery({
    queryKey: queryKey(`dashboard:${name}:${dashboardQueryVersion(name)}`, p),
    queryFn: () => runDashboardQuery(name, p),
    staleTime,
    enabled,
    select: (data) => data.rows,
  });
}

export function useCompareSubscriptions(params: QueryParams, enabled = true) {
  const p = withProduct(params, 'compare');
  return useQuery({
    queryKey: queryKey('dashboard:compare-subscriptions:v1', p),
    queryFn: () => runDashboardQuery('compare-subscriptions', p),
    staleTime: STALE_TIME.DAILY,
    enabled,
  });
}

/** Full LTV payload from MongoDB (`source: mongodb`) with server pagination. */
export function useLtv(params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey('dashboard:ltv:v5', p),
    queryFn: () => runDashboardQuery('ltv', p),
    staleTime: STALE_TIME.DAILY,
    enabled: enabled && productId !== 'compare',
  });
}

export function useCompareLtv(params: QueryParams, enabled = true) {
  const p = withProduct({ ...params, paginate: false }, 'compare');
  return useQuery({
    queryKey: queryKey('dashboard:compare-ltv:v5', p),
    queryFn: () => runDashboardQuery('compare-ltv', p),
    staleTime: STALE_TIME.DAILY,
    enabled,
  });
}

export function useRetention(params: QueryParams, enabled = true) {
  return useDashboardMetric('d1', params, enabled);
}

export function useFunnel(funnelId: string, params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey(`funnel:${funnelId}:v20`, p),
    queryFn: () => fetchFunnel(funnelId, p),
    staleTime: STALE_TIME.DAILY,
    enabled: enabled && productId !== 'compare',
  });
}

/** Fetch a dashboard metric for an explicit app, ignoring the sidebar product switcher. */
export function useScopedDashboardMetric(
  name: string,
  params: QueryParams,
  productId: string | undefined,
  enabled = true,
) {
  const p = withProduct(params, productId || '');
  const staleTime = name === 'events' ? STALE_TIME.EVENTS : STALE_TIME.DAILY;
  return useQuery({
    queryKey: queryKey(`dashboard:${name}:${dashboardQueryVersion(name)}`, p),
    queryFn: () => runDashboardQuery(name, p),
    staleTime,
    enabled: enabled && Boolean(productId) && productId !== 'compare',
    select: (data) => data.rows,
  });
}

export function useScopedFunnel(
  funnelId: string,
  params: QueryParams,
  productId: string | undefined,
  enabled = true,
) {
  const p = withProduct(params, productId || '');
  return useQuery({
    queryKey: queryKey(`funnel:${funnelId}:v20`, p),
    queryFn: () => fetchFunnel(funnelId, p),
    staleTime: STALE_TIME.DAILY,
    enabled: enabled && Boolean(productId) && productId !== 'compare',
  });
}

export function useScopedKpi(params: QueryParams, productId: string | undefined, enabled = true) {
  const p = withProduct(params, productId || '');
  return useQuery({
    queryKey: queryKey('kpi', p),
    queryFn: () => fetchKpi(p),
    staleTime: STALE_TIME.DAILY,
    enabled: enabled && Boolean(productId) && productId !== 'compare',
  });
}

export function useEventCatalog() {
  const { authenticated, loading } = useAuth();
  return useQuery({
    queryKey: ['event-catalog'],
    queryFn: fetchEventCatalog,
    staleTime: STALE_TIME.STATUS,
    enabled: authenticated && !loading,
  });
}

export function useEventInventory(
  params: QueryParams & { search?: string },
  enabled = true,
) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey('event-inventory', p),
    queryFn: () => fetchEventInventory(p),
    staleTime: STALE_TIME.DAILY,
    enabled: enabled && productId !== 'compare',
  });
}

export function useEventDetail(
  eventName: string | null,
  params: QueryParams,
  enabled = true,
) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey(`event-detail:${eventName || ''}`, p),
    queryFn: () => fetchEventDetail(eventName!, p),
    staleTime: STALE_TIME.EVENTS,
    enabled: enabled && Boolean(eventName) && productId !== 'compare',
  });
}

export function useInvalidateDashboard() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries();
  };
}
