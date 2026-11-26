import { TIME } from './construction';

export const SUPPLIER_IDS = ['express', 'economy'] as const;
export type SupplierId = (typeof SUPPLIER_IDS)[number];

export const SUPPLIERS = {
  express: { pricePercent: 100, leadTicks: 0 },
  economy: { pricePercent: 85, leadTicks: TIME.ticksPerSecond * 90 },
} as const;
