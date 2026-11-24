import { z } from 'zod';

export const WORKSHOP = {
  columns: 64,
  rows: 64,
  tileSize: 32,
  initialCapitalCents: 2_500_000,
  demolitionRefundPercent: 50,
} as const;

export const MACHINE_TYPES = ['storage', 'assembler', 'tester', 'receiving'] as const;
export type MachineType = (typeof MACHINE_TYPES)[number];

const machineDefinition = z.strictObject({
  name: z.string().min(1),
  shortName: z.string().min(1),
  width: z.int().min(1).max(WORKSHOP.columns),
  height: z.int().min(1).max(WORKSHOP.rows),
  costCents: z.int().min(1).max(WORKSHOP.initialCapitalCents),
});

export const MACHINES = z.record(z.enum(MACHINE_TYPES), machineDefinition.readonly()).readonly().parse({
  storage: {
    name: 'Casier de stockage',
    shortName: 'Stockage',
    width: 1,
    height: 1,
    costCents: 60_000,
  },
  assembler: {
    name: 'Établi d’assemblage',
    shortName: 'Assemblage',
    width: 2,
    height: 2,
    costCents: 180_000,
  },
  tester: {
    name: 'Banc de test',
    shortName: 'Banc de test',
    width: 2,
    height: 1,
    costCents: 240_000,
  },
  receiving: {
    name: 'Quai de réception',
    shortName: 'Réception',
    width: 3,
    height: 2,
    costCents: 420_000,
  },
} satisfies Record<MachineType, z.input<typeof machineDefinition>>);
