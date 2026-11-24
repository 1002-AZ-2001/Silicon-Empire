import { WORKSHOP } from '@silicon-empire/game-data';
import { applyCommand, createWorld } from '@silicon-empire/simulation';
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, decodeSave } from './save-data';
import type { SaveRecord } from './save-data';

const built = applyCommand(createWorld(), { kind: 'build', type: 'tester', x: 12, y: 15, rotation: 1 });
if (!built.ok) throw new Error('Le scénario de test doit pouvoir construire une machine.');

const record: SaveRecord = {
  id: '00000000000000000000000000000001',
  name: 'Atelier des pins',
  version: SAVE_VERSION,
  createdAt: 1000,
  savedAt: 2000,
  world: built.world,
};

describe('schéma de sauvegarde', () => {
  it('restaure le capital, l’orientation et le prix réellement payé', () => {
    expect(decodeSave(JSON.parse(JSON.stringify(record)))).toEqual(record);
    const historicalPrice = {
      ...record,
      world: { ...record.world, machines: [{ ...built.machine, paidCents: built.machine.paidCents - 200 }] },
    };
    expect(decodeSave(historicalPrice)).toEqual(historicalPrice);
  });

  it.each([
    null,
    { ...record, version: 2 },
    { ...record, name: '' },
    { ...record, savedAt: 500 },
    { ...record, world: { ...record.world, columns: 32 } },
    { ...record, world: { ...record.world, capitalCents: -1 } },
    { ...record, world: { ...record.world, capitalCents: WORKSHOP.initialCapitalCents } },
    { ...record, world: { ...record.world, nextMachineId: 1 } },
  ])('rejette les versions et états invalides %#', data => {
    expect(decodeSave(data)).toBeNull();
  });

  it.each([
    { ...built.machine, id: 2, y: 16 },
    { ...built.machine, x: 20 },
    { ...built.machine, id: 2, y: 63 },
    { ...built.machine, id: 2, x: 20, rotation: 4 },
    { ...built.machine, id: 2, x: 20, type: 'unknown' },
  ])('rejette les machines incohérentes %#', machine => {
    expect(decodeSave({
      ...record,
      world: {
        ...record.world,
        capitalCents: 0,
        nextMachineId: 3,
        machines: [built.machine, machine],
      },
    })).toBeNull();
  });
});
