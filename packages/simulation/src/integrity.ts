import { CONVEYOR, ITEM_TYPES, MACHINES, WORKSHOP } from '@silicon-empire/game-data';
import { addItems, inventoryTotal, mergeInventories } from './inventory';
import type { Inventory } from './inventory';
import { fitsMap, footprintOf } from './world';
import type { Machine, World } from './world';

/**
 * Checks the rules a well-formed world always respects: unique ids, no overlap,
 * capacities, belt spacing, conservation of purchased units and booked capital.
 */
export function checkIntegrity(world: World): boolean {
  const occupiedTiles = new Set<number>();
  const machines = new Map<string, Machine>();
  let previousId = 0;
  let bookedCapital = world.capitalCents + world.ledger.purchaseSpentCents;
  if (bookedCapital > WORKSHOP.initialCapitalCents) return false;

  for (const machine of world.machines) {
    const footprint = footprintOf(machine);
    if (machine.id <= previousId || machine.id >= world.nextMachineId || !fitsMap(world, footprint)) return false;
    previousId = machine.id;
    machines.set(String(machine.id), machine);
    bookedCapital += machine.paidCents;
    if (bookedCapital > WORKSHOP.initialCapitalCents) return false;

    for (let y = footprint.y; y < footprint.y + footprint.height; y++) {
      for (let x = footprint.x; x < footprint.x + footprint.width; x++) {
        const index = y * world.columns + x;
        if (occupiedTiles.has(index)) return false;
        occupiedTiles.add(index);
      }
    }
  }

  let held: Inventory = {};
  for (const [id, stock] of Object.entries(world.stocks)) {
    const machine = machines.get(id);
    const total = inventoryTotal(stock);
    if (!machine || total === 0 || total > MACHINES[machine.type].capacity) return false;
    held = mergeInventories(held, stock);
  }

  const itemIds = new Set<number>();
  for (const [id, belt] of Object.entries(world.belts)) {
    if (machines.get(id)?.type !== 'conveyor' || belt.length === 0) return false;
    let ahead: number | null = null;
    for (const unit of belt) {
      if (itemIds.has(unit.id) || unit.id >= world.nextItemId) return false;
      if (unit.position < 0 || unit.position >= CONVEYOR.lengthUnits || !Number.isInteger(unit.position)) return false;
      if (ahead !== null && unit.position > ahead - CONVEYOR.spacingUnits) return false;
      itemIds.add(unit.id);
      ahead = unit.position;
      held = addItems(held, unit.item, 1);
    }
  }

  for (const [id, router] of Object.entries(world.routers)) {
    const type = machines.get(id)?.type;
    if (type !== 'splitter' && type !== 'merger') return false;
    if (!Number.isInteger(router.cursor) || router.cursor < 0 || router.cursor > 2) return false;
    if (!router.held && router.cursor === 0) return false;
    if (router.held) {
      if (itemIds.has(router.held.id) || router.held.id >= world.nextItemId) return false;
      itemIds.add(router.held.id);
      held = addItems(held, router.held.item, 1);
    }
  }
  if (world.machines.some(machine => machine.filter && machine.type !== 'splitter')) return false;

  const accounted = mergeInventories(held, world.ledger.discarded);
  return ITEM_TYPES.every(item => (accounted[item] ?? 0) === (world.ledger.purchased[item] ?? 0));
}
