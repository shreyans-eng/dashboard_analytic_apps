export interface QueryParams {
  start_date?: string;
  end_date?: string;
  country?: string;
  platform?: string;
  days?: number;
  /** banknote | coinzy | compare */
  product?: string;
}

export interface QueryResult {
  sql: string;
  rows: Record<string, unknown>[];
  count: number;
  bytesProcessed?: number;
  cached?: boolean;
  error?: string;
  products?: string[];
}

export interface KpiSummary {
  dau: number;
  mau: number;
  newUsers: number;
  d1: number;
  d7: number;
}

export interface DashboardStatus {
  lastRefresh: string | null;
  tables: Record<string, string | null>;
  intraday: { intradayEnabled: boolean; checkedAt: string | null };
  summaryDataset?: string;
  product?: string;
  project?: string;
  dataset?: string;
}

export interface ProductConfigInfo {
  id: string;
  label: string;
  project: string;
  dataset: string;
  credentialsConfigured: boolean;
  preferRaw?: boolean;
  useSummary?: boolean;
  color?: string;
}

export interface AppConfig {
  project: string;
  dataset: string;
  summaryDataset: string;
  credentialsConfigured: boolean;
  useSummaryTables: boolean;
  cacheBackend: string;
  intraday: { intradayEnabled: boolean; checkedAt: string | null };
  products?: ProductConfigInfo[];
  primaryProduct?: string;
}

export interface ExecutivePayload {
  kpi: KpiSummary;
  dau: Record<string, unknown>[];
  mau: Record<string, unknown>[];
  newUsers: Record<string, unknown>[];
  countries: Record<string, unknown>[];
  platform: Record<string, unknown>[];
  events: Record<string, unknown>[];
  retention: Record<string, unknown>[];
  cached?: boolean;
}

export interface SqlFile {
  dir: string;
  name: string;
  path: string;
}

export interface FunnelRow {
  step_order?: number;
  step_id?: string;
  step_label?: string;
  event_names?: string;
  is_core?: boolean;
  is_drop?: boolean;
  users?: number;
  hits?: number;
  dau?: number;
  pct_of_dau?: number;
  hits_per_user?: number;
  prev_users?: number;
  pct_of_previous?: number;
  drop_off_users?: number;
  drop_off_rate?: number;
}

export interface FunnelResult {
  product: string;
  funnelId: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  message?: string | null;
  identity?: string;
  source?: string;
  rows: FunnelRow[];
  count: number;
  bytesProcessed?: number;
  steps?: { id: string; label: string; events: string[]; core: boolean; isDrop: boolean }[];
  sql?: string;
}

export interface EventInventoryRow {
  event_name: string;
  hits: number;
  unique_users: number;
  first_seen?: string;
  last_seen?: string;
  hits_per_user?: number;
}

export interface EventInventoryResult {
  product: string;
  start_date: string;
  end_date: string;
  search?: string;
  source?: string;
  rows: EventInventoryRow[];
  count: number;
  bytesProcessed?: number;
}

export interface EventDetailResult {
  product: string;
  event_name: string;
  start_date: string;
  end_date: string;
  source?: string;
  hits: number;
  unique_users?: number;
  hits_per_user?: number | null;
  unique_users_note?: string;
  daily: { event_date: string; hits: number; unique_users: number }[];
  parameters: {
    parameter_name: string;
    parameter_type: string;
    example_value?: string;
    occurrence_count: number;
  }[];
}

const API = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
  });
  if (r.status === 401) {
    window.dispatchEvent(new Event('dashboard-auth-required'));
    throw new Error('Authentication required');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  return data as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchAuthMe(): Promise<{
  authenticated: boolean;
  user?: string;
  authDisabled?: boolean;
}> {
  const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
  return r.json();
}

export async function login(username: string, password: string): Promise<{ ok: boolean; user?: string }> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function logout(): Promise<void> {
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export async function fetchConfig(): Promise<AppConfig> {
  return request('/config');
}

export async function fetchDashboardStatus(product?: string): Promise<DashboardStatus> {
  const q = product ? `?product=${encodeURIComponent(product)}` : '';
  return request(`/dashboard/status${q}`);
}

export async function fetchKpi(params: QueryParams): Promise<KpiSummary> {
  return post('/kpi', params);
}

export async function fetchExecutive(params: QueryParams): Promise<ExecutivePayload> {
  return post('/dashboard/executive', params);
}

export async function runDashboardQuery(name: string, params: QueryParams): Promise<QueryResult> {
  return post(`/query/dashboard/${name}`, params);
}

export async function runCustomSql(sql: string, params?: QueryParams): Promise<QueryResult> {
  return post('/query/run', { sql, params });
}

export async function fetchFunnel(
  funnelId: string,
  params: QueryParams,
): Promise<FunnelResult> {
  return post(`/analytics/funnels/${funnelId}`, params);
}

export async function fetchEventInventory(
  params: QueryParams & { search?: string },
): Promise<EventInventoryResult> {
  return post('/analytics/events/inventory', params);
}

export async function fetchEventDetail(
  eventName: string,
  params: QueryParams,
): Promise<EventDetailResult> {
  return post('/analytics/events/detail', { ...params, event_name: eventName });
}

export async function listSqlFiles(): Promise<SqlFile[]> {
  return request('/sql/files');
}

export async function loadSqlFile(dir: string, file: string): Promise<string> {
  const rel = `${dir}/${file}`;
  const data = await request<{ content: string }>(`/sql/content?path=${encodeURIComponent(rel)}`);
  return data.content;
}

export function defaultDateRange(days = 30): QueryParams & { days: number } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    days,
  };
}

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
