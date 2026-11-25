import type { MachineType } from './construction';
import type { ItemType } from './items';

export interface Recipe {
  /** Units consumed at once when a batch starts. */
  readonly inputs: Readonly<Partial<Record<ItemType, number>>>;
  readonly output: ItemType;
  /** Duration of one batch at 20 ticks per second. */
  readonly ticks: number;
}

/**
 * Each production machine runs one fixed recipe.
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

export function recipeOf(type: MachineType): Recipe | undefined {
  return (RECIPES as Partial<Record<MachineType, Recipe>>)[type];
}

export const PRODUCTION = {
  /** Each input buffer holds this many batches of its ingredient. */
  inputBatches: 2,
  /** Finished units held before the output port. */
  outputCapacity: 2,
} as const;
