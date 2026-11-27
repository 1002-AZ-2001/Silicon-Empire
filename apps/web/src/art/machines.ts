import airFilter from './air-filter.png';
import assembler from './assembler.png';
import coffee from './coffee.png';
import conveyorFast from './conveyor-fast.png';
import conveyor from './conveyor.png';
import conveyorExpress from './conveyor-express.png';
import desk from './desk.png';
import door from './door.png';
import headquarters from './headquarters.png';
import lab from './lab.png';
import merger from './merger.png';
import packager from './packager.png';
import receiving from './receiving.png';
import shipping from './shipping.png';
import sofa from './sofa.png';
import splitter from './splitter.png';
import storage from './storage.png';
import tester from './tester.png';
import wall from './wall.png';
import warehouse from './warehouse.png';
import type { MachineType } from '@silicon-empire/game-data';

export const MACHINE_ART: Record<MachineType, string> = {
  storage, assembler, tester, receiving, conveyor, splitter, merger, packager, warehouse,
  'conveyor-fast': conveyorFast, headquarters, lab, 'conveyor-express': conveyorExpress, shipping,
  wall, door, sofa, coffee, desk, 'air-filter': airFilter,
};
export { default as CONVEYOR_TURN_ART } from './conveyor-turn.png';
export { default as CONVEYOR_FAST_TURN_ART } from './conveyor-fast-turn.png';
export { default as CONVEYOR_EXPRESS_TURN_ART } from './conveyor-express-turn.png';
