import { describe, expect, it } from 'vitest';
import { LOCALES, detectLocale, translator } from '.';
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

  it('formate les montants en euros selon la langue', () => {
    expect(translator('fr').money(2_500_000)).toBe('25 000 €');
    expect(translator('en').money(2_500_000)).toBe('€25,000');
    expect(translator('de').money(180_050)).toBe('1.800,5 €');
    expect(translator('ja').money(4_000)).toBe('€40');
  });
});
