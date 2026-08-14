import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { asAuthUser, fetchAuthMe, login as apiLogin, logout as apiLogout } from '@/lib/api';
import type { AuthUser } from '@/lib/access';
import { canAccessPage, canAccessProduct, firstAllowedPath, isAdmin } from '@/lib/access';
import { queryClient } from '@/lib/query-client';

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  canAccessPage: (pageId: string) => boolean;
  canAccessProduct: (productId: string) => boolean;
  firstPath: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchAuthMe();
      const next = me.authenticated ? asAuthUser(me.user) : null;
      setAuthenticated(Boolean(me.authenticated && next));
      setUser(next);
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onNeedAuth = () => {
      setAuthenticated(false);
      setUser(null);
    };
    window.addEventListener('dashboard-auth-required', onNeedAuth);
    return () => window.removeEventListener('dashboard-auth-required', onNeedAuth);
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    const next = asAuthUser(result.user, username);
    setAuthenticated(true);
    setUser(next);
    await queryClient.invalidateQueries({ queryKey: ['config'] });
  };

  const logout = async () => {
    await apiLogout();
    setAuthenticated(false);
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        loading,
        authenticated,
        user,
        login,
        logout,
        canAccessPage: (pageId) => canAccessPage(user, pageId),
        canAccessProduct: (productId) => canAccessProduct(user, productId),
        firstPath: firstAllowedPath(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { isAdmin };
