import { designParts } from './design';
import { eraAssembly } from './eras';
import { ITEMS } from './items';
import type { EraId } from './eras';
import type { PublishedDesign } from './design';
import type { MachineType } from './construction';
import type { ItemType } from './items';

export const STANDARD_MODELS = ['office', 'gaming', 'professional'] as const;
export type StandardModel = (typeof STANDARD_MODELS)[number];
export const PRODUCT_MODELS = [...STANDARD_MODELS, 'custom'] as const;
export type ProductModel = (typeof PRODUCT_MODELS)[number];

export interface Recipe {
  /** Units consumed at once when a batch starts. */
  readonly inputs: Readonly<Partial<Record<ItemType, number>>>;
  readonly output: ItemType;
  /** Every nth batch is rejected across all machines running this recipe. */
  readonly rejection?: { readonly item: ItemType; readonly every: number };
  /** Duration of one batch at 20 ticks per second. */
  readonly ticks: number;
}

/**
 * Office is the default model for each production machine.
 * Inputs are consumed atomically when a batch starts and recorded as work in progress;
 * a finished unit waits in the machine while its output buffer is full.
 */
export const RECIPES = {
  assembler: {
    inputs: {
      'cpu-8c': 1, 'ram-16g': 1, 'ssd-1t': 1, 'motherboard-atx': 1, 'psu-650': 1, 'case-standard': 1,
    },
    output: 'pc-office',
    ticks: 600,
  },
  tester: {
    inputs: { 'pc-office': 1 },
    output: 'pc-office-tested',
    ticks: 200,
  },
  packager: {
    inputs: { 'pc-office-tested': 1, carton: 1 },
    output: 'pc-office-packaged',
    ticks: 160,
  },
} as const satisfies Partial<Record<MachineType, Recipe>>;

export type ProductionMachine = keyof typeof RECIPES;

export const GAMING_RECIPES = {
  assembler: {
    inputs: { ...RECIPES.assembler.inputs, 'gpu-8g': 1 },
    output: 'pc-gaming',
    ticks: 900,
  },
  tester: {
    inputs: { 'pc-gaming': 1 },
    output: 'pc-gaming-tested',
    ticks: 300,
  },
  packager: {
    inputs: { 'pc-gaming-tested': 1, carton: 1 },
    output: 'pc-gaming-packaged',
    ticks: 160,
  },
} as const satisfies Record<ProductionMachine, Recipe>;

export const PROFESSIONAL_RECIPES = {
  assembler: {
    inputs: {
      'cpu-8c': 1, 'gpu-8g': 1, 'ram-32g': 1, 'ssd-2t': 1, 'motherboard-atx': 1, 'psu-650': 1, 'case-standard': 1,
    },
    output: 'pc-professional',
    ticks: 1200,
  },
  tester: {
    inputs: { 'pc-professional': 1 },
    output: 'pc-professional-tested',
    rejection: { item: 'pc-professional-rejected', every: 8 },
    ticks: 400,
  },
  packager: {
    inputs: { 'pc-professional-tested': 1, carton: 1 },
    output: 'pc-professional-packaged',
    ticks: 160,
  },
} as const satisfies Record<ProductionMachine, Recipe>;

const recipes: Record<StandardModel, Partial<Record<MachineType, Recipe>>> = {
  office: RECIPES,
  gaming: GAMING_RECIPES,
  professional: PROFESSIONAL_RECIPES,
};

