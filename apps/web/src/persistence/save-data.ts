import {
  BRAND_COLORS, BRAND_EMBLEMS, COMPETITION, CONVEYOR, ERA_IDS, HOUSE_CHIPS, MARKET_DEMAND, MARKET_IDS, RIVALS, RIVAL_IDS, REGION_IDS, START_YEARS, SUBSIDIARY_DESTINATIONS, SUBSIDIARY_PRODUCTS, TRANSPORT_MODES, ITEM_TYPES, LAND, LOAN_IDS, MACHINE_TYPES, POWER, ROLES, ROLE_EFFECTS, WEAR, SPECIALTIES, TECH_IDS, MILESTONE_IDS, PRODUCT_MODELS, RESEARCH_IDS, STAFF, STANDARD_MODELS, SUPPLIER_IDS, WORKSHOP,
  publishedDesignSchema,
} from '@silicon-empire/game-data';
import {
  DEFAULT_COMPANY, ROTATIONS, createCompetition, ROUTER_SIDES, candidatesFor, checkIntegrity, createStaff, withRequiredStaff,
} from '@silicon-empire/simulation';
import { z } from 'zod';
import type { World } from '@silicon-empire/simulation';

export const SAVE_VERSION = 20;
const OLD_MAP = 64;
export const MAX_WORKSHOP_NAME = 40;

export function createSaveId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface SaveRecord {
  readonly version: typeof SAVE_VERSION;
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly savedAt: number;
  readonly world: World;
}

const safeDate = z.int().nonnegative().max(8_640_000_000_000_000);
const count = z.int().positive().max(Number.MAX_SAFE_INTEGER);
const machineId = z.string().regex(/^[1-9][0-9]{0,15}$/);
const inventory = z.partialRecord(z.enum(ITEM_TYPES), count);

const machineV1 = z.strictObject({
  id: z.int().positive(),
  type: z.enum(MACHINE_TYPES),
  x: z.int().nonnegative(),
  y: z.int().nonnegative(),
  rotation: z.union(ROTATIONS.map(rotation => z.literal(rotation))),
  paidCents: z.int().min(1).max(WORKSHOP.initialCapitalCents),
});

const machine = machineV1.extend({
  /** The headquarters is free to build. */
  paidCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  filter: z.strictObject({ item: z.enum(ITEM_TYPES), output: z.enum(ROUTER_SIDES) }).optional(),
});

const header = {
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().trim().min(1).max(MAX_WORKSHOP_NAME),
  createdAt: safeDate,
  savedAt: safeDate,
};

const layoutV1 = {
  /** Workshops before v0.9.1 cover 64 × 64 tiles. */
  columns: z.literal(OLD_MAP),
  rows: z.literal(OLD_MAP),
  capitalCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  nextMachineId: z.int().positive(),
  machines: z.array(machineV1).max(WORKSHOP.columns * WORKSHOP.rows),
};

/** Version 1 (v0.1.0): construction only. */
const saveV1 = z.strictObject({
  version: z.literal(1),
  ...header,
  world: z.strictObject(layoutV1),
});

const unit = { id: z.int().positive(), item: z.enum(ITEM_TYPES) };

/** Version 2 (v0.2.0): clock, purchases, inventories and conveyor contents. */
const worldV2 = {
  ...layoutV1,
  tick: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  nextItemId: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  stocks: z.record(machineId, inventory),
  belts: z.record(machineId, z.array(z.strictObject({
    ...unit,
    position: z.int().nonnegative().max(CONVEYOR.lengthUnits - 1),
  }))),
  ledger: z.strictObject({
    purchased: inventory,
    discarded: inventory,
    purchaseSpentCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  }),
};

const saveV2 = z.strictObject({
  version: z.literal(2),
  ...header,
  world: z.strictObject(worldV2),
});

