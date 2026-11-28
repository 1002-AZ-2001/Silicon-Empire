import {
  CONVEYOR, ITEM_TYPES, MILESTONES, MILESTONE_IDS, PRODUCTION, PURCHASE, RESEARCH, RESEARCH_IDS, SKILL_LEVELS, STAFF, SUPPLIERS,
  WORKSHOP, FLOOR_TYPES, LAND, CAREER, POWER, POWER_USE_KW, ROLES, ROLE_EFFECTS, WEAR, LOANS, LOAN_IDS, MARKET_PRICES,
  ABROAD, CALENDAR, REGIONS, START_YEARS, SUBSIDIARY_PRODUCTS, TRANSPORT_MODES, designParts, designPower, eraIndex, eraOfYear, isConveyor, recipeOf, sameDesign,
} from '@silicon-empire/game-data';
import type { ItemType, MilestoneId, ResearchId } from '@silicon-empire/game-data';
import { addItems, fitsInputStock, inventoryTotal, mergeInventories } from './inventory';
import type { Inventory } from './inventory';
import { createProgress, eraOf, milestoneAvailable, milestoneDone, modelUnlocked, orderableItems, rewardsEarned, unlockedMachines } from './progress';
import type { Progress } from './progress';
import { NO_RESEARCH, capacityOf, researchAvailable, researchPartsDone, upgradeUnlocked } from './research';
import type { ResearchState } from './research';
import { salesAccounts, validSaleTerms } from './sales';
import { candidatesFor, postAccepts } from './staff';
import { validCompany } from './company';
import { regionOpen, transitTicks, validSubsidiarySettings } from './abroad';
import { careerDate, techAvailable, techSpent } from './career';
import type { CareerState } from './career';
import { landConnected, landSpent, ownsFootprint, ownsTile } from './land';
import { fitsMap, footprintOf, landUnlocked, machineUnlocked } from './world';
import type { Machine, World } from './world';

/** Milestones were completed in an order the rules allow, and deliveries match the remaining costs. */
/** Career state: licences bought in an allowed order, valid loans and counters. */
function checkCareer(career: CareerState, tick: number): boolean {
  const counters = [career.borrowedCents, career.repaidCents, career.missed, career.marketRevenueCents];
  if (counters.some(value => !Number.isSafeInteger(value) || value < 0)) return false;
  if (career.missed >= CAREER.maxMissed !== career.bankrupt) return false;
  if (!Number.isSafeInteger(career.retoolCents) || career.retoolCents < 0 || !START_YEARS.includes(career.startYear)) return false;
  // The calendar decides the latest era on sale; the lines never go back before the start era.
  if (career.released !== eraOfYear(careerDate(career, tick).year) || eraIndex(career.era) > eraIndex(career.released) ||
    eraIndex(career.era) < eraIndex(eraOfYear(career.startYear))) return false;
  if (!career.technologies.includes('computers') && career.era !== career.released) return false;
  if (!checkAbroad(career, tick)) return false;
  if (career.nextInstalment <= tick || career.nextInstalment - tick > STAFF.payPeriodTicks) return false;
  if (career.specialty === null ? career.technologies.length > 0 : career.technologies[0] !== career.specialty) return false;
  let replay: CareerState = { ...career, technologies: career.technologies.slice(0, 1) };
  for (const tech of career.technologies.slice(1)) {
    if (!techAvailable(replay, tech)) return false;
    replay = { ...replay, technologies: [...replay.technologies, tech] };
  }
  if (new Set(career.loans.map(loan => loan.offer)).size !== career.loans.length) return false;
  if (career.loans.some(loan => !LOAN_IDS.includes(loan.offer) || !Number.isInteger(loan.remaining) || loan.remaining < 1 ||
    loan.remaining > LOANS[loan.offer].months)) return false;
  return Object.entries(career.marketShipped).every(([item, count]) => MARKET_PRICES[item as ItemType] !== undefined && (count ?? 0) > 0);
}

