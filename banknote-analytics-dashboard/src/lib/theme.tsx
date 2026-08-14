import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
  chart: {
    grid: string;
    tick: string;
    tooltipBg: string;
    tooltipBorder: string;
  };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('analytics-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function chartTokens(theme: ThemeMode) {
  if (theme === 'light') {
    return {
      grid: '#e2e6ef',
      tick: '#5c6578',
      tooltipBg: '#ffffff',
      tooltipBorder: '#d8dde8',
    };
  }
  return {
    grid: '#2a2f3d',
    tick: '#9aa0b0',
    tooltipBg: '#1a1d27',
    tooltipBorder: '#2a2f3d',
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('analytics-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      chart: chartTokens(theme),
    }),
    [theme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
