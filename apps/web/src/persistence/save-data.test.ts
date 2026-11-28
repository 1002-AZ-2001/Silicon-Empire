import { DEFAULT_DESIGN, POWER, PROFESSIONAL_RECIPES, SUPPLIERS, WORKSHOP, recipeOf } from '@silicon-empire/game-data';
import { applyCommand, createStaff, createWorld, step } from '@silicon-empire/simulation';
import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';
import { SAVE_VERSION, decodeSave } from './save-data';
import type { Command, World } from '@silicon-empire/simulation';
import type { ItemType, ProductModel, TechId } from '@silicon-empire/game-data';
import type { SaveRecord } from './save-data';

/** Saves before v15 (v0.12.0) have no roles. */
function withoutRoles<T>(saved: T): T {
  const { staff } = (saved as { world: { staff?: { employees: Record<string, unknown>[]; candidates: Record<string, unknown>[] } } }).world;
  for (const person of [...staff?.employees ?? [], ...staff?.candidates ?? []]) delete person.role;
  return saved;
}

/** Saves before v12 (v0.9.1) cover a 64 × 64 map. */
const OLD_MAP = { columns: 64, rows: 64 };

/** A world as read from a save older than v10: no staff yet, the first pool from the saved tick. */
function asMigrated(world: World): World {
  return { ...asLegacy(world), staff: createStaff(world.tick) };
}

/** A world as read from a save older than v14: no utilities, bill calendar from the saved tick. */
function asLegacy(world: World): World {
  return { ...world, utilities: { enabled: false, cut: false, nextBill: world.tick + POWER.billPeriodTicks, spentCents: 0 } };
}

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

const result = applyCommand(createWorld(), { kind: 'build', type: 'tester', x: 12, y: 15, rotation: 1 });
if (!result.ok || !result.machine) throw new Error('Le scénario de test doit pouvoir construire une machine.');
const built = { world: result.world, machine: result.machine };

const record: SaveRecord = {
  id: '00000000000000000000000000000001',
  name: 'Atelier des pins',
  version: SAVE_VERSION,
  createdAt: 1000,
  savedAt: 2000,
  world: built.world,
};

/** Dock, two conveyors and a storage, with a lot in transit. */
let transit = ([
  { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 8, rotation: 0 },
  { kind: 'build', type: 'storage', x: 11, y: 7, rotation: 0 },
  { kind: 'order', id: 1, item: 'cpu-8c' },
] satisfies Command[]).reduce(run, createWorld());
for (let tick = 0; tick < 45; tick++) transit = step(transit);
const inTransit: SaveRecord = { ...record, world: transit };

function runningAssembler(model: ProductModel): World {
  let world = ([
    { kind: 'build', type: 'receiving', x: 10, y: 19, rotation: 0 },
    { kind: 'build', type: 'conveyor', x: 11, y: 18, rotation: 0 },
    { kind: 'build', type: 'assembler', x: 11, y: 16, rotation: 0 },
    { kind: 'set-product-model', id: 3, model },
  ] satisfies Command[]).reduce(run, createWorld());
  const recipe = recipeOf('assembler', model);
  if (!recipe) throw new Error('Recette de test introuvable.');
  for (const item of Object.keys(recipe.inputs) as ItemType[]) world = run(world, { kind: 'order', id: 1, item });
  for (let tick = 0; tick < 200; tick++) world = step(world);
  return world;
}