/** Factories abroad: open regions, one each, valid settings; counters and shipments in range. */
function checkAbroad(career: CareerState, tick: number): boolean {
  const { abroad } = career;
  if ([abroad.spentCents, abroad.revenueCents].some(value => !Number.isSafeInteger(value) || value < 0)) return false;
  if (!Number.isSafeInteger(abroad.nextShipmentId) || abroad.nextShipmentId < 1) return false;
  if (abroad.subsidiaries.length > 0 && !career.technologies.includes('global')) return false;
  const regions = abroad.subsidiaries.map(subsidiary => subsidiary.region);
  if (new Set(regions).size !== regions.length) return false;
  // Every factory was bought: its cost is part of the spending.
  if (regions.reduce((total, region) => total + REGIONS[region].factoryCostCents, 0) > abroad.spentCents) return false;
  const month = CALENDAR.monthTicks;
  if (abroad.subsidiaries.some(subsidiary => !regionOpen(subsidiary.region, career.startYear, Math.max(0, subsidiary.nextRun - month)) ||
    !validSubsidiarySettings(subsidiary) || subsidiary.nextRun <= tick || subsidiary.nextRun - tick > month ||
    (subsidiary.product === 'pc-office-packaged' && !career.technologies.includes('computers')))) return false;
  let previous = 0;
  for (const shipment of abroad.shipments) {
    if (shipment.id <= previous || shipment.id >= abroad.nextShipmentId || !regions.includes(shipment.region) ||
      !Number.isSafeInteger(shipment.units) || shipment.units < 1 || shipment.dueTick <= tick ||
      shipment.dueTick - tick > Math.max(...TRANSPORT_MODES.map(mode => transitTicks(shipment.region, mode)), ABROAD.retryTicks) ||
      !validSubsidiarySettings({ product: shipment.item, destination: shipment.destination, mode: 'surface', dockId: shipment.dockId })) {
      return false;
    }
    previous = shipment.id;
  }
  return Object.entries(abroad.imported).every(([item, count]) => (SUBSIDIARY_PRODUCTS as readonly string[]).includes(item) && (count ?? 0) > 0);
}

