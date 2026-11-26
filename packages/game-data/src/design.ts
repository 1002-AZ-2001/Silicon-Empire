import { z } from 'zod';
import type { ItemType } from './items';

export const DESIGN_OPTIONS = {
  memory: ['ram-16g', 'ram-32g'],
  storage: ['ssd-1t', 'ssd-2t'],
  graphics: ['integrated', 'gpu-8g'],
  power: ['psu-450', 'psu-650'],
} as const;

export const pcDesignSchema = z.strictObject({
  name: z.string().trim().min(1).max(36),
  memory: z.enum(DESIGN_OPTIONS.memory),
  storage: z.enum(DESIGN_OPTIONS.storage),
  graphics: z.enum(DESIGN_OPTIONS.graphics),
  power: z.enum(DESIGN_OPTIONS.power),
}).readonly();

export type PcDesign = z.infer<typeof pcDesignSchema>;

export const publishedDesignSchema = z.strictObject({
  revision: z.int().positive(),
  spec: pcDesignSchema,
}).readonly();

export type PublishedDesign = z.infer<typeof publishedDesignSchema>;

export const DEFAULT_DESIGN: PcDesign = {
  name: '', memory: 'ram-16g', storage: 'ssd-1t', graphics: 'integrated', power: 'psu-450',
};

export function designParts(spec: PcDesign): Readonly<Partial<Record<ItemType, number>>> {
  return {
    'cpu-8c': 1, 'motherboard-atx': 1, 'case-standard': 1,
    [spec.memory]: 1, [spec.storage]: 1, [spec.power]: 1,
    ...(spec.graphics === 'gpu-8g' ? { 'gpu-8g': 1 } : {}),
  };
}

export function designPower(spec: PcDesign) {
  const demand = 180 + (spec.graphics === 'gpu-8g' ? 220 : 0)
    + (spec.memory === 'ram-32g' ? 4 : 0) + (spec.storage === 'ssd-2t' ? 5 : 0);
  return { required: Math.ceil(demand * 1.2), available: spec.power === 'psu-450' ? 450 : 650 };
}

export function sameDesign(first: PublishedDesign, second: PublishedDesign): boolean {
  const a = first.spec;
  const b = second.spec;
  return first.revision === second.revision && a.name === b.name && a.memory === b.memory &&
    a.storage === b.storage && a.graphics === b.graphics && a.power === b.power;
}