describe('schéma de sauvegarde', () => {
  it('restaure le capital, l’orientation et le prix réellement payé', () => {
    expect(decodeSave(JSON.parse(JSON.stringify(record)))).toEqual(record);
    const historicalPrice = {
      ...record,
      world: { ...record.world, machines: [{ ...built.machine, paidCents: built.machine.paidCents - 200 }] },
    };
    expect(decodeSave(historicalPrice)).toEqual(historicalPrice);
  });

  it('restaure les stocks et les unités en transit', () => {
    expect(Object.keys(transit.belts).length).toBeGreaterThan(0);
    expect(transit.stocks[4]).toBeDefined();
    expect(decodeSave(JSON.parse(JSON.stringify(inTransit)))).toEqual(inTransit);
  });

  it('migre une sauvegarde v0.1 sans perdre les constructions', () => {
    const { capitalCents, nextMachineId, machines } = built.world;
    const v1 = { ...record, version: 1, world: { ...OLD_MAP, capitalCents, nextMachineId, machines } };
    expect(decodeSave(v1)).toEqual(record);
    expect(parseBackup(JSON.stringify(v1))).toEqual(record);
    expect(decodeSave({ ...v1, world: { ...v1.world, tick: 0 } })).toBeNull();
  });

  it('migre une sauvegarde v0.2.0 avec ses unités en transit', () => {
    const v2 = JSON.parse(JSON.stringify({ ...inTransit, version: 2 }));
    delete v2.world.sites;
    for (const key of ['routers', 'production', 'progress', 'sales', 'design', 'deliveries', 'research', 'staff', 'floors', 'parcels', 'utilities', 'cables', 'wear', 'company']) delete v2.world[key];
    Object.assign(v2.world, OLD_MAP);
    for (const key of ['produced', 'consumed', 'delivered']) delete v2.world.ledger[key];
    expect(decodeSave(v2)).toEqual({ ...inTransit, world: asMigrated(inTransit.world) });
    expect(decodeSave({ ...v2, world: { ...v2.world, routers: {} } })).toBeNull();
  });

  it('migre une sauvegarde v0.2.x en bac à sable et refuse ses champs v4', () => {
    const v3 = JSON.parse(JSON.stringify({ ...inTransit, version: 3 }));
    delete v3.world.sites;
    for (const key of ['production', 'progress', 'sales', 'design', 'deliveries', 'research', 'staff', 'floors', 'parcels', 'utilities', 'cables', 'wear', 'company']) delete v3.world[key];
    Object.assign(v3.world, OLD_MAP);
    for (const key of ['produced', 'consumed', 'delivered']) delete v3.world.ledger[key];
    const migrated = decodeSave(v3);
    expect(migrated?.world.progress).toEqual({ sandbox: true, completed: [], active: null, delivered: {} });
    expect(migrated).toEqual({ ...inTransit, world: asMigrated(inTransit.world) });
    expect(decodeSave({ ...v3, world: { ...v3.world, production: {} } })).toBeNull();
  });

  it('migre un lot bureautique v4 en cours et poursuit la même recette', () => {
    const world = runningAssembler('office');
    const { sales, design, deliveries } = world;
    const oldWorld: Record<string, unknown> = { ...world };
    for (const key of ['sales', 'design', 'deliveries', 'research', 'staff', 'floors', 'parcels', 'utilities', 'cables', 'wear', 'company', 'sites']) delete oldWorld[key];
    Object.assign(oldWorld, OLD_MAP);
    const legacy = { ...record, version: 4, world: oldWorld };
    const restored = decodeSave(legacy);
    expect(restored).toEqual({ ...record, world: asMigrated(world) });
    expect(restored?.world).toMatchObject({ sales, design, deliveries });
    expect(restored?.world.production[3]?.batch?.item).toBe('pc-office');
    if (!restored) throw new Error('La sauvegarde v4 doit pouvoir être relue.');
    expect(step(restored.world)).toEqual(step(asMigrated(world)));
  });

  it('restaure un lot gaming en cours et rejette un modèle incohérent avec ce lot', () => {
    const world = runningAssembler('gaming');
    const saved: SaveRecord = { ...record, world };
    expect(world.production[3]?.batch?.item).toBe('pc-gaming');
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const machines = world.machines.map(machine => machine.id === 3 ? { ...machine, model: 'office' } : machine);
    expect(decodeSave({ ...saved, world: { ...world, machines } })).toBeNull();
    expect(decodeSave({ ...saved, version: 4 })).toBeNull();
  });

  it('migre le modèle gaming et le lot en cours d’une sauvegarde v5', () => {
    const world = runningAssembler('gaming');
    const { sales, design, deliveries } = world;
    const oldWorld: Record<string, unknown> = { ...world };
    for (const key of ['sales', 'design', 'deliveries', 'research', 'staff', 'floors', 'parcels', 'utilities', 'cables', 'wear', 'company', 'sites']) delete oldWorld[key];
    Object.assign(oldWorld, OLD_MAP);
    const restored = decodeSave({ ...record, version: 5, world: oldWorld });
    expect(restored).toEqual({ ...record, world: asMigrated(world) });
    expect(restored?.world).toMatchObject({ sales, design, deliveries });
    expect(restored?.world.machines[2]?.model).toBe('gaming');
    expect(restored?.world.production[3]?.batch?.item).toBe('pc-gaming');
  });

  it('restaure un contrôle traitant un rebut, y compris quand les deux sorties contiennent des PC', () => {
    let world = ([
      { kind: 'build', type: 'tester', x: 15, y: 15, rotation: 0 },
      { kind: 'set-product-model', id: 1, model: 'professional' },
    ] satisfies Command[]).reduce(run, createWorld());
    const { output, rejection, ticks } = PROFESSIONAL_RECIPES.tester;
    world = {
      ...world,
      stocks: { 1: { 'pc-professional': 1 } },
      ledger: {
        ...world.ledger, produced: { 'pc-professional': 8, [output]: 7 },
        consumed: { 'pc-professional': 7 }, discarded: { [output]: 5 },
      },
      production: { 1: { batch: null, output: { [output]: 2 } } },
    };
    const active = step(world);
    expect(active.production[1]?.batch).toEqual({ item: rejection.item, remaining: ticks });
    const saved = { ...record, world: active };
    const restored = decodeSave(JSON.parse(JSON.stringify(saved)));
    expect(restored).toEqual(saved);
    expect(decodeSave({ ...saved, version: 5 })).toBeNull();
    if (!restored) throw new Error('Le contrôle professionnel doit pouvoir reprendre.');
    let finished = restored.world;
    for (let tick = 0; tick < ticks; tick++) finished = step(finished);
    expect(finished.production[1]?.output).toEqual({ [output]: 2, [rejection.item]: 1 });
    expect(decodeSave({ ...record, world: finished })?.world).toEqual(finished);
  });

  it('reprend une livraison réservée et une révision de modèle après sauvegarde', () => {
    const world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
      { kind: 'order', id: 1, item: 'psu-450', supplier: 'economy' },
      { kind: 'publish-design', spec: { ...DEFAULT_DESIGN, name: 'Nacre' } },
    ] satisfies Command[]).reduce(run, createWorld());
    const saved: SaveRecord = { ...record, world: { ...world, tick: SUPPLIERS.economy.leadTicks - 1 } };
    const restored = decodeSave(JSON.parse(JSON.stringify(saved)));
    expect(restored).toEqual(saved);
    if (!restored) throw new Error('La livraison réservée doit reprendre.');
    const received = step(restored.world);
    expect(received.stocks[1]).toEqual({ 'psu-450': 10 });
    expect(received.deliveries).toEqual([]);
    expect(received.capitalCents).toBe(world.capitalCents);
    expect(step(received).stocks[1]).toEqual(received.stocks[1]);
  });

  it('restaure une partie en progression avec un jalon en cours et un lot en fabrication', () => {
    let world = ([
      { kind: 'build', type: 'headquarters', x: 20, y: 20, rotation: 0 },
      { kind: 'build', type: 'receiving', x: 18, y: 25, rotation: 0 },
      { kind: 'build-line', tiles: [
        { x: 19, y: 24, rotation: 0 }, { x: 19, y: 23, rotation: 1 }, { x: 20, y: 23, rotation: 0 }, { x: 20, y: 22, rotation: 0 },
      ] },
      { kind: 'select-milestone', milestone: 'assembly-bench' },
      { kind: 'order', id: 2, item: 'case-standard' },
    ] satisfies Command[]).reduce(run, createWorld('progression'));
    for (let tick = 0; tick < 150; tick++) world = step(world);
    expect(Object.keys(world.progress.delivered)).toEqual(['assembly-bench']);
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, progress: { ...world.progress, completed: ['quality-control'] } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, progress: { ...world.progress, sandbox: true } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, ledger: { ...world.ledger, delivered: {} } } })).toBeNull();
    expect(decodeSave({
      ...saved,
      world: { ...world, machines: [...world.machines, { id: 99, type: 'assembler', x: 1, y: 1, rotation: 0, paidCents: 1 }], nextMachineId: 100 },
    })).toBeNull();
  });

  it('restaure un répartiteur filtré qui tient une unité', () => {
    let world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
      { kind: 'build', type: 'splitter', x: 11, y: 8, rotation: 0 },
      { kind: 'configure', id: 3, filter: { item: 'cpu-8c', output: 'left' } },
      { kind: 'order', id: 1, item: 'cpu-8c' },
    ] satisfies Command[]).reduce(run, createWorld());
    for (let tick = 0; tick < 60; tick++) world = step(world);
    expect(world.routers[3]?.held).not.toBeNull();
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, routers: { 3: { held: null, cursor: 0 } } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, routers: { 2: world.routers[3] } } })).toBeNull();
    expect(decodeSave({
      ...saved,
      world: { ...world, machines: world.machines.map(machine => ({ ...machine, filter: { item: 'cpu-8c', output: 'left' } })) },
    })).toBeNull();
  });

  it('restaure une analyse de recherche en cours et une machine Mk2, et migre la v8', () => {
    let world = ([
      { kind: 'build', type: 'storage', x: 10, y: 12, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 10, y: 11, rotation: 0 },
      { kind: 'build', type: 'lab', x: 10, y: 9, rotation: 0 },
      { kind: 'build', type: 'assembler', x: 20, y: 20, rotation: 0 },
      { kind: 'upgrade', id: 4 },
      { kind: 'select-research', research: 'assembly-mk2' },
    ] satisfies Command[]).reduce(run, createWorld());
    world = { ...world, stocks: { 1: { 'pc-office-tested': 20 } }, ledger: { ...world.ledger, produced: { 'pc-office-tested': 20 } } };
    for (let tick = 0; tick < 300; tick++) world = step(world);
    expect(world.research.analysing?.id).toBe('assembly-mk2');
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, research: { ...world.research, analysing: { id: 'assembly-mk2', remaining: 0 } } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, machines: world.machines.map(machine => ({ ...machine, level: 2 })) } })).toBeNull();

    const v8 = JSON.parse(JSON.stringify({ ...record, version: 8 }));
    delete v8.world.sites;
    delete v8.world.research;
    delete v8.world.staff;
    delete v8.world.floors;
    delete v8.world.parcels;
    for (const key of ['utilities', 'cables', 'wear', 'company']) delete v8.world[key];
    Object.assign(v8.world, OLD_MAP);
    expect(decodeSave(v8)?.world.research).toEqual({ active: null, delivered: {}, analysing: null, completed: [] });
    expect(decodeSave({ ...v8, world: { ...v8.world, research: world.research } })).toBeNull();
  });

  it.each([
    null,
    { ...record, version: SAVE_VERSION + 1 },
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

  it.each<(world: World) => unknown>([
    world => ({ ...world, stocks: { ...world.stocks, 2: { 'cpu-8c': 1 } } }),
    world => ({ ...world, stocks: { ...world.stocks, 4: { 'cpu-8c': 41 } } }),
    world => ({ ...world, stocks: { ...world.stocks, 4: { 'cpu-8c': 0 } } }),
    world => ({ ...world, belts: { ...world.belts, 4: [{ id: 1, item: 'cpu-8c', position: 0 }] } }),
    world => ({ ...world, belts: { ...world.belts, 2: [{ id: 99, item: 'cpu-8c', position: 20 }] } }),
    world => ({ ...world, belts: { ...world.belts, 2: [{ id: 99, item: 'cpu-8c', position: 3 }] } }),
    world => ({ ...world, belts: { ...world.belts, 3: [] } }),
    world => ({ ...world, ledger: { ...world.ledger, purchased: { 'cpu-8c': 11 } } }),
    world => ({ ...world, ledger: { ...world.ledger, purchaseSpentCents: world.ledger.purchaseSpentCents + world.capitalCents + 1 } }),
  ])('rejette les inventaires et convoyeurs incohérents %#', change => {
    expect(decodeSave({ ...inTransit, world: change(transit) })).toBeNull();
  });
});

