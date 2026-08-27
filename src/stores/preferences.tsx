import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

interface Preferences {
  readonly version: 1;
  readonly theme: ThemePreference;
  readonly saveRecentJobs: boolean;
  readonly reducedMotion: 'system' | 'reduce';
}

interface PreferencesContextValue {
  readonly preferences: Preferences;
  readonly resolvedTheme: 'light' | 'dark';
  readonly setTheme: (theme: ThemePreference) => void;
  readonly setSaveRecentJobs: (enabled: boolean) => void;
  readonly setReducedMotion: (preference: Preferences['reducedMotion']) => void;
}

const STORAGE_KEY = 'pixavelo:preferences:v1';

const defaultPreferences: Preferences = {
  version: 1,
  theme: 'system',
  saveRecentJobs: false,
  reducedMotion: 'system'
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readPreferences(): Preferences {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return defaultPreferences;

    const value: unknown = JSON.parse(rawValue);
    if (!isPreferences(value)) return defaultPreferences;
    return value;
  } catch {
    return defaultPreferences;
  }
}

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<Preferences>;
  return (
    candidate.version === 1 &&
    (candidate.theme === 'light' || candidate.theme === 'dark' || candidate.theme === 'system') &&
    typeof candidate.saveRecentJobs === 'boolean' &&
    (candidate.reducedMotion === 'system' || candidate.reducedMotion === 'reduce')
  );
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function PreferencesProvider({ children }: { readonly children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);
  const resolvedTheme = preferences.theme === 'system' ? systemTheme : preferences.theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.motion = preferences.reducedMotion;
    document.documentElement.style.colorScheme = resolvedTheme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolvedTheme === 'dark' ? '#070b13' : '#f4f6fb');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Preferences remain usable in memory when browser storage is unavailable.
    }
  }, [preferences, resolvedTheme]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreferences((current) => ({ ...current, theme }));
  }, []);

  const setSaveRecentJobs = useCallback((saveRecentJobs: boolean) => {
    setPreferences((current) => ({ ...current, saveRecentJobs }));
  }, []);

  const setReducedMotion = useCallback((reducedMotion: Preferences['reducedMotion']) => {
    setPreferences((current) => ({ ...current, reducedMotion }));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      resolvedTheme,
      setTheme,
      setSaveRecentJobs,
      setReducedMotion
    }),
    [preferences, resolvedTheme, setReducedMotion, setSaveRecentJobs, setTheme]
  );

  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider.');
  return context;
}
