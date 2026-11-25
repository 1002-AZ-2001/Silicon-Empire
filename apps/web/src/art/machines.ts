import assembler from './assembler.png';
import conveyor from './conveyor.png';
import merger from './merger.png';
import receiving from './receiving.png';
import splitter from './splitter.png';
import storage from './storage.png';
import tester from './tester.png';
import type { MachineType } from '@silicon-empire/game-data';

export const MACHINE_ART: Record<MachineType, string> = { storage, assembler, tester, receiving, conveyor, splitter, merger };
export { default as CONVEYOR_TURN_ART } from './conveyor-turn.png';