describe('sauvegardes portables', () => {
  it('restaure les unités en transit et rejette les fichiers invalides ou de version inconnue', () => {
    expect(parseBackup(JSON.stringify(inTransit))).toEqual(inTransit);
    expect(parseBackup('{')).toBeNull();
    expect(parseBackup(JSON.stringify({ ...record, version: SAVE_VERSION + 1 }))).toBeNull();
  });

  it('rejette une quantité totale qui dépasse les entiers représentables', () => {
    const ledger = {
      ...record.world.ledger,
      purchased: { 'cpu-8c': Number.MAX_SAFE_INTEGER },
      produced: { 'cpu-8c': 1 },
    };
    const overflow = { ...record, world: { ...record.world, ledger } };
    expect(parseBackup(JSON.stringify(overflow))).toBeNull();
  });
});

describe('personnel dans la sauvegarde', () => {
  it('restaure les employés et le vivier, et donne des opérateurs de base aux ateliers v9 en progression', () => {
    let world = run(createWorld(), { kind: 'build', type: 'assembler', x: 30, y: 30, rotation: 0 });
    const [candidate] = world.staff.candidates;
    if (!candidate) throw new Error('vivier vide');
    world = run(run(world, { kind: 'hire', candidate: candidate.id }), { kind: 'assign', employee: 1, machine: 1 });
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const forged = world.staff.employees.map(employee => ({ ...employee, morale: 0 }));
    expect(decodeSave({ ...saved, world: { ...world, staff: { ...world.staff, employees: forged } } })).toBeNull();

    // A progression workshop past Conditionnement, saved before staff existed.
    const completed = ['assembly-bench', 'quality-control', 'flow-control', 'packaging'] as const;
    const delivered = { 'case-standard': 10, 'psu-650': 10, 'pc-office': 5, 'pc-office-tested': 30 };
    const progression = createWorld('progression');
    const legacyWorld: Record<string, unknown> = {
      ...run(
        { ...progression, progress: { ...progression.progress, completed: [...completed] } },
        { kind: 'build', type: 'assembler', x: 30, y: 30, rotation: 0 },
      ),
      ledger: {
        ...progression.ledger, delivered,
        purchased: { 'case-standard': 10, 'psu-650': 10 },
        produced: { 'pc-office': 5, 'pc-office-tested': 30 },
      },
    };
    delete legacyWorld.staff;
    delete legacyWorld.sites;
    delete legacyWorld.floors;
    delete legacyWorld.parcels;
    for (const key of ['utilities', 'cables', 'wear', 'company']) delete legacyWorld[key];
    Object.assign(legacyWorld, OLD_MAP);
    const migrated = decodeSave({ ...record, version: 9, world: legacyWorld });
    expect(migrated?.world.staff.employees).toMatchObject([{ id: 1, skill: 2, machineId: 1, morale: 70 }]);
    expect(migrated?.world.staff.candidates).toHaveLength(5);
  });
});

