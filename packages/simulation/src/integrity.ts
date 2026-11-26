import {
  CONVEYOR, ITEM_TYPES, MACHINES, MILESTONES, MILESTONE_IDS, PRODUCTION, PURCHASE, SUPPLIERS, WORKSHOP,
  designParts, designPower, isConveyor, recipeOf, sameDesign,
} from '@silicon-empire/game-data';
import type { ItemType, MilestoneId } from '@silicon-empire/game-data';
import { addItems, fitsInputStock, inventoryTotal, mergeInventories } from './inventory';
import type { Inventory } from './inventory';
import { createProgress, milestoneAvailable, milestoneDone, modelUnlocked, orderableItems, rewardsEarned, unlockedMachines } from './progress';
import type { Progress } from './progress';
import { salesAccounts, validSaleTerms } from './sales';
import { fitsMap, footprintOf } from './world';
import type { Machine, World } from './world';

/** Milestones were completed in an order the rules allow, and deliveries match the remaining costs. */
function checkProgress(progress: Progress): boolean {
  if (new Set(progress.completed).size !== progress.completed.length) return false;
  let replay = createProgress(false);
  for (const id of progress.completed) {
    if (!MILESTONE_IDS.includes(id) || !milestoneAvailable(replay, id)) return false;
    replay = { ...replay, completed: [...replay.completed, id] };
  }
  if (progress.sandbox && (progress.completed.length > 0 || progress.active || Object.keys(progress.delivered).length > 0)) {
    return false;
  }
  if (progress.active && !milestoneAvailable(progress, progress.active)) return false;
  return Object.entries(progress.delivered).every(([id, delivered]) => {
    const milestone = id as MilestoneId;
    if (!MILESTONE_IDS.includes(milestone) || !delivered || !milestoneAvailable(progress, milestone)) return false;
    const cost = MILESTONES[milestone].cost;
    const units = ITEM_TYPES.filter(item => (delivered[item] ?? 0) > 0);
    // An unfinished milestone holds at least one delivery and never more than its cost.
    return units.length > 0 && !milestoneDone(progress, milestone) &&
      units.every(item => (delivered[item] ?? 0) <= (cost[item] ?? 0));
  });
}

/**
 * Checks the rules a well-formed world always respects: unique ids, no overlap, unlocked buildings,
 * capacities, belt spacing, production states, progression, conservation of units and booked capital.
 */
export function checkIntegrity(world: World): boolean {
  if (!checkProgress(world.progress)) return false;
  const { active, completed } = world.sales;
  if (active && (!validSaleTerms(active.terms) || !modelUnlocked(world.progress, active.terms.model) ||
    !Number.isInteger(active.delivered) || active.delivered < 0 || active.delivered >= active.terms.units)) return false;
  if (active?.terms.design && (!world.design || !sameDesign(active.terms.design, world.design))) return false;
  if (completed.some(terms => !validSaleTerms(terms) || !modelUnlocked(world.progress, terms.model))) return false;
  const orderable = orderableItems(world.progress);
  if (world.design) {
    const power = designPower(world.design.spec);
    const parts = designParts(world.design.spec);
    if (!modelUnlocked(world.progress, 'custom') || power.required > power.available ||
      ITEM_TYPES.some(item => parts[item] && !orderable.has(item))) return false;
  }
  const { revenueCents, shipped } = salesAccounts(world.sales);
  const unlocked = unlockedMachines(world.progress);
  const occupiedTiles = new Set<number>();
  const machines = new Map<string, Machine>();
  let previousId = 0;
  const capitalCeiling = WORKSHOP.initialCapitalCents + rewardsEarned(world.progress) + revenueCents;
  let bookedCapital = world.capitalCents + world.ledger.purchaseSpentCents;
  if (bookedCapital > capitalCeiling) return false;
  if (world.machines.filter(machine => machine.type === 'headquarters').length > 1) return false;

  for (const machine of world.machines) {
    const footprint = footprintOf(machine);
    if (machine.id <= previousId || machine.id >= world.nextMachineId || !fitsMap(world, footprint)) return false;
    if (!unlocked.has(machine.type)) return false;
    if (machine.model && (!recipeOf(machine.type, machine.model, world.design) || !modelUnlocked(world.progress, machine.model))) {
      return false;
    }
    previousId = machine.id;
    machines.set(String(machine.id), machine);
    bookedCapital += machine.paidCents;
    if (bookedCapital > capitalCeiling) return false;

    for (let y = footprint.y; y < footprint.y + footprint.height; y++) {
      for (let x = footprint.x; x < footprint.x + footprint.width; x++) {
        const index = y * world.columns + x;
        if (occupiedTiles.has(index)) return false;
        occupiedTiles.add(index);
      }
    }
  }

  const reserved = new Map<string, number>();
  for (const delivery of world.deliveries) {
    const id = String(delivery.dockId);
    const lead = SUPPLIERS[delivery.supplier].leadTicks;
    if (machines.get(id)?.type !== 'receiving' || !orderable.has(delivery.item) ||
      delivery.dueTick <= world.tick || delivery.dueTick - world.tick > lead) return false;
    const units = (reserved.get(id) ?? 0) + PURCHASE.lotSize;
    if (inventoryTotal(world.stocks[id] ?? {}) + units > MACHINES.receiving.capacity) return false;
    reserved.set(id, units);
  }

  let held: Inventory = {};
  for (const [id, stock] of Object.entries(world.stocks)) {
    const machine = machines.get(id);
    const total = inventoryTotal(stock);
    if (!machine || total === 0) return false;
    const recipe = recipeOf(machine.type, machine.model, world.design);
    if (recipe) {
      if (!fitsInputStock(recipe, stock)) return false;
    } else if (total > MACHINES[machine.type].capacity) {
      return false;
    }
    held = mergeInventories(held, stock);
  }

  for (const [id, state] of Object.entries(world.production)) {
    const machine = machines.get(id);
    const recipe = machine && recipeOf(machine.type, machine.model, world.design);
    if (!recipe) return false;
    const rejected = recipe.rejection?.item;
    if (!state.batch && inventoryTotal(state.output) === 0) return false;
    for (const item of ITEM_TYPES) {
      const count = state.output[item] ?? 0;
      if (count > PRODUCTION.outputCapacity || (count > 0 && item !== recipe.output && item !== rejected)) return false;
    }
    held = mergeInventories(held, state.output);
    if (state.batch) {
      const { item, remaining } = state.batch;
      if (item !== recipe.output && item !== rejected) return false;
      if (!Number.isInteger(remaining) || remaining < 0 || remaining > recipe.ticks) return false;
      held = addItems(held, item, 1);
    }
  }

  const itemIds = new Set<number>();
  for (const [id, belt] of Object.entries(world.belts)) {
    const type = machines.get(id)?.type;
    if (!type || !isConveyor(type) || belt.length === 0) return false;
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

  const { purchased, produced, consumed, delivered, discarded } = world.ledger;
  const entered = mergeInventories(purchased, produced);
  const left = [held, discarded, consumed, delivered, shipped].reduce(mergeInventories, {});
  const completedCosts = world.progress.completed.map(id => MILESTONES[id].cost);
  const deliveredToMilestones = [...completedCosts, ...Object.values(world.progress.delivered)]
    .reduce<Inventory>((total, inventory) => mergeInventories(total, inventory ?? {}), {});
  return ITEM_TYPES.every((item: ItemType) =>
    (entered[item] ?? 0) === (left[item] ?? 0) && (deliveredToMilestones[item] ?? 0) === (delivered[item] ?? 0));
}
