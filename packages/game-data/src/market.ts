import { ITEMS, ITEM_TYPES } from './items';
import { recipeOf } from './production';
import type { ItemType } from './items';
import type { ProductModel } from './production';

export interface SaleTerms {
  readonly model: ProductModel;
  readonly revision: number;
  readonly item: ItemType;
  readonly units: number;
  readonly unitPriceCents: number;
  readonly unitMaterialCents: number;
}

const MARKET_PRICE: Record<ProductModel, number> = { office: 65_000, gaming: 97_500, professional: 115_000 };

export function saleOffer(model: ProductModel): SaleTerms {
  const assembly = recipeOf('assembler', model);
  const testing = recipeOf('tester', model);
  const packaging = recipeOf('packager', model);
  if (!assembly || !packaging) throw new Error('Recette commerciale inconnue.');
  const parts = ITEM_TYPES.reduce((total, item) =>
    total + (assembly.inputs[item] ?? 0) * (ITEMS[item].unitCostCents ?? 0), 0);
  const every = testing?.rejection?.every;
  const material = (every ? Math.ceil(parts * every / (every - 1)) : parts) + (ITEMS.carton.unitCostCents ?? 0);
  return { model, revision: 1, item: packaging.output, units: 10, unitPriceCents: MARKET_PRICE[model], unitMaterialCents: material };
}