describe('sols dans la sauvegarde', () => {
  it('restaure les sols peints, rejette un sol invalide et migre la v10 sur béton nu', () => {
    const world = run(createWorld(), { kind: 'paint-floor', tiles: [{ x: 3, y: 4 }, { x: 4, y: 4 }], floor: 'clean' });
    expect(world.floors).toEqual({ 515: 'clean', 516: 'clean' });
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, floors: { 515: 'concrete' } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, floors: { 99999: 'wood' } } })).toBeNull();
    const v10 = JSON.parse(JSON.stringify({ ...saved, version: 10 }));
    delete v10.world.sites;
    withoutRoles(v10);
    delete v10.world.floors;
    delete v10.world.parcels;
    for (const key of ['utilities', 'cables', 'wear', 'company']) delete v10.world[key];
    Object.assign(v10.world, OLD_MAP);
    expect(decodeSave(v10)?.world.floors).toEqual({});
    expect(decodeSave({ ...v10, world: { ...v10.world, floors: {} } })).toBeNull();
  });
});

describe('parcelles dans la sauvegarde', () => {
  it('restaure les parcelles achetées et migre un atelier v11 de 64 × 64 sans déplacer ses sols', () => {
    const world = run(createWorld(), { kind: 'buy-parcel', parcel: 2 });
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, parcels: [0, 1, 3, 4, 5] } })).toBeNull();

    const painted = run(createWorld(), { kind: 'paint-floor', tiles: [{ x: 3, y: 4 }, { x: 63, y: 63 }], floor: 'wood' });
    const v11 = JSON.parse(JSON.stringify({ ...record, version: 11, world: painted }));
    delete v11.world.sites;
    withoutRoles(v11);
    delete v11.world.parcels;
    for (const key of ['utilities', 'cables', 'wear', 'company']) delete v11.world[key];
    Object.assign(v11.world, OLD_MAP, { floors: { [4 * 64 + 3]: 'wood', [63 * 64 + 63]: 'wood' } });
    const migrated = decodeSave(v11);
    expect(migrated?.world.floors).toEqual(painted.floors);
    expect(migrated?.world).toMatchObject({ columns: 128, rows: 128, parcels: [0, 1, 4, 5] });
  });
});

