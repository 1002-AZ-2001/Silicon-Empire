import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { zh } from './zh';
import { FRACTION_DIGITS, convert, defaultCurrency, isCurrency } from './currency';
import type { Currency } from './currency';
import type { Messages } from './fr';

export type { Messages } from './fr';
export type { Currency } from './currency';
export { CURRENCIES, RATES, convert, defaultCurrency } from './currency';

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
const CURRENCY_KEY = 'silicon-empire.currency';
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

function systemLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

function initialLocale(): Locale {
  if (typeof navigator === 'undefined') return FALLBACK;
  return storedLocale() ?? detectLocale(systemLanguages());
}

/** Chosen display currency; `auto` follows the language. */
export type CurrencyChoice = Currency | 'auto';

function storedCurrency(): CurrencyChoice {
  try {
    const value = localStorage.getItem(CURRENCY_KEY);
    return isCurrency(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

const localeStore = createStore<{ locale: Locale; currency: CurrencyChoice }>(() => ({
  locale: initialLocale(),
  currency: storedCurrency(),
}));

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

/** Changes the display currency and remembers it on this device. */
export function setCurrency(currency: CurrencyChoice) {
  localeStore.setState({ currency });
  try {
    if (currency === 'auto') localStorage.removeItem(CURRENCY_KEY);
    else localStorage.setItem(CURRENCY_KEY, currency);
  } catch {
    // The choice still applies for this session.
  }
}

/** Currency used for a language and a choice; `auto` follows the language and the system region. */
export function resolveCurrency(locale: Locale, choice: CurrencyChoice, preferences = systemLanguages()): Currency {
  return choice === 'auto' ? defaultCurrency(locale, preferences) : choice;
}

export interface Translator {
  readonly locale: Locale;
  readonly currency: Currency;
  readonly t: Messages;
  /** Amount in euro cents, converted to the display currency and formatted for the language. */
  money(cents: number): string;
  /** Name of a currency in the language, for the selector. */
  currencyName(currency: Currency): string;
  date(timestamp: number): string;
}

const translators = new Map<string, Translator>();

/** Formatting tag: US English for the dollar, so that it reads `$` rather than `US$`. */
function moneyTag(locale: Locale, currency: Currency): string {
  return locale === 'en' && currency === 'USD' ? 'en-US' : TAGS[locale];
}

export function translator(locale: Locale, currency: Currency = defaultCurrency(locale)): Translator {
  const key = `${locale}:${currency}`;
  let cached = translators.get(key);
  if (!cached) {
    const format = new Intl.NumberFormat(moneyTag(locale, currency), {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: FRACTION_DIGITS[currency],
    });
    const names = new Intl.DisplayNames([TAGS[locale]], { type: 'currency' });
    const dates = new Intl.DateTimeFormat(TAGS[locale], { dateStyle: 'medium', timeStyle: 'short' });
    cached = {
      locale,
      currency,
      t: DICTIONARIES[locale],
      money: cents => format.format(convert(cents, currency)),
      currencyName: code => names.of(code) ?? code,
      date: timestamp => dates.format(timestamp),
    };
    translators.set(key, cached);
  }
  return cached;
}

/** Translator for code outside React components. */
export function currentTranslator(): Translator {
  const { locale, currency } = localeStore.getState();
  return translator(locale, resolveCurrency(locale, currency));
}

/** Current display currency choice, for the selector. */
export function useCurrencyChoice(): CurrencyChoice {
  return useStore(localeStore, state => state.currency);
}

export function useI18n(): Translator {
  const locale = useStore(localeStore, state => state.locale);
  const choice = useStore(localeStore, state => state.currency);
  return translator(locale, resolveCurrency(locale, choice));
}