/** Version 3 (v0.2.1): splitters, mergers and splitter filters. */
const worldV3 = {
  ...worldV2,
  machines: z.array(machine).max(WORKSHOP.columns * WORKSHOP.rows),
  routers: z.record(machineId, z.strictObject({
    held: z.strictObject(unit).nullable(),
    cursor: z.int().min(0).max(2),
  })),
};

const saveV3 = z.strictObject({
  version: z.literal(3),
  ...header,
  world: z.strictObject(worldV3),
});

const milestoneId = z.enum(MILESTONE_IDS);

/** Version 4 (v0.3.0): production machines, progression and the extended ledger. */
const worldV4 = {
  ...worldV3,
  production: z.record(machineId, z.strictObject({
    batch: z.strictObject({
      item: z.enum(ITEM_TYPES),
      remaining: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }).nullable(),
    output: inventory,
  })),
  progress: z.strictObject({
    sandbox: z.boolean(),
    completed: z.array(milestoneId).max(MILESTONE_IDS.length),
    active: milestoneId.nullable(),
    delivered: z.partialRecord(milestoneId, inventory),
  }),
  capitalCents: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ledger: z.strictObject({
    purchased: inventory,
    discarded: inventory,
    purchaseSpentCents: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    produced: inventory,
    consumed: inventory,
    delivered: inventory,
  }),
};

const saveV4 = z.strictObject({
  version: z.literal(4),
  ...header,
  world: z.strictObject(worldV4),
});

