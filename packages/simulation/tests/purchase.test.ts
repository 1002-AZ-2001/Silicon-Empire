import { ITEMS, PURCHASE, SUPPLIERS } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, checkPurchase, createWorld, dockSpace, orderCost, purchaseCost, purchaseLineCost, step,
  volumeDiscount,
} from '../src';
import type { Command, PurchaseLine, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

/** Sandbox workshop with one receiving dock (id 1). */
function withDock(): World {
  return run(createWorld(), { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 });
}

describe('boutique', () => {
  it('applique la remise de volume du plus grand palier atteint', () => {
    expect(volumeDiscount(1)).toBe(0);
    expect(volumeDiscount(4)).toBe(0);
    expect(volumeDiscount(5)).toBe(5);
    expect(volumeDiscount(9)).toBe(5);
    expect(volumeDiscount(10)).toBe(10);
    const cpu = ITEMS['cpu-8c'].unitCostCents ?? 0;
    expect(purchaseLineCost({ item: 'cpu-8c', supplier: 'express', lots: 1 })).toBe(orderCost('cpu-8c'));
    expect(purchaseLineCost({ item: 'cpu-8c', supplier: 'express', lots: 5 })).toBe(cpu * PURCHASE.lotSize * 5 * 95 / 100);
    expect(purchaseLineCost({ item: 'cpu-8c', supplier: 'economy', lots: 10 }))
      .toBe(Math.floor(cpu * PURCHASE.lotSize * 10 * SUPPLIERS.economy.pricePercent * 90 / 10_000));
  });

  it('achète tout le panier en une fois : stock immédiat, lots différés réservés au quai', () => {
    const world = withDock();
    const lines: PurchaseLine[] = [
      { item: 'cpu-8c', supplier: 'express', lots: 2 },
      { item: 'ram-16g', supplier: 'economy', lots: 3 },
    ];
    const bought = run(world, { kind: 'purchase', id: 1, lines });
    expect(bought.capitalCents).toBe(world.capitalCents - purchaseCost(lines));
    expect(bought.stocks[1]).toEqual({ 'cpu-8c': 20 });
    expect(bought.ledger.purchased).toEqual({ 'cpu-8c': 20 });
    expect(bought.deliveries).toHaveLength(3);
    expect(dockSpace(bought, 1)).toBe(100 - 20 - 30);
    expect(checkIntegrity(bought)).toBe(true);
    let later = bought;
    for (let tick = 0; tick < SUPPLIERS.economy.leadTicks; tick++) later = step(later);
    expect(later.deliveries).toHaveLength(0);
    expect(later.stocks[1]).toEqual({ 'cpu-8c': 20, 'ram-16g': 30 });
    expect(checkIntegrity(later)).toBe(true);
  });

  it('refuse toute la commande si une ligne échoue', () => {
    const world = withDock();
    const full: PurchaseLine[] = [{ item: 'cpu-8c', supplier: 'express', lots: 8 }, { item: 'ram-16g', supplier: 'express', lots: 3 }];
    expect(checkPurchase(world, 1, full)).toBe('dock-full');
    expect(applyCommand(world, { kind: 'purchase', id: 1, lines: full })).toEqual({ ok: false, reason: 'dock-full' });
    expect(checkPurchase(world, 1, [])).toBe('empty-order');
    expect(checkPurchase(world, 1, [{ item: 'cpu-8c', supplier: 'express', lots: 0 }])).toBe('invalid-order');
    expect(checkPurchase(world, 1, [{ item: 'cpu-8c', supplier: 'express', lots: 1.5 }])).toBe('invalid-order');
    expect(checkPurchase(world, 1, [{ item: 'cpu-8c', supplier: 'express', lots: PURCHASE.maxLots + 1 }])).toBe('invalid-order');
    expect(checkPurchase(world, 1, [{ item: 'pc-office', supplier: 'express', lots: 1 }])).toBe('locked');
    expect(checkPurchase({ ...world, capitalCents: 100 }, 1, [{ item: 'cpu-8c', supplier: 'express', lots: 1 }])).toBe('insufficient-funds');
    expect(checkPurchase(world, 99, [{ item: 'cpu-8c', supplier: 'express', lots: 1 }])).toBe('missing-machine');
  });

  it('garde les composants verrouillés hors de la boutique en progression', () => {
    const world = run(createWorld('progression'), { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 });
    expect(checkPurchase(world, 1, [{ item: 'ram-32g', supplier: 'express', lots: 1 }])).toBe('locked');
    expect(checkPurchase(world, 1, [{ item: 'cpu-8c', supplier: 'express', lots: 1 }])).toBeNull();
  });
});