/** Career component machines: one recipe each, whatever the PC model setting. */
export const COMPONENT_RECIPES = {
  'capacitor-press': { inputs: { 'ceramic-powder': 2, 'copper-foil': 1 }, output: 'capacitor-reel', ticks: 240 },
  'pcb-etcher': { inputs: { 'fiberglass-sheet': 1, 'copper-foil': 2 }, output: 'bare-pcb', ticks: 300 },
  'coil-winder': { inputs: { 'copper-foil': 2, 'ferrite-core': 2 }, output: 'transformer', ticks: 400 },
  'smt-line': { inputs: { 'bare-pcb': 1, 'capacitor-reel': 2, transformer: 1 }, output: 'circuit-board', ticks: 600 },
  'ram-fab': { inputs: { 'silicon-wafer': 1, 'chip-substrate': 1 }, output: 'chip-ram', ticks: 300 },
  'cpu-fab': { inputs: { 'silicon-wafer': 2, 'chip-substrate': 1 }, output: 'chip-cpu', ticks: 600 },
  'gpu-fab': { inputs: { 'silicon-wafer': 2, 'chip-substrate': 2 }, output: 'chip-gpu', ticks: 600 },
} as const satisfies Partial<Record<MachineType, Recipe>>;
export type ComponentMachine = keyof typeof COMPONENT_RECIPES;

export function isComponentMachine(type: MachineType): type is ComponentMachine {
  return type in COMPONENT_RECIPES;
}

/** Parts a career company can replace by its own chips in the PCs it assembles. */
export const HOUSE_CHIPS = ['cpu', 'gpu', 'ram'] as const;
export type HouseChip = (typeof HOUSE_CHIPS)[number];
export const HOUSE_CHIP_ITEMS: Readonly<Record<HouseChip, ItemType>> = { cpu: 'chip-cpu', gpu: 'chip-gpu', ram: 'chip-ram' };

/** Assembly inputs with the bought processor, graphics card or memory replaced by the company's chip. */
export function withHouseChips(
  inputs: Readonly<Partial<Record<ItemType, number>>>, chips: readonly HouseChip[],
): Readonly<Partial<Record<ItemType, number>>> {
  if (chips.length === 0) return inputs;
  const result: Partial<Record<ItemType, number>> = {};
  for (const [item, count] of Object.entries(inputs) as [ItemType, number][]) {
    const { category } = ITEMS[item];
    const chip = (HOUSE_CHIPS as readonly string[]).includes(category) && chips.includes(category as HouseChip)
      ? HOUSE_CHIP_ITEMS[category as HouseChip] : item;
    result[chip] = (result[chip] ?? 0) + count;
  }
  return result;
}

/**
 * Recipe of a machine for a PC model. In a historical career era, the assembler takes the parts of the
 * era and the models it cannot build have no recipe; testers and packagers are the same in every era.
 */
export function recipeOf(
  type: MachineType, model: ProductModel = 'office', design?: PublishedDesign | null, era: EraId = 'modern',
  chips: readonly HouseChip[] = [],
): Recipe | undefined {
  const recipe = baseRecipe(type, model, design, era);
  return recipe && type === 'assembler' && chips.length > 0 ? { ...recipe, inputs: withHouseChips(recipe.inputs, chips) } : recipe;
}

function baseRecipe(type: MachineType, model: ProductModel, design: PublishedDesign | null | undefined, era: EraId): Recipe | undefined {
  if (isComponentMachine(type)) return COMPONENT_RECIPES[type];
  if (model !== 'custom' && era !== 'modern') {
    const inputs = eraAssembly(era, model);
    const recipe = recipes[model]?.[type];
    if (!inputs || !recipe) return undefined;
    return type === 'assembler' ? { ...recipe, inputs } : recipe;
  }
  if (model !== 'custom') return recipes[model]?.[type];
  if (era !== 'modern') return undefined;
  if (!design) return undefined;
  if (type === 'assembler') return { inputs: designParts(design.spec), output: 'pc-custom', ticks: 900 };
  if (type === 'tester') return { inputs: { 'pc-custom': 1 }, output: 'pc-custom-tested', ticks: 240 };
  if (type === 'packager') return { inputs: { 'pc-custom-tested': 1, carton: 1 }, output: 'pc-custom-packaged', ticks: 160 };
  return undefined;
}

export const PRODUCTION = {
  /** Each input buffer holds this many batches of its ingredient. */
  inputBatches: 2,
  /** Finished units per output, including the reject port if the recipe uses one. */
  outputCapacity: 2,
} as const;
