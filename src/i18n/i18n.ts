import { STRINGS, type StringKey } from './strings.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';

export interface LanguageOption {
  code: string;
  label: string;
}

const TRANSLATIONS: Record<string, Partial<Record<StringKey, string>>> = { es, fr };

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

const LANG_KEY = 'worldradio:language';
const listeners = new Set<(lang: string) => void>();

export function getLanguage(): string {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGUAGES.some(l => l.code === saved)) return saved;
  } catch { /* fall through to default */ }
  return 'en';
}

export function setLanguage(lang: string): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch { /* preference just won't persist across reloads */ }
  listeners.forEach(cb => cb(lang));
}

export function onLanguageChange(cb: (lang: string) => void): void {
  listeners.add(cb);
}

/** Translated string for the current language, falling back to English for any key
 *  a translation doesn't cover yet. */
export function t(key: StringKey): string {
  const lang = getLanguage();
  return TRANSLATIONS[lang]?.[key] ?? STRINGS[key];
}

/** Applies translations to every element carrying a data-i18n / data-i18n-title /
 *  data-i18n-placeholder attribute. Call once at startup and again on language change. */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as StringKey;
    el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle as StringKey;
    el.title = t(key);
    el.setAttribute('aria-label', t(key));
  });
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder as StringKey;
    el.placeholder = t(key);
  });
}

export function initI18n(): void {
  const select = document.getElementById('language-select') as HTMLSelectElement;
  select.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${l.label}</option>`).join('');
  select.value = getLanguage();

  select.addEventListener('change', () => setLanguage(select.value));
  onLanguageChange(() => applyTranslations());

  applyTranslations();
}