function checkProgress(progress: Progress, tick = 0): boolean {
  if (progress.career && (progress.sandbox || progress.completed.length > 0 || progress.active ||
    Object.keys(progress.delivered).length > 0 || !checkCareer(progress.career, tick))) return false;
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

/** Projects were finished in an allowed order; the analysis and deliveries match project costs. */
function checkResearch(progress: Progress, research: ResearchState): boolean {
  if (new Set(research.completed).size !== research.completed.length) return false;
  let replay: ResearchState = NO_RESEARCH;
  for (const id of research.completed) {
    if (!RESEARCH_IDS.includes(id) || !researchAvailable(progress, replay, id)) return false;
    replay = { ...replay, completed: [...replay.completed, id] };
  }
  const { analysing, active } = research;
  if (analysing) {
    if (!RESEARCH_IDS.includes(analysing.id) || !researchAvailable(progress, { ...research, analysing: null }, analysing.id)) return false;
    if (!Number.isInteger(analysing.remaining) || analysing.remaining < 1 || analysing.remaining > RESEARCH[analysing.id].ticks) return false;
  }
  if (active && (active === analysing?.id || !researchAvailable(progress, research, active))) return false;
  return Object.entries(research.delivered).every(([id, delivered]) => {
    const project = id as ResearchId;
    if (!RESEARCH_IDS.includes(project) || !delivered || !researchAvailable(progress, research, project)) return false;
    const cost = RESEARCH[project].cost;
    const units = ITEM_TYPES.filter(item => (delivered[item] ?? 0) > 0);
    // Parts complete only while they wait for the running analysis to finish.
    return units.length > 0 && (!researchPartsDone(research, project) || (project === active && analysing !== null)) &&
      units.every(item => (delivered[item] ?? 0) <= (cost[item] ?? 0));
  });
}

/** Bills, cables and wear are consistent with the layout and the land owned. */
function checkUtilities(world: World): boolean {
  const { utilities } = world;
  if (!Number.isSafeInteger(utilities.spentCents) || utilities.spentCents < 0) return false;
  // The bill calendar only runs while utilities are on.
  if (utilities.enabled && (utilities.nextBill <= world.tick || utilities.nextBill - world.tick > POWER.billPeriodTicks)) return false;
  if (!utilities.enabled && (utilities.cut || Object.keys(world.wear).length > 0)) return false;
  let previous = -1;
  for (const tile of world.cables) {
    if (!Number.isInteger(tile) || tile <= previous || tile >= world.columns * world.rows ||
      !ownsTile(world, { x: tile % world.columns, y: Math.floor(tile / world.columns) })) return false;
    previous = tile;
  }
  return Object.entries(world.wear).every(([id, wear]) => {
    const machine = world.machines.find(candidate => String(candidate.id) === id);
    return machine !== undefined && POWER_USE_KW[machine.type] !== undefined && recipeOf(machine.type, machine.model, world.design, eraOf(world.progress)) !== undefined &&
      Number.isInteger(wear) && wear > 0 && wear <= WEAR.breakdown;
  });
}

const PAINTED_FLOORS: readonly string[] = FLOOR_TYPES.filter(floor => floor !== 'concrete');

/** Staff ids, pool, calendar and assignments are consistent with the machines of the world. */
function checkStaff(world: World): boolean {
  const { staff, tick } = world;
  const pool = candidatesFor(staff.pool, STAFF.maxPoolSize);
  let rank = 0;
  for (const candidate of staff.candidates) {
    while (rank < pool.length && pool[rank]?.id !== candidate.id) rank += 1;
    const original = pool[rank];
    if (!original || original.name !== candidate.name || original.skill !== candidate.skill || original.role !== candidate.role ||
      original.salaryCents !== candidate.salaryCents) return false;
    rank += 1;
  }
  if (!Number.isSafeInteger(staff.pool) || staff.pool < 0 || !Number.isSafeInteger(staff.paidCents) || staff.paidCents < 0 ||
    staff.nextPayday <= tick || staff.nextPayday - tick > STAFF.payPeriodTicks ||
    staff.nextPool <= tick || staff.nextPool - tick > STAFF.poolRefreshTicks ||
    staff.employees.length > STAFF.maxEmployees) return false;
  let previousId = 0;
  const operated = new Set<number>();
  for (const employee of staff.employees) {
    if (!Number.isSafeInteger(employee.id) || employee.id <= previousId || employee.id >= staff.nextEmployeeId ||
      !SKILL_LEVELS.includes(employee.skill) || !Number.isSafeInteger(employee.salaryCents) || employee.salaryCents <= 0 ||
      employee.name.length === 0 || !ROLES.includes(employee.role) ||
      !Number.isInteger(employee.morale) || employee.morale < 1 || employee.morale > 100) return false;
    previousId = employee.id;
    if (employee.machineId === null) continue;
    const machine = world.machines.find(candidate => candidate.id === employee.machineId);
    if (!machine || !postAccepts(employee.role, machine.type) || operated.has(machine.id)) return false;
    operated.add(machine.id);
  }
  return true;
}

/**
 * Checks the rules a well-formed world always respects: unique ids, no overlap, unlocked buildings,
 * capacities, belt spacing, production states, progression, conservation of units and booked capital.
 */
export function checkIntegrity(world: World): boolean {
  if (!checkProgress(world.progress, world.tick) || !checkResearch(world.progress, world.research) || !checkStaff(world)) return false;
  if (world.parcels.some((parcel, index) => !Number.isInteger(parcel) || parcel < 0 ||
    parcel >= LAND.gridColumns * LAND.gridRows || (index > 0 && parcel <= (world.parcels[index - 1] as number))) ||
    !landConnected(world) || (world.parcels.length > LAND.initialParcels.length && !landUnlocked(world.progress))) return false;
  if (!checkUtilities(world) || !validCompany(world.company)) return false;
  const restockable = orderableItems(world.progress);
  for (const machine of world.machines) {
    if (machine.restock === undefined) continue;
    if (machine.type !== 'receiving' || machine.restock.length === 0 || machine.restock.length > ROLE_EFFECTS.maxRestockItems ||
      new Set(machine.restock).size !== machine.restock.length || machine.restock.some(item => !restockable.has(item))) return false;
  }
  const tiles = world.columns * world.rows;
  for (const [key, floor] of Object.entries(world.floors)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= tiles || String(index) !== key ||
      !PAINTED_FLOORS.includes(floor) || !ownsTile(world, { x: index % world.columns, y: Math.floor(index / world.columns) })) return false;
  }
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
  const career = world.progress.career;
  const capitalCeiling = (career ? CAREER.initialCapitalCents + career.borrowedCents + career.marketRevenueCents + career.abroad.revenueCents
    : WORKSHOP.initialCapitalCents) +
    rewardsEarned(world.progress) + revenueCents;
  let bookedCapital = world.capitalCents + world.ledger.purchaseSpentCents + world.staff.paidCents + landSpent(world) +
    (career ? career.repaidCents + techSpent(career) + career.retoolCents + career.abroad.spentCents : 0) + world.utilities.spentCents;
  if (bookedCapital > capitalCeiling) return false;
  if (world.machines.filter(machine => machine.type === 'headquarters').length > 1) return false;

  for (const machine of world.machines) {
    const footprint = footprintOf(machine);
    if (machine.id <= previousId || machine.id >= world.nextMachineId || !fitsMap(world, footprint) ||
      !ownsFootprint(world, footprint)) return false;
    if (!unlocked.has(machine.type) && !machineUnlocked(world, machine.type)) return false;
    if (machine.level !== undefined && ((machine.level !== 2 && machine.level !== 3) ||
      !upgradeUnlocked(world.progress, world.research, machine.type, machine.level) ||
      (machine.level === 3 && !upgradeUnlocked(world.progress, world.research, machine.type, 2)))) {
      return false;
    }
    if (machine.model && (!recipeOf(machine.type, machine.model, world.design, eraOf(world.progress)) || !modelUnlocked(world.progress, machine.model))) {
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
    if (inventoryTotal(world.stocks[id] ?? {}) + units > capacityOf(world.progress, world.research, 'receiving')) return false;
    reserved.set(id, units);
  }

  let held: Inventory = {};
  for (const [id, stock] of Object.entries(world.stocks)) {
    const machine = machines.get(id);
    const total = inventoryTotal(stock);
    if (!machine || total === 0) return false;
    const recipe = recipeOf(machine.type, machine.model, world.design, eraOf(world.progress));
    if (recipe) {
      if (!fitsInputStock(recipe, stock)) return false;
    } else if (total > capacityOf(world.progress, world.research, machine.type)) {
      return false;
    }
    held = mergeInventories(held, stock);
  }

  for (const [id, state] of Object.entries(world.production)) {
    const machine = machines.get(id);
    const recipe = machine && recipeOf(machine.type, machine.model, world.design, eraOf(world.progress));
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
  const entered = [purchased, produced, world.progress.career?.abroad.imported ?? {}].reduce(mergeInventories, {});
  const left = [held, discarded, consumed, delivered, shipped, world.progress.career?.marketShipped ?? {}].reduce(mergeInventories, {});
  const completedCosts = world.progress.completed.map(id => MILESTONES[id].cost);
  const researchCosts = [
    ...world.research.completed.map(id => RESEARCH[id].cost),
    ...world.research.analysing ? [RESEARCH[world.research.analysing.id].cost] : [],
    ...Object.values(world.research.delivered),
  ];
  const deliveredToMilestones = [...completedCosts, ...Object.values(world.progress.delivered), ...researchCosts]
    .reduce<Inventory>((total, inventory) => mergeInventories(total, inventory ?? {}), {});
  return ITEM_TYPES.every((item: ItemType) =>
    (entered[item] ?? 0) === (left[item] ?? 0) && (deliveredToMilestones[item] ?? 0) === (delivered[item] ?? 0));
}