/** Version 5: the model chosen for each production machine. */
const saveV5 = z.strictObject({
  version: z.literal(5),
  ...header,
  world: z.strictObject({
    ...worldV4,
    machines: z.array(machine.extend({ model: z.enum(['office', 'gaming']).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
  }),
});

/** Version 6 supports professional models and PCs routed to the reject output. */
const worldV6 = {
  ...worldV4,
  machines: z.array(machine.extend({ model: z.enum(STANDARD_MODELS).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
};

const saveV6 = z.strictObject({
  version: z.literal(6),
  ...header,
  world: z.strictObject(worldV6),
});

const standardTerms = z.strictObject({
  model: z.enum(STANDARD_MODELS),
  revision: z.int().positive(),
  item: z.enum(ITEM_TYPES),
  units: z.int().positive(),
  unitPriceCents: z.int().positive(),
  unitMaterialCents: z.int().positive(),
});

const saveV7 = z.strictObject({
  version: z.literal(7),
  ...header,
  world: z.strictObject({
    ...worldV6,
    sales: z.strictObject({
      active: z.strictObject({ terms: standardTerms, delivered: z.int().nonnegative() }).nullable(),
      completed: z.array(standardTerms),
    }),
  }),
});

const saleTerms = standardTerms.extend({
  model: z.enum(PRODUCT_MODELS),
  design: publishedDesignSchema.optional(),
});

const saveV8 = z.strictObject({
  version: z.literal(8),
  ...header,
  world: z.strictObject({
    ...worldV6,
    machines: z.array(machine.extend({ model: z.enum(PRODUCT_MODELS).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
    sales: z.strictObject({
      active: z.strictObject({ terms: saleTerms, delivered: z.int().nonnegative() }).nullable(),
      completed: z.array(saleTerms),
    }),
    design: publishedDesignSchema.nullable(),
    deliveries: z.array(z.strictObject({
      dockId: z.int().positive(), dueTick: z.int().positive(), item: z.enum(ITEM_TYPES), supplier: z.enum(SUPPLIER_IDS),
    })),
  }),
});

function migrateV1(value: unknown): z.input<typeof saveV2> | null {
  const v1 = saveV1.safeParse(value);
  if (!v1.success) return null;
  const { data } = v1;
  return {
    ...data,
    version: 2,
    world: {
      ...data.world,
      tick: 0,
      nextItemId: 1,
      stocks: {},
      belts: {},
      ledger: { purchased: {}, discarded: {}, purchaseSpentCents: 0 },
    },
  };
}

function migrateV2(value: unknown): z.input<typeof saveV3> | null {
  const v2 = saveV2.safeParse(value);
  if (!v2.success) return null;
  const { data } = v2;
  return { ...data, version: 3, world: { ...data.world, routers: {} } };
}

/** Workshops built before the progression keep every building: they become sandbox games. */
function migrateV3(value: unknown): z.input<typeof saveV4> | null {
  const v3 = saveV3.safeParse(value);
  if (!v3.success) return null;
  const { data } = v3;
  return {
    ...data,
    version: 4,
    world: {
      ...data.world,
      production: {},
      progress: { sandbox: true, completed: [], active: null, delivered: {} },
      ledger: { ...data.world.ledger, produced: {}, consumed: {}, delivered: {} },
    },
  };
}

function migrateV4(value: unknown): z.input<typeof saveV5> | null {
  const v4 = saveV4.safeParse(value);
  if (!v4.success) return null;
  // Unconfigured machines continue their office recipes, including batches already in progress.
  return { ...v4.data, version: 5 };
}

function migrateV5(value: unknown): z.input<typeof saveV6> | null {
  const v5 = saveV5.safeParse(value);
  return v5.success ? { ...v5.data, version: 6 } : null;
}

function migrateV6(value: unknown): z.input<typeof saveV7> | null {
  const v6 = saveV6.safeParse(value);
  return v6.success
    ? { ...v6.data, version: 7, world: { ...v6.data.world, sales: { active: null, completed: [] } } }
    : null;
}

const researchId = z.enum(RESEARCH_IDS);

/** Version 9 (v0.6.0): research and Mk2 machines. */
const saveV9 = z.strictObject({
  version: z.literal(9),
  ...header,
  world: z.strictObject({
    ...saveV8.shape.world.shape,
    machines: z.array(machine.extend({
      model: z.enum(PRODUCT_MODELS).optional(),
      level: z.literal(2).optional(),
    })).max(WORKSHOP.columns * WORKSHOP.rows),
    research: z.strictObject({
      active: researchId.nullable(),
      delivered: z.partialRecord(researchId, inventory),
      analysing: z.strictObject({ id: researchId, remaining: z.int().positive() }).nullable(),
      completed: z.array(researchId).max(RESEARCH_IDS.length),
    }),
  }),
});

const person = {
  name: z.string().min(1).max(60),
  skill: z.literal([1, 2, 3, 4, 5]),
  salaryCents: count,
};
const tick = z.int().positive().max(Number.MAX_SAFE_INTEGER);

/** Version 10 (v0.8.0): staff, candidate pool and salaries. */
const saveV10 = z.strictObject({
  version: z.literal(10),
  ...header,
  world: z.strictObject({
    ...saveV9.shape.world.shape,
    staff: z.strictObject({
      employees: z.array(z.strictObject({
        id: count, ...person, morale: z.int().min(1).max(100), machineId: count.nullable(),
      })).max(STAFF.maxEmployees),
      candidates: z.array(z.strictObject({ id: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER), ...person })).max(STAFF.maxPoolSize),
      pool: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      nextEmployeeId: count,
      paidCents: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      nextPayday: tick,
      nextPool: tick,
    }),
  }),
});

const tileIndex = z.string().regex(/^(0|[1-9][0-9]{0,15})$/);

/** Version 11 (v0.9.0): walls, doors, furniture and painted floors. */
const saveV11 = z.strictObject({
  version: z.literal(11),
  ...header,
  world: z.strictObject({
    ...saveV10.shape.world.shape,
    floors: z.record(tileIndex, z.enum(['tiles', 'wood', 'clean'])),
  }),
});

function migrateV7(value: unknown): z.input<typeof saveV8> | null {
  const v7 = saveV7.safeParse(value);
  return v7.success
    ? { ...v7.data, version: 8, world: { ...v7.data.world, design: null, deliveries: [] } }
    : null;
}

function migrateV8(value: unknown): z.input<typeof saveV9> | null {
  const v8 = saveV8.safeParse(value);
  return v8.success
    ? {
      ...v8.data,
      version: 9,
      world: { ...v8.data.world, research: { active: null, delivered: {}, analysing: null, completed: [] } },
    }
    : null;
}

/**
 * Older workshops start with no staff and the first candidate pool. In progression past the staffing
 * milestone, the Direction assigns a base operator to each production machine so that lines keep running.
 */
/** Returns a version 10 record, checked again by the version 10 schema when decoded. */
function migrateV9(value: unknown): unknown {
  const v9 = saveV9.safeParse(value);
  if (!v9.success) return null;
  const { staff } = withRequiredStaff({
    ...v9.data.world, staff: createStaff(v9.data.world.tick), floors: {}, parcels: [...LAND.initialParcels],
    utilities: { enabled: false, cut: false, nextBill: 1, spentCents: 0 }, cables: [], wear: {}, company: DEFAULT_COMPANY, sites: [],
  });
  // Roles arrive with v15: the v10 record keeps employees without one.
  const employees = staff.employees.map(employee => ({
    id: employee.id, name: employee.name, skill: employee.skill, salaryCents: employee.salaryCents,
    morale: employee.morale, machineId: employee.machineId,
  }));
  const candidates = staff.candidates.map(candidate => ({
    id: candidate.id, name: candidate.name, skill: candidate.skill, salaryCents: Math.round(candidate.salaryCents * 100 / ROLE_EFFECTS.salaryPercent[candidate.role]),
  }));
  return { ...v9.data, version: 10, world: { ...v9.data.world, staff: { ...staff, employees, candidates } } };
}

/** Older workshops have bare concrete everywhere. */
function migrateV10(value: unknown): z.input<typeof saveV11> | null {
  const v10 = saveV10.safeParse(value);
  return v10.success ? { ...v10.data, version: 11, world: { ...v10.data.world, floors: {} } } : null;
}

/** Version 12 (v0.9.1): the 128 × 128 land and the parcels owned. */
const saveV12 = z.strictObject({
  version: z.literal(12),
  ...header,
  world: z.strictObject({
    ...saveV11.shape.world.shape,
    columns: z.literal(WORKSHOP.columns),
    rows: z.literal(WORKSHOP.rows),
    parcels: z.array(z.int().nonnegative().max(LAND.gridColumns * LAND.gridRows - 1)).max(LAND.gridColumns * LAND.gridRows),
  }),
});

/**
 * The 64 × 64 workshop becomes the four starting parcels of the larger land. Buildings keep their
 * coordinates; floors are indexed again for the wider rows.
 */
function migrateV11(value: unknown): z.input<typeof saveV12> | null {
  const v11 = saveV11.safeParse(value);
  if (!v11.success) return null;
  const floors = Object.fromEntries(Object.entries(v11.data.world.floors).map(([key, floor]) => {
    const index = Number(key);
    return [String(Math.floor(index / OLD_MAP) * WORKSHOP.columns + index % OLD_MAP), floor];
  }));
  return {
    ...v11.data,
    version: 12,
    world: {
      ...v11.data.world, columns: WORKSHOP.columns, rows: WORKSHOP.rows, floors, parcels: [...LAND.initialParcels],
    },
  };
}

const count0 = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Version 13 (v0.10.0): career workshops keep their specialty, licences, loans and wholesale sales. */
const saveV13 = z.strictObject({
  version: z.literal(13),
  ...header,
  world: z.strictObject({
    ...saveV12.shape.world.shape,
    progress: z.strictObject({
      ...saveV12.shape.world.shape.progress.shape,
      career: z.strictObject({
        specialty: z.enum(SPECIALTIES).nullable(),
        technologies: z.array(z.enum(TECH_IDS)).max(TECH_IDS.length),
        loans: z.array(z.strictObject({ offer: z.enum(LOAN_IDS), remaining: z.int().positive().max(1_000) })).max(LOAN_IDS.length),
        borrowedCents: count0,
        repaidCents: count0,
        missed: z.int().nonnegative().max(100),
        bankrupt: z.boolean(),
        nextInstalment: z.int().positive().max(Number.MAX_SAFE_INTEGER),
        marketRevenueCents: count0,
        marketShipped: inventory,
      }).optional(),
    }),
  }),
});

/** Earlier workshops are classic or sandbox: nothing to add. */
function migrateV12(value: unknown): z.input<typeof saveV13> | null {
  const v12 = saveV12.safeParse(value);
  return v12.success ? { ...v12.data, version: 13 } : null;
}

/** Version 14 (v0.11.0): Mk3 machines, electricity, cables and wear. */
const saveV14 = z.strictObject({
  version: z.literal(14),
  ...header,
  world: z.strictObject({
    ...saveV13.shape.world.shape,
    machines: z.array(machine.extend({
      model: z.enum(PRODUCT_MODELS).optional(),
      level: z.union([z.literal(2), z.literal(3)]).optional(),
    })).max(WORKSHOP.columns * WORKSHOP.rows),
    utilities: z.strictObject({
      enabled: z.boolean(),
      cut: z.boolean(),
      nextBill: z.int().positive().max(Number.MAX_SAFE_INTEGER),
      spentCents: count0,
    }),
    cables: z.array(z.int().nonnegative().max(WORKSHOP.columns * WORKSHOP.rows - 1)).max(WORKSHOP.columns * WORKSHOP.rows),
    wear: z.record(machineId, z.int().positive().max(WEAR.breakdown)),
  }),
});

/** Earlier workshops keep running without power or wear; their bill calendar starts at the saved tick. */
function migrateV13(value: unknown): z.input<typeof saveV14> | null {
  const v13 = saveV13.safeParse(value);
  if (!v13.success) return null;
  const { tick } = v13.data.world;
  return {
    ...v13.data,
    version: 14,
    world: {
      ...v13.data.world,
      utilities: { enabled: false, cut: false, nextBill: tick + POWER.billPeriodTicks, spentCents: 0 }, cables: [], wear: {},
    },
  };
}

const role = z.enum(ROLES);
const staffV14 = saveV14.shape.world.shape.staff;

/** Version 15 (v0.12.0): roles, restock lists and the company brand. */
const saveV15 = z.strictObject({
  version: z.literal(15),
  ...header,
  world: z.strictObject({
    ...saveV14.shape.world.shape,
    machines: z.array(machine.extend({
      model: z.enum(PRODUCT_MODELS).optional(),
      level: z.union([z.literal(2), z.literal(3)]).optional(),
      restock: z.array(z.enum(ITEM_TYPES)).min(1).max(ROLE_EFFECTS.maxRestockItems).optional(),
    })).max(WORKSHOP.columns * WORKSHOP.rows),
    staff: z.strictObject({
      ...staffV14.shape,
      employees: z.array(staffV14.shape.employees.element.extend({ role })).max(STAFF.maxEmployees),
      candidates: z.array(staffV14.shape.candidates.element.extend({ role })).max(STAFF.maxPoolSize),
    }),
    company: z.strictObject({ color: z.enum(BRAND_COLORS), emblem: z.enum(BRAND_EMBLEMS) }),
  }),
});

/**
 * Employees of earlier versions were all operators. The pool is drawn again with roles: names and
 * skills are those of the saved candidates, salaries follow the role.
 */
function migrateV14(value: unknown): z.input<typeof saveV15> | null {
  const v14 = saveV14.safeParse(value);
  if (!v14.success) return null;
  const { staff } = v14.data.world;
  const drawn = candidatesFor(staff.pool, STAFF.maxPoolSize);
  return {
    ...v14.data,
    version: 15,
    world: {
      ...v14.data.world,
      staff: {
        ...staff,
        employees: staff.employees.map(employee => ({ ...employee, role: 'operator' as const })),
        candidates: drawn.filter(candidate => staff.candidates.some(saved => saved.id === candidate.id)),
      },
      company: { ...DEFAULT_COMPANY },
    },
  };
}

const careerV15 = saveV15.shape.world.shape.progress.shape.career.unwrap();
const salesV15 = saveV15.shape.world.shape.sales;
const termsV16 = salesV15.shape.completed.element.extend({
  era: z.enum(ERA_IDS.filter((era): era is Exclude<typeof era, 'modern'> => era !== 'modern')).optional(),
});

/** Version 16 (v0.13.0): career calendar, eras on sale and adopted, historical contracts. */
const saveV16 = z.strictObject({
  version: z.literal(16),
  ...header,
  world: z.strictObject({
    ...saveV15.shape.world.shape,
    progress: z.strictObject({
      ...saveV15.shape.world.shape.progress.shape,
      career: careerV15.extend({
        startYear: z.union(START_YEARS.map(year => z.literal(year))),
        released: z.enum(ERA_IDS),
        era: z.enum(ERA_IDS),
        retoolCents: count0,
      }).optional(),
    }),
    sales: z.strictObject({
      active: z.strictObject({ terms: termsV16, delivered: z.int().nonnegative() }).nullable(),
      completed: z.array(termsV16),
    }),
  }),
});

/** Careers of earlier versions run in the modern era, from 2017. */
function migrateV15(value: unknown): z.input<typeof saveV16> | null {
  const v15 = saveV15.safeParse(value);
  if (!v15.success) return null;
  const { career, ...progress } = v15.data.world.progress;
  return {
    ...v15.data,
    version: 16,
    world: {
      ...v15.data.world,
      progress: career ? { ...progress, career: { ...career, startYear: 2017, released: 'modern', era: 'modern', retoolCents: 0 } } : progress,
    },
  };
}

const careerV16 = saveV16.shape.world.shape.progress.shape.career.unwrap();
const region = z.enum(REGION_IDS);
const subsidiaryProduct = z.enum(SUBSIDIARY_PRODUCTS);
const abroadSchema = z.strictObject({
  subsidiaries: z.array(z.strictObject({
    region,
    product: subsidiaryProduct.nullable(),
    destination: z.enum(SUBSIDIARY_DESTINATIONS),
    mode: z.enum(TRANSPORT_MODES),
    dockId: z.int().positive().nullable(),
    nextRun: z.int().positive().max(Number.MAX_SAFE_INTEGER),
    idle: z.boolean(),
  })).max(REGION_IDS.length),
  shipments: z.array(z.strictObject({
    id: z.int().positive().max(Number.MAX_SAFE_INTEGER),
    region,
    item: subsidiaryProduct,
    units: z.int().positive().max(10_000),
    destination: z.enum(['export', 'dock']),
    dockId: z.int().positive().nullable(),
    dueTick: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  })).max(10_000),
  nextShipmentId: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  spentCents: count0,
  revenueCents: count0,
  imported: inventory,
});

/** Version 17 (v0.15.0): factories abroad and their shipments. */
const saveV17 = z.strictObject({
  version: z.literal(17),
  ...header,
  world: z.strictObject({
    ...saveV16.shape.world.shape,
    progress: z.strictObject({
      ...saveV16.shape.world.shape.progress.shape,
      career: careerV16.extend({ abroad: abroadSchema }).optional(),
    }),
  }),
});

/** Careers of earlier versions have no factory abroad yet. */
function migrateV16(value: unknown): z.input<typeof saveV17> | null {
  const v16 = saveV16.safeParse(value);
  if (!v16.success) return null;
  const { career, ...progress } = v16.data.world.progress;
  return {
    ...v16.data,
    version: 17,
    world: { ...v16.data.world, progress: career ? { ...progress, career: { ...career, abroad: { subsidiaries: [], shipments: [], nextShipmentId: 1, spentCents: 0, revenueCents: 0, imported: {} } } } : progress },
  };
}

const careerV17 = saveV17.shape.world.shape.progress.shape.career.unwrap();
/** Markets of v0.16.0, before the chip markets. */
const market = z.enum(['capacitor-reel', 'bare-pcb', 'transformer', 'circuit-board', 'office', 'gaming', 'professional']);
const marketUnits = z.partialRecord(market, count0);
const competitionSchema = z.strictObject({
  prices: z.record(market, z.int().min(COMPETITION.minPercent).max(COMPETITION.maxPercent)),
  rivals: z.array(z.strictObject({ id: z.enum(RIVAL_IDS), supply: z.partialRecord(market, count0) })).max(RIVAL_IDS.length),
  sold: marketUnits,
  lastSold: marketUnits,
  nextMonth: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  news: z.array(z.strictObject({
    tick: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    kind: z.enum(['entry', 'price-war']),
    rival: z.enum(RIVAL_IDS),
    market: market.nullable(),
  })).max(COMPETITION.maxNews),
});

/** Version 18 (v0.16.0): markets, rivals and price indexes. */
const saveV18 = z.strictObject({
  version: z.literal(18),
  ...header,
  world: z.strictObject({
    ...saveV17.shape.world.shape,
    progress: z.strictObject({
      ...saveV17.shape.world.shape.progress.shape,
      career: careerV17.extend({ competition: competitionSchema }).optional(),
    }),
  }),
});

/** Careers of earlier versions meet the rivals of their current year, prices at the reference. */
function migrateV17(value: unknown): z.input<typeof saveV18> | null {
  const v17 = saveV17.safeParse(value);
  if (!v17.success) return null;
  const { career, ...progress } = v17.data.world.progress;
  if (!career) return { ...v17.data, version: 18, world: { ...v17.data.world, progress } };
  const competition = createCompetition(career.startYear, v17.data.world.tick);
  return {
    ...v17.data,
    version: 18,
    world: {
      ...v17.data.world,
      progress: {
        ...progress,
        career: {
          ...career,
          // Version 18 knows only the markets of v0.16.0: chip markets arrive with the next migration.
          competition: {
            ...competition,
            prices: Object.fromEntries(market.options.map(id => [id, competition.prices[id]])) as Record<(typeof market.options)[number], number>,
            rivals: competition.rivals.map(rival => ({
              ...rival, supply: Object.fromEntries(Object.entries(rival.supply).filter(([id]) => (market.options as readonly string[]).includes(id))),
            })),
            news: [],
          },
        },
      },
    },
  };
}

const careerV18 = saveV18.shape.world.shape.progress.shape.career.unwrap();
const allMarkets = z.enum(MARKET_IDS);
const competitionV19 = competitionSchema.extend({
  prices: z.record(allMarkets, z.int().min(COMPETITION.minPercent).max(COMPETITION.maxPercent)),
  rivals: z.array(z.strictObject({ id: z.enum(RIVAL_IDS), supply: z.partialRecord(allMarkets, count0) })).max(RIVAL_IDS.length),
  sold: z.partialRecord(allMarkets, count0),
  lastSold: z.partialRecord(allMarkets, count0),
  news: z.array(competitionSchema.shape.news.element.extend({ market: allMarkets.nullable() })).max(COMPETITION.maxNews),
});
const termsV19 = termsV16.extend({ chips: z.array(z.enum(HOUSE_CHIPS)).min(1).max(HOUSE_CHIPS.length).optional() });

/** Version 19 (v0.17.0): chip markets, house chips in PCs and contracts with them. */
const saveV19 = z.strictObject({
  version: z.literal(19),
  ...header,
  world: z.strictObject({
    ...saveV18.shape.world.shape,
    progress: z.strictObject({
      ...saveV18.shape.world.shape.progress.shape,
      career: careerV18.extend({
        competition: competitionV19,
        houseChips: z.array(z.enum(HOUSE_CHIPS)).max(HOUSE_CHIPS.length),
      }).optional(),
    }),
    sales: z.strictObject({
      active: z.strictObject({ terms: termsV19, delivered: z.int().nonnegative() }).nullable(),
      completed: z.array(termsV19),
    }),
  }),
});

/** Chip markets open at the reference price; rivals that sell chips start with their entry share. */
function migrateV18(value: unknown): z.input<typeof saveV19> | null {
  const v18 = saveV18.safeParse(value);
  if (!v18.success) return null;
  const { career, ...progress } = v18.data.world.progress;
  if (!career) return { ...v18.data, version: 19, world: { ...v18.data.world, progress } };
  const chipMarkets = ['chip-ram', 'chip-cpu', 'chip-gpu'] as const;
  const { competition } = career;
  return {
    ...v18.data,
    version: 19,
    world: {
      ...v18.data.world,
      progress: {
        ...progress,
        career: {
          ...career,
          houseChips: [],
          competition: {
            ...competition,
            prices: { ...competition.prices, 'chip-ram': 100, 'chip-cpu': 100, 'chip-gpu': 100 },
            rivals: competition.rivals.map(rival => ({
              ...rival,
              supply: {
                ...rival.supply,
                ...Object.fromEntries(chipMarkets.flatMap(chip => {
                  const share = RIVALS[rival.id].markets[chip];
                  return share === undefined ? [] : [[chip, Math.round(MARKET_DEMAND[chip] * share / 100)]];
                })),
              },
            })),
          },
        },
      },
    },
  };
}

const worldV19 = saveV19.shape.world.shape;

/** Version 20 (v0.18.0): buildable sites abroad, one per factory. */
const saveV20 = z.strictObject({
  version: z.literal(SAVE_VERSION),
  ...header,
  world: z.strictObject({
    ...worldV19,
    sites: z.array(z.strictObject({
      region: z.enum(REGION_IDS),
      machines: worldV19.machines,
      stocks: worldV19.stocks,
      belts: worldV19.belts,
      routers: worldV19.routers,
      production: worldV19.production,
      floors: worldV19.floors,
      parcels: worldV19.parcels,
      cables: worldV19.cables,
    })).max(REGION_IDS.length),
  }),
});

/** Every factory bought before v0.18.0 gets its empty land. */
function migrateV19(value: unknown): z.input<typeof saveV20> | null {
  const v19 = saveV19.safeParse(value);
  if (!v19.success) return null;
  const factories = v19.data.world.progress.career?.abroad.subsidiaries ?? [];
  const sites = factories.map(factory => ({
    region: factory.region, machines: [], stocks: {}, belts: {}, routers: {}, production: {}, floors: {}, parcels: [...LAND.initialParcels], cables: [],
  }));
  return { ...v19.data, version: SAVE_VERSION, world: { ...v19.data.world, sites } };
}

const migrations = [migrateV1, migrateV2, migrateV3, migrateV4, migrateV5, migrateV6, migrateV7, migrateV8, migrateV9, migrateV10, migrateV11, migrateV12, migrateV13, migrateV14, migrateV15, migrateV16, migrateV17, migrateV18, migrateV19];

function versionOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'version' in value ? value.version : undefined;
}

/** Reads a stored record, migrating older versions. Returns null when the record is unusable. */
export function decodeSave(value: unknown): SaveRecord | null {
  const version = versionOf(value);
  let current = value;
  if (typeof version === 'number' && Number.isInteger(version) && version >= 1) {
    for (const migrate of migrations.slice(version - 1)) current = migrate(current);
  }
  const decoded = saveV20.safeParse(current);
  if (!decoded.success) return null;

  const { data } = decoded;
  if (data.savedAt < data.createdAt) return null;
  try {
    return checkIntegrity(data.world) ? data : null;
  } catch (error) {
    // A malformed ledger can overflow the safe integer range when quantities are combined.
    if (error instanceof RangeError) return null;
    throw error;
  }
}
