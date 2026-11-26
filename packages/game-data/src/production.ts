import { designParts } from './design';
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

export function recipeOf(
  type: MachineType, model: ProductModel = 'office', design?: PublishedDesign | null,
): Recipe | undefined {
  if (model !== 'custom') return recipes[model]?.[type];
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
