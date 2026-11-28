import { LAND, REGIONS } from '@silicon-empire/game-data';
import type { MachineType, RegionId } from '@silicon-empire/game-data';
import type { Machine, World } from './world';

/**
 * Buildable factory abroad: its own land and layout, next to the home workshop. Capital, career,
 * staff, ledger, wear and calendars stay shared by the company; machine and unit ids are unique
 * across every site.
 */
export interface Site {
  readonly region: RegionId;
  readonly machines: World['machines'];
  readonly stocks: World['stocks'];
  readonly belts: World['belts'];
  readonly routers: World['routers'];
  readonly production: World['production'];
  readonly floors: World['floors'];
  readonly parcels: World['parcels'];
  readonly cables: World['cables'];
}

/** Fields of a world that belong to one site. */
export const SITE_LAYOUT_KEYS = ['machines', 'stocks', 'belts', 'routers', 'production', 'floors', 'parcels', 'cables'] as const;

/** Buildings that only exist at the home workshop. */
export const HOME_ONLY_MACHINES: readonly MachineType[] = ['headquarters', 'lab'];

export function createSite(region: RegionId): Site {
  return {
    region, machines: [], stocks: {}, belts: {}, routers: {}, production: {}, floors: {}, parcels: [...LAND.initialParcels], cables: [],
  };
}

export function siteOf(world: World, region: RegionId): Site | undefined {
  return world.sites.find(site => site.region === region);
}

/**
 * The world as seen from a site: its layout with the company's shared state. The engine runs
 * unchanged on it; `region` tells the few rules that differ abroad.
 */
export function siteView(world: World, region: RegionId): World {
  const site = siteOf(world, region);
  if (!site) throw new RangeError(`Site absent : ${region}.`);
  return {
    ...world, machines: site.machines, stocks: site.stocks, belts: site.belts, routers: site.routers, production: site.production,
    floors: site.floors, parcels: site.parcels, cables: site.cables, region,
  };
}

/** Puts a site view back: its layout into the site, its shared state into the world. */
export function withSite(world: World, view: World): World {
  const region = view.region;
  if (!region) return view;
  const site: Site = {
    region, machines: view.machines, stocks: view.stocks, belts: view.belts, routers: view.routers, production: view.production,
    floors: view.floors, parcels: view.parcels, cables: view.cables,
  };
  const shared: World = { ...view };
  delete (shared as { region?: RegionId }).region;
  return {
    ...shared,
    tick: world.tick,
    machines: world.machines, stocks: world.stocks, belts: world.belts, routers: world.routers, production: world.production,
    floors: world.floors, parcels: world.parcels, cables: world.cables,
    sites: world.sites.map(candidate => candidate.region === region ? site : candidate),
  };
}

/** The home workshop, then every site, each as a world. */
export function layoutsOf(world: World): World[] {
  return [world, ...world.sites.map(site => siteView(world, site.region))];
}

/** Price of materials bought at a site, in percent of the home price. */
export function regionalMaterialPercent(world: World): number {
  return world.region ? REGIONS[world.region].materialPercent : 100;
}

/** A layout by place: the home workshop itself, or the view of a site. */
export function layoutAt(world: World, place: RegionId | 'home'): World | undefined {
  if (place === 'home') return world;
  return siteOf(world, place) ? siteView(world, place) : undefined;
}

/** Every building of the company, home workshop first. */
export function allMachines(world: World): readonly Machine[] {
  return [...world.machines, ...world.sites.flatMap(site => site.machines)];
}

/** Place of a building: the site whose layout holds it, else the home workshop. */
export function placeOfMachine(world: World, id: number): RegionId | 'home' {
  return world.sites.find(site => site.machines.some(machine => machine.id === id))?.region ?? 'home';
}

/** Monthly salaries: each employee at the wages of the site where they work; office and free staff at home wages. */
export function regionalPayroll(world: World): number {
  return world.staff.employees.reduce((total, employee) => {
    const place = employee.machineId === null ? 'home' : placeOfMachine(world, employee.machineId);
    const percent = place === 'home' ? 100 : REGIONS[place].wagePercent;
    return total + Math.ceil(employee.salaryCents * percent / 100);
  }, 0);
}
