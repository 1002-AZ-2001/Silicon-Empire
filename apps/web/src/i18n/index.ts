import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { zh } from './zh';
import type { Messages } from './fr';

export type { Messages } from './fr';

export const LOCALES = ['fr', 'en', 'es', 'de', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

/** Name of each language in that language, for the selector. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  zh: '简体中文',
  ja: '日本語',
};

/** BCP 47 tags for `lang` and number formatting. */
const TAGS: Record<Locale, string> = {
  fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE', zh: 'zh-CN', ja: 'ja-JP',
};

const DICTIONARIES: Record<Locale, Messages> = { fr, en, es, de, zh, ja };
const STORAGE_KEY = 'silicon-empire.locale';
const FALLBACK: Locale = 'en';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** First supported language among the user's preferences, by primary subtag; English otherwise. */
export function detectLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const primary = preference.toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return FALLBACK;
}

function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

function initialLocale(): Locale {
  if (typeof navigator === 'undefined') return FALLBACK;
  return storedLocale() ?? detectLocale(navigator.languages.length > 0 ? navigator.languages : [navigator.language]);
}

const localeStore = createStore<{ locale: Locale }>(() => ({ locale: initialLocale() }));

function applyDocumentLanguage(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = TAGS[locale];
}
applyDocumentLanguage(localeStore.getState().locale);

/** Changes the language and remembers it on this device. */
export function setLocale(locale: Locale) {
  localeStore.setState({ locale });
  applyDocumentLanguage(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // The choice still applies for this session.
  }
}

export interface Translator {
  readonly locale: Locale;
  readonly t: Messages;
  /** Amount in cents, in euros, formatted for the language. */
  money(cents: number): string;
  date(timestamp: number): string;
}

const translators = new Map<Locale, Translator>();

export function translator(locale: Locale): Translator {
  let cached = translators.get(locale);
  if (!cached) {
    const currency = new Intl.NumberFormat(TAGS[locale], {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2,
    });
    const dates = new Intl.DateTimeFormat(TAGS[locale], { dateStyle: 'medium', timeStyle: 'short' });
    cached = {
      locale,
      t: DICTIONARIES[locale],
      money: cents => currency.format(cents / 100),
      date: timestamp => dates.format(timestamp),
    };
    translators.set(locale, cached);
  }
  return cached;
}

/** Translator for code outside React components. */
export function currentTranslator(): Translator {
  return translator(localeStore.getState().locale);
}

export function useI18n(): Translator {
  return translator(useStore(localeStore, state => state.locale));
}
