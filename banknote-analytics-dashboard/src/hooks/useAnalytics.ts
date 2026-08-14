import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchConfig,
  fetchDashboardStatus,
  fetchExecutive,
  fetchKpi,
  runDashboardQuery,
  fetchFunnel,
  fetchEventInventory,
  fetchEventDetail,
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

export function useKpi(params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey('kpi', p),
    queryFn: () => fetchKpi(p),
    staleTime: STALE_TIME.DAILY,
    enabled,
  });
}

export function useExecutive(params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey('executive', p),
    queryFn: () => fetchExecutive(p),
    staleTime: STALE_TIME.DAILY,
    enabled: enabled && productId !== 'compare',
  });
}

export function useDashboardMetric(name: string, params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  const product =
    name.startsWith('compare') || productId === 'compare'
      ? name.startsWith('compare')
        ? 'compare'
        : productId
      : productId;
  const p = withProduct(params, product);
  const staleTime = name === 'events' ? STALE_TIME.EVENTS : STALE_TIME.DAILY;
  return useQuery({
    queryKey: queryKey(`dashboard:${name}`, p),
    queryFn: () => runDashboardQuery(name, p),
    staleTime,
    enabled,
    select: (data) => data.rows,
  });
}

export function useRetention(params: QueryParams, enabled = true) {
  return useDashboardMetric('d1', params, enabled);
}

export function useFunnel(funnelId: string, params: QueryParams, enabled = true) {
  const { productId } = useProduct();
  const p = withProduct(params, productId);
  return useQuery({
    queryKey: queryKey(`funnel:${funnelId}`, p),
    queryFn: () => fetchFunnel(funnelId, p),
    staleTime: STALE_TIME.EVENTS,
    enabled: enabled && productId !== 'compare',
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
    staleTime: STALE_TIME.EVENTS,
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