describe('carrière dans la sauvegarde', () => {
  it('restaure la spécialité, les prêts et les ventes au grossiste, et relit un atelier v12 sans carrière', () => {
    let world = run(run(createWorld('career'), { kind: 'choose-specialty', specialty: 'passives' }), { kind: 'take-loan', offer: 'starter' });
    world = { ...world, progress: { ...world.progress, career: world.progress.career && { ...world.progress.career, missed: 1 } } };
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const career = world.progress.career;
    if (!career) throw new Error('carrière absente');
    expect(decodeSave({ ...saved, world: { ...world, progress: { ...world.progress, career: { ...career, missed: 3 } } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, progress: { ...world.progress, career: { ...career, technologies: ['pcb'] } } } })).toBeNull();
    const v12 = JSON.parse(JSON.stringify({ ...record, version: 12 }));
    delete v12.world.sites;
    withoutRoles(v12);
    for (const key of ['utilities', 'cables', 'wear', 'company']) delete v12.world[key];
    expect(decodeSave(v12)).toEqual({ ...record, world: asLegacy(record.world) });
  });
});

describe('énergie et usure dans la sauvegarde', () => {
  it('restaure câbles, usure, factures et machines Mk3, et relit un atelier v13 sans électricité', () => {
    let world = createWorld('sandbox', { utilities: true });
    world = run(run(run(world, { kind: 'build', type: 'assembler', x: 10, y: 10, rotation: 0 }), { kind: 'upgrade', id: 1 }), { kind: 'upgrade', id: 1 });
    world = run(world, { kind: 'lay-cable', tiles: [{ x: 10, y: 12 }, { x: 11, y: 12 }] });
    world = { ...world, wear: { 1: 40 } };
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, wear: { 1: 999 } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, cables: [99_999] } })).toBeNull();
    const v13 = JSON.parse(JSON.stringify({ ...record, version: 13 }));
    delete v13.world.sites;
    withoutRoles(v13);
    for (const key of ['utilities', 'cables', 'wear', 'company']) delete v13.world[key];
    expect(decodeSave(v13)?.world).toMatchObject({ utilities: { enabled: false }, cables: [], wear: {} });
  });
});

