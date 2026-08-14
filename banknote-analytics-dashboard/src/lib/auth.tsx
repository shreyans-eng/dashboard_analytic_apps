import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchAuthMe, login as apiLogin, logout as apiLogout } from '@/lib/api';

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  user: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchAuthMe();
      setAuthenticated(Boolean(me.authenticated));
      setUser(me.user || null);
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
    setAuthenticated(true);
    setUser(result.user || username);
  };

  const logout = async () => {
    await apiLogout();
    setAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ loading, authenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
