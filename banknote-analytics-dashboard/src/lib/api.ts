import type { AccessMeta, AuthUser } from '@/lib/access';

export interface QueryParams {
  start_date?: string;
  end_date?: string;
  country?: string;
  platform?: string;
  install_channel?: string;
  days?: number;
  /** banknote | coinzy | compare */
  product?: string;
  page?: number;
  page_size?: number;
  search?: string;
  paginate?: boolean | string;
}

export interface QueryResult {
  sql: string;
  rows: Record<string, unknown>[];
  count: number;
  total?: number;
  page?: number;
  page_size?: number;
  page_count?: number;
  daily?: Record<string, unknown>[];
  by_channel?: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  countries?: string[];
  bytesProcessed?: number;
  cached?: boolean;
  error?: string;
  products?: string[];
  summary?: Record<string, unknown>[];
  warnings?: string[];
  source?: string;
  refreshed_at?: string | Date | null;
  latestCompleteDate?: string | null;
  incompleteDates?: boolean;
  dataUnavailable?: boolean;
  /** Compare-ltv: per-product sources */
  sources?: { product: string; source: string | null }[];
  yearly_list_price?: number | null;
  yearly_list_prices?: Record<string, number>;
  packs?: Record<string, unknown>[];
}

export interface KpiSummary {
  dau: number | null;
  mau: number;
  newUsers: number;
  d1: number;
  d7: number;
}

