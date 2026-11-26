import { describe, expect, it } from 'vitest';
import { LOCALES, convert, defaultCurrency, detectLocale, resolveCurrency, translator } from '.';
import { fr } from './fr';

/** Every string of a dictionary, with functions called on sample arguments. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') return [[path, String(value(7, '«X»'))]];
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  }
  return [];
}

describe('langues', () => {
  it('choisit la première langue disponible du système, sinon l’anglais', () => {
    expect(detectLocale(['de-AT', 'fr'])).toBe('de');
    expect(detectLocale(['pt-BR', 'ja-JP'])).toBe('ja');
    expect(detectLocale(['zh-Hans-CN'])).toBe('zh');
    expect(detectLocale(['es_419'])).toBe('es');
    expect(detectLocale(['pt-BR', 'it'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it.each(LOCALES)('fournit des textes non vides et place les valeurs reçues (%s)', locale => {
    const { t } = translator(locale);
    const entries = leaves(t);
    expect(entries.map(([path]) => path)).toEqual(leaves(fr).map(([path]) => path));
    for (const [path, text] of entries) {
      expect(text.trim(), path).not.toBe('');
      expect(text, path).not.toMatch(/undefined|NaN|\[object/);
    }
    expect(t.menu.resume('«X»')).toContain('«X»');
    expect(t.workshop.demolishBody('A', 'B')).toMatch(/A[\s\S]*B/);
    expect(t.inspector.orderButton(10, '1 €')).toContain('10');
    expect(t.updates.installErrors.failed(3)).toContain('3');
  });

  it('formate les montants en euros selon la langue quand l’euro est choisi', () => {
    expect(translator('fr', 'EUR').money(2_500_000)).toBe('25 000 €');
    expect(translator('en', 'EUR').money(2_500_000)).toBe('€25,000');
    expect(translator('de', 'EUR').money(180_050)).toBe('1.800,5 €');
    expect(translator('ja', 'EUR').money(4_000)).toBe('€40');
  });

  it('choisit la monnaie par défaut selon la langue et la région', () => {
    expect(defaultCurrency('fr')).toBe('EUR');
    expect(defaultCurrency('es', ['es-MX'])).toBe('EUR');
    expect(defaultCurrency('de')).toBe('EUR');
    expect(defaultCurrency('zh')).toBe('CNY');
    expect(defaultCurrency('ja')).toBe('JPY');
    expect(defaultCurrency('en', ['en-US'])).toBe('USD');
    expect(defaultCurrency('en', ['fr-FR', 'en-GB'])).toBe('GBP');
    expect(defaultCurrency('en', ['en_IE'])).toBe('EUR');
    expect(defaultCurrency('en', [])).toBe('USD');
    expect(resolveCurrency('fr', 'JPY', ['fr-FR'])).toBe('JPY');
    expect(resolveCurrency('en', 'auto', ['en-GB'])).toBe('GBP');
  });

  it('convertit les euros avec un taux fixe et arrondit à la plus petite unité', () => {
    expect(convert(2_500_000, 'EUR')).toBe(25_000);
    expect(convert(2_500_000, 'USD')).toBe(28_000);
    expect(convert(2_500_000, 'GBP')).toBe(20_750);
    expect(convert(2_500_000, 'CNY')).toBe(185_000);
    expect(convert(2_500_000, 'JPY')).toBe(4_450_000);
    expect(convert(470, 'USD')).toBe(5.26);
    expect(convert(1, 'JPY')).toBe(2);
    expect(translator('en', 'USD').money(2_500_000)).toBe('$28,000');
    expect(translator('en', 'GBP').money(2_500_000)).toBe('£20,750');
    expect(translator('ja', 'JPY').money(2_500_000)).toMatch(/^[¥￥]4,450,000$/);
    expect(translator('zh', 'CNY').money(2_500_000)).toMatch(/^¥185,000$/);
    expect(translator('fr', 'USD').money(2_500_000)).toMatch(/^28\s000\s\$US$/);
  });
});
