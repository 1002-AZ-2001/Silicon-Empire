import { ITEMS, ITEM_TYPES } from './items';
import { recipeOf } from './production';
import type { PublishedDesign } from './design';
import type { EraId } from './eras';
import type { ItemType } from './items';
import type { HouseChip, ProductModel, StandardModel } from './production';

export interface SaleTerms {
  readonly model: ProductModel;
  readonly revision: number;
  readonly item: ItemType;
  readonly units: number;
  readonly unitPriceCents: number;
  readonly unitMaterialCents: number;
  readonly design?: PublishedDesign;
  /** Career era of the PC parts; absent for the modern catalogue. */
  readonly era?: Exclude<EraId, 'modern'>;
  /** The company's own chips in the PC, in `HOUSE_CHIPS` order; absent when none. */
  readonly chips?: readonly HouseChip[];
}

const MARKET_PRICE: Record<StandardModel, number> = { office: 65_000, gaming: 97_500, professional: 115_000 };

export function saleOffer(model: StandardModel): SaleTerms;
export function saleOffer(model: ProductModel, design?: PublishedDesign | null, era?: EraId, chips?: readonly HouseChip[]): SaleTerms | undefined;
/** Catalogue terms of a contract; in a historical era, the material cost uses the parts of the era. */
export function saleOffer(
  model: ProductModel, design?: PublishedDesign | null, era: EraId = 'modern', chips: readonly HouseChip[] = [],
): SaleTerms | undefined {
  const assembly = recipeOf('assembler', model, design, era, chips);
  const testing = recipeOf('tester', model, design, era);
  const packaging = recipeOf('packager', model, design, era);
  if (!assembly || !packaging) return undefined;
  const parts = ITEM_TYPES.reduce((total, item) =>
    total + (assembly.inputs[item] ?? 0) * (ITEMS[item].unitCostCents ?? 0), 0);
  const every = testing?.rejection?.every;
  const material = (every ? Math.ceil(parts * every / (every - 1)) : parts) + (ITEMS.carton.unitCostCents ?? 0);
  if (model === 'custom') {
    if (!design) return undefined;
    const unitPriceCents = Math.ceil(material * 1.3 / 1000) * 1000;
    return { model, revision: design.revision, item: packaging.output, units: 10, unitPriceCents, unitMaterialCents: material, design };
  }
  return {
    model, revision: 1, item: packaging.output, units: 10, unitPriceCents: MARKET_PRICE[model], unitMaterialCents: material,
    ...era === 'modern' ? {} : { era },
    ...chips.length === 0 ? {} : { chips: [...chips] },
  };
}