describe('rôles et entreprise dans la sauvegarde', () => {
  it('restaure les rôles, le réassort et la marque, et fait des employés v14 des opérateurs', () => {
    let world = run(createWorld(), { kind: 'build', type: 'receiving', x: 20, y: 10, rotation: 0 });
    world = run(run(world, { kind: 'set-restock', id: 1, items: ['cpu-8c'] }), { kind: 'brand', company: { color: 'rose', emblem: 'gear' } });
    const [candidate] = world.staff.candidates;
    if (!candidate) throw new Error('vivier vide');
    world = run(world, { kind: 'hire', candidate: candidate.id });
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const forged = world.staff.employees.map(employee => ({ ...employee, role: 'pilot' }));
    expect(decodeSave({ ...saved, world: { ...world, staff: { ...world.staff, employees: forged } } })).toBeNull();
    const v14 = withoutRoles(JSON.parse(JSON.stringify({ ...saved, version: 14 })));
    delete v14.world.sites;
    delete v14.world.company;
    delete v14.world.machines[0].restock;
    const migrated = decodeSave(v14);
    expect(migrated?.world.staff.employees.map(employee => employee.role)).toEqual(['operator']);
    expect(migrated?.world.staff.candidates).toEqual(world.staff.candidates);
    expect(migrated?.world.company).toEqual({ color: 'lime', emblem: 'chip' });
  });
});

