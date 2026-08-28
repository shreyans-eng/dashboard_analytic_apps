import { QueryClient } from '@tanstack/react-query';

/** Client-side stale times — align with server cache + Firebase export cadence */
export const STALE_TIME = {
  DAILY: 24 * 60 * 60 * 1000,
  EVENTS: 60 * 60 * 1000,
  STATUS: 5 * 60 * 1000,
};

export const REFETCH_INTERVAL_INTRADAY = 10 * 60 * 1000; // 10 min — never faster than 5 min

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: STALE_TIME.DAILY,
    },
  },
});

export function queryKey(base: string, params: object) {
  return [base, params] as const;
}