export interface DashboardStatus {
  lastRefresh: string | null;
  tables: Record<string, string | null>;
  intraday: { intradayEnabled: boolean; checkedAt: string | null };
  latestCompleteDate?: string | null;
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

export interface SqlFile {
  dir: string;
  name: string;
  path: string;
}

export interface SavedQuery {
  path: string;
  dir: string;
  name: string;
  source: 'disk' | 'custom';
  dirty: boolean;
  sqlLength: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  sql?: string;
  diskSql?: string | null;
}

export interface QueryLibraryList {
  mongo: boolean;
  queries: SavedQuery[];
  message?: string;
}

export interface FunnelRow {
  step_order?: number;
  step_id?: string;
  step_label?: string;
  event_names?: string;
  is_core?: boolean;
  is_drop?: boolean;
  users?: number;
  once_users?: number;
  repeat_users?: number;
  hits?: number;
  dau?: number;
  pct_of_dau?: number;
  hits_per_user?: number;
  repeat_share?: number;
  prev_users?: number;
  pct_of_previous?: number;
  drop_off_users?: number;
  drop_off_rate?: number;
}

export interface FunnelPackRow {
  pack_name?: string;
  discount_type?: string;
  users?: number;
  hits?: number;
  hits_per_user?: number;
  confirmed_users?: number;
  confirm_rate?: number;
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
  packs?: FunnelPackRow[];
  count: number;
  bytesProcessed?: number;
  steps?: { id: string; label: string; events: string[]; core: boolean; isDrop: boolean }[];
  sql?: string;
  packSql?: string | null;
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
  unique_users_note?: string;
  rows: EventInventoryRow[];
  count: number;
  bytesProcessed?: number;
}

export interface EventCatalogUsageRow {
  product: string;
  app: string;
  event: string;
  surface: string;
  tab: string;
  step: string;
  role: string;
}

export interface EventCatalogUniqueRow {
  product: string;
  app: string;
  event: string;
  surfaces: string[];
  roles: string[];
  tabs: string[];
  used_in: string;
  roles_label: string;
  origin: 'app' | 'ga4' | 'dashboard-only';
  in_app: boolean;
  shared_name: boolean;
}

export interface EventCatalogResult {
  usages: EventCatalogUsageRow[];
  unique: EventCatalogUniqueRow[];
  summary: {
    banknote: number;
    coinzy: number;
    shared: number;
    inApp?: number;
    dashboardOnly?: number;
    sharedNames?: number;
    totalUsages: number;
  };
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
  user?: AuthUser | string;
  authDisabled?: boolean;
}> {
  const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
  return r.json();
}

export async function login(username: string, password: string): Promise<{ ok: boolean; user?: AuthUser | string }> {
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

export async function resetPassword(body: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; message?: string }> {
  const r = await fetch(`${API}/auth/forgot-password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Could not reset password');
  return data;
}

function asAuthUser(user: AuthUser | string | undefined, fallbackUsername?: string): AuthUser | null {
  if (!user) {
    return fallbackUsername
      ? {
          id: fallbackUsername,
          username: fallbackUsername,
          displayName: fallbackUsername,
          role: 'admin',
          active: true,
          isAdmin: true,
          permissions: { products: ['*'], pages: ['*'] },
        }
      : null;
  }
  if (typeof user === 'string') {
    return {
      id: user,
      username: user,
      displayName: user,
      role: 'admin',
      active: true,
      isAdmin: true,
      permissions: { products: ['*'], pages: ['*'] },
    };
  }
  return user;
}

export { asAuthUser };

export async function fetchAccessMeta(): Promise<AccessMeta> {
  return request('/admin/meta');
}

export async function listDashboardUsers(params?: {
  page?: number;
  limit?: number;
  q?: string;
  product?: string;
}): Promise<{ users: AuthUser[]; total: number; page: number; limit: number; pages: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.q) qs.set('q', params.q);
  if (params?.product) qs.set('product', params.product);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request(`/admin/users${suffix}`);
}

export async function createDashboardUser(body: {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
  receiveReports?: boolean;
  role?: 'admin' | 'sub_admin';
  permissions?: { products: string[]; pages: string[] };
}): Promise<AuthUser> {
  const data = await post<{ user: AuthUser }>('/admin/users', body);
  return data.user;
}

export async function updateDashboardUser(
  id: string,
  body: {
    displayName?: string;
    email?: string;
    receiveReports?: boolean;
    role?: 'admin' | 'sub_admin';
    active?: boolean;
    permissions?: { products: string[]; pages: string[] };
    password?: string;
  },
): Promise<AuthUser> {
  return request<{ user: AuthUser }>(`/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((data) => data.user);
}

export async function deleteDashboardUser(id: string): Promise<void> {
  await request(`/admin/users/${id}`, { method: 'DELETE' });
}

export interface ReportSettings {
  enabled: boolean;
  sendToUsers: boolean;
  extraRecipients: string[];
  lastSentKey: string | null;
  lastSentAt: string | null;
  smtp: { configured: boolean; host: string; from: string };
}

export async function fetchReportSettings(): Promise<{ settings: ReportSettings; period: { start_date: string; end_date: string; key: string; label: string } }> {
  return request('/admin/reports');
}

export async function saveReportSettings(body: {
  enabled?: boolean;
  sendToUsers?: boolean;
  extraRecipients?: string[];
}): Promise<ReportSettings> {
  const data = await request<{ settings: ReportSettings }>('/admin/reports', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return data.settings;
}

export async function sendMonthlyReportsNow(): Promise<{
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  period?: { key: string; label: string };
  sent?: { product: string; to?: string[]; skipped?: boolean; reason?: string }[];
}> {
  return post('/admin/reports/send', {});
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

export async function fetchEventCatalog(): Promise<EventCatalogResult> {
  return request('/analytics/events/catalog');
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

export async function listSavedQueries(): Promise<QueryLibraryList> {
  return request('/queries');
}

export async function importSavedQueries(force = false): Promise<QueryLibraryList & { inserted?: number; updated?: number; skipped?: number; total?: number }> {
  return post('/queries/import', { force });
}

export async function loadSavedQuery(relPath: string): Promise<SavedQuery> {
  return request(`/queries/content?path=${encodeURIComponent(relPath)}`);
}

export async function saveSavedQuery(relPath: string, sql: string): Promise<{ ok: boolean; query: SavedQuery }> {
  return request('/queries', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relPath, sql }),
  });
}

export async function revertSavedQuery(relPath: string): Promise<{ ok: boolean; query: SavedQuery }> {
  return post('/queries/revert', { path: relPath });
}

export async function createSavedQuery(name: string, sql: string): Promise<{ ok: boolean; query: SavedQuery }> {
  return post('/queries/custom', { name, sql });
}

export async function deleteSavedQuery(relPath: string): Promise<{ ok: boolean; path: string }> {
  return request(`/queries?path=${encodeURIComponent(relPath)}`, { method: 'DELETE' });
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

export function fmtDecimal(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return fmtNumber(n);
  return n.toFixed(digits);
}

export function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1000) return `$${fmtNumber(v)}`;
  return `$${v.toFixed(2)}`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
