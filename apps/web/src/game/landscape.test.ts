import { CALENDAR } from '@silicon-empire/game-data';
import { createWorld } from '@silicon-empire/simulation';
import { describe, expect, it } from 'vitest';
import { seasonOf, seasonOfMonth } from './landscape';

describe('saisons du paysage', () => {
  it('suit les saisons de l’hémisphère nord, de décembre à février pour l’hiver', () => {
    expect([...Array(12).keys()].map(seasonOfMonth)).toEqual([
      'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
    ]);
  });

  it('lit le mois du calendrier de carrière, ou compte les mois depuis janvier ailleurs', () => {
    const july = 6 * CALENDAR.monthTicks;
    expect(seasonOf({ ...createWorld('progression'), tick: july })).toBe('summer');
    expect(seasonOf({ ...createWorld('career', { startYear: 1985 }), tick: july + 3 * CALENDAR.monthTicks })).toBe('autumn');
    expect(seasonOf({ ...createWorld('sandbox'), tick: 13 * CALENDAR.monthTicks })).toBe('winter');
  });
});
