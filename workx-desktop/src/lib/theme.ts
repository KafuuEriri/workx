export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'workx.theme';

export function readStoredTheme(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

export function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return prefersDark() ? 'dark' : 'light';
  }
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}
