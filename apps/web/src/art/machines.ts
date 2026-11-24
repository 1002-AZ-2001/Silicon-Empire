import assembler from './assembler.png';
import receiving from './receiving.png';
import storage from './storage.png';
import tester from './tester.png';
import type { MachineType } from '@silicon-empire/game-data';

export const MACHINE_ART: Record<MachineType, string> = { storage, assembler, tester, receiving };
