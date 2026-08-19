import { t, onLanguageChange } from '../i18n/i18n.ts';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'worldradio:theme';
const listeners = new Set<(theme: Theme) => void>();

export function getTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function onThemeChange(cb: (theme: Theme) => void): void {
  listeners.add(cb);
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* preference just won't persist across reloads */ }
  listeners.forEach(cb => cb(theme));
}

// The initial data-theme attribute is set synchronously by an inline script in
// index.html's <head>, before any stylesheet paints — that's what avoids a flash of
// the wrong theme. This module doesn't need to (and shouldn't) repeat that at startup.

export function initThemeToggle(): void {
  const btn = document.getElementById('btn-theme-toggle')!;
  const updateLabel = (theme: Theme): void => {
    const label = theme === 'light' ? t('header.themeToDark') : t('header.themeToLight');
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };
  updateLabel(getTheme());
  btn.addEventListener('click', () => {
    const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
    setTheme(next);
    updateLabel(next);
  });
  onLanguageChange(() => updateLabel(getTheme()));
}
