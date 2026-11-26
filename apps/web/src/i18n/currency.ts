/**
 * Display currencies. Every amount of the simulation stays in euro cents; the interface converts it
 * with a fixed game rate so that a save reads the same whatever the language or currency.
 *
 * Rates are rounded from the euro foreign exchange reference rates published by the European Central
 * Bank in November 2026 (USD 1.12, GBP 0.83, CNY 7.33 to 7.48, JPY 177.85). They never change during
 * a game: the economy of Silicon Empire is fictional and deterministic.
 */
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CNY', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Units of each currency for one euro. */
export const RATES: Readonly<Record<Currency, number>> = {
  EUR: 1,
  USD: 1.12,
  GBP: 0.83,
  CNY: 7.4,
  JPY: 178,
};

/** Smallest unit shown (ISO 4217 minor unit): the yen has no subdivision in use. */
export const FRACTION_DIGITS: Readonly<Record<Currency, number>> = { EUR: 2, USD: 2, GBP: 2, CNY: 2, JPY: 0 };

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/** Converts euro cents to the currency, rounded to its smallest unit shown. */
export function convert(cents: number, currency: Currency): number {
  const scale = 10 ** FRACTION_DIGITS[currency];
  return Math.round(cents * RATES[currency] * scale / 100) / scale;
}

/** Region subtag of a BCP 47 tag, upper case, if any. */
function regionOf(tag: string): string | null {
  const parts = tag.split(/[-_]/).slice(1);
  return parts.find(part => /^[a-z]{2}$/i.test(part))?.toUpperCase() ?? null;
}

/**
 * Default currency for a language, refined by the system region for English:
 * pound in the United Kingdom, euro in Ireland and Malta, dollar elsewhere.
 */
export function defaultCurrency(locale: string, preferences: readonly string[] = []): Currency {
  switch (locale) {
    case 'en': {
      const english = preferences.find(tag => tag.toLowerCase().split(/[-_]/)[0] === 'en');
      const region = english ? regionOf(english) : null;
      if (region === 'GB') return 'GBP';
      if (region === 'IE' || region === 'MT') return 'EUR';
      return 'USD';
    }
    case 'zh': return 'CNY';
    case 'ja': return 'JPY';
    default: return 'EUR';
  }
}