describe('époques dans la sauvegarde', () => {
  it('restaure l’année de départ et l’époque, et place les carrières v15 en 2017', () => {
    let world = run(createWorld('career', { startYear: 1985 }), { kind: 'choose-specialty', specialty: 'pcb' });
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const career = world.progress.career;
    if (!career) throw new Error('carrière absente');
    expect(career).toMatchObject({ startYear: 1985, released: '16bit', era: '16bit' });
    const forge = (patch: Record<string, unknown>) => ({ ...saved, world: { ...world, progress: { ...world.progress, career: { ...career, ...patch } } } });
    expect(decodeSave(forge({ startYear: 1990 }))).toBeNull();
    expect(decodeSave(forge({ released: '32bit' }))).toBeNull();
    expect(decodeSave(forge({ era: 'steam' }))).toBeNull();
    world = createWorld('career');
    const v15 = JSON.parse(JSON.stringify({ ...record, version: 15, world }));
    delete v15.world.sites;
    for (const key of ['startYear', 'released', 'era', 'retoolCents', 'abroad', 'competition', 'houseChips']) delete v15.world.progress.career[key];
    expect(decodeSave(v15)).toEqual({ ...record, world });
    const plain = JSON.parse(JSON.stringify({ ...record, version: 15 }));
    delete plain.world.sites;
    expect(decodeSave(plain)).toEqual(record);
    expect(SAVE_VERSION).toBe(20);
  });
});

describe('usines à l’étranger dans la sauvegarde', () => {
  it('restaure les usines et les expéditions, et relit une carrière v16 sans usine', async () => {
    const { readFile } = await import('node:fs/promises');
    const fixture = JSON.parse(await readFile(new URL('../../../../tests/e2e/fixtures/career-world.json', import.meta.url), 'utf8'));
    const decoded = decodeSave(fixture);
    expect(decoded?.world.progress.career?.abroad.subsidiaries.map(subsidiary => subsidiary.region)).toEqual(['china', 'mexico']);
    expect(decoded?.world.progress.career?.abroad.shipments).toHaveLength(1);
    const forged = structuredClone(fixture);
    forged.world.progress.career.abroad.subsidiaries[1].region = 'china';
    expect(decodeSave(forged)).toBeNull();
    const spent = structuredClone(fixture);
    spent.world.progress.career.abroad.spentCents = 0;
    expect(decodeSave(spent)).toBeNull();
    const world = createWorld('career');
    const v16 = JSON.parse(JSON.stringify({ ...record, version: 16, world }));
    delete v16.world.sites;
    delete v16.world.progress.career.abroad;
    delete v16.world.progress.career.competition;
    delete v16.world.progress.career.houseChips;
    expect(decodeSave(v16)).toEqual({ ...record, world });
  });
});

