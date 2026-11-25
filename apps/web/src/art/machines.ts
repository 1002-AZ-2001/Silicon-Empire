import assembler from './assembler.png';
import conveyorFast from './conveyor-fast.png';
import conveyor from './conveyor.png';
import headquarters from './headquarters.png';
import merger from './merger.png';
import packager from './packager.png';
import receiving from './receiving.png';
import splitter from './splitter.png';
import storage from './storage.png';
import tester from './tester.png';
import warehouse from './warehouse.png';
import type { MachineType } from '@silicon-empire/game-data';

export const MACHINE_ART: Record<MachineType, string> = {
  storage, assembler, tester, receiving, conveyor, splitter, merger, packager, warehouse,
  'conveyor-fast': conveyorFast, headquarters,
};
export { default as CONVEYOR_TURN_ART } from './conveyor-turn.png';
export { default as CONVEYOR_FAST_TURN_ART } from './conveyor-fast-turn.png';