describe('concurrence dans la sauvegarde', () => {
  it('restaure les marchés et les rivaux, rejette un indice hors bornes et migre une carrière v17', () => {
    const world = createWorld('career', { startYear: 1995 });
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(world.progress.career?.competition.rivals.map(rival => rival.id)).toEqual(['helion', 'vortek', 'norrland', 'kaori', 'xinhe']);
    const forged = JSON.parse(JSON.stringify(saved));
    forged.world.progress.career.competition.prices.office = 500;
    expect(decodeSave(forged)).toBeNull();
    const v17 = JSON.parse(JSON.stringify({ ...saved, version: 17 }));
    delete v17.world.sites;
    delete v17.world.progress.career.competition;
    delete v17.world.progress.career.houseChips;
    expect(decodeSave(v17)).toEqual(saved);
  });
});

describe('puces maison dans la sauvegarde', () => {
  it('restaure les puces maison, rejette une puce inconnue et ouvre les marchés de puces d’une carrière v18', () => {
    const base = createWorld('career', { startYear: 1995 });
    const career = base.progress.career;
    if (!career) throw new Error('carrière absente');
    const world = {
      ...base, capitalCents: 0,
      progress: { ...base.progress, career: { ...career, specialty: 'passives' as const, technologies: ['passives', 'pcb', 'smt', 'computers', 'semiconductors'] as TechId[], borrowedCents: 37_000_000, houseChips: ['cpu' as const] } },
    };
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const forged = JSON.parse(JSON.stringify(saved));
    forged.world.progress.career.houseChips = ['ssd'];
    expect(decodeSave(forged)).toBeNull();
    const v18 = JSON.parse(JSON.stringify({ ...saved, version: 18 }));
    delete v18.world.sites;
    const old = v18.world.progress.career;
    old.houseChips = undefined;
    delete old.houseChips;
    for (const chip of ['chip-ram', 'chip-cpu', 'chip-gpu']) {
      delete old.competition.prices[chip];
      for (const rival of old.competition.rivals) delete rival.supply[chip];
    }
    const migrated = decodeSave(v18);
    expect(migrated?.world.progress.career?.houseChips).toEqual([]);
    expect(migrated?.world.progress.career?.competition).toEqual(career.competition);
  });
});

describe('usines constructibles dans la sauvegarde', () => {
  it('donne un terrain aux usines des anciennes sauvegardes et restaure les bâtiments d’un site', async () => {
    const { readFile } = await import('node:fs/promises');
    const fixture = JSON.parse(await readFile(new URL('../../../../tests/e2e/fixtures/career-world.json', import.meta.url), 'utf8'));
    const migrated = decodeSave(fixture);
    expect(migrated?.world.sites.map(site => site.region)).toEqual(['china', 'mexico']);
    if (!migrated) throw new Error('sauvegarde illisible');
    const built = applyCommand(migrated.world, { kind: 'at-site', region: 'china', command: { kind: 'build', type: 'storage', x: 12, y: 12, rotation: 0 } });
    if (!built.ok) throw new Error(built.reason);
    const saved: SaveRecord = { ...migrated, world: built.world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    const forged = JSON.parse(JSON.stringify(saved));
    forged.world.sites.reverse();
    expect(decodeSave(forged)).toBeNull();
  });
});
