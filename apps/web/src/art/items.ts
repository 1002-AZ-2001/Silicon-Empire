import fiberglassSheet from './items/fiberglass-sheet.png';
import barePcb from './items/bare-pcb.png';
import capacitorReel from './items/capacitor-reel.png';
import ceramicPowder from './items/ceramic-powder.png';
import circuitBoard from './items/circuit-board.png';
import copperFoil from './items/copper-foil.png';
import ferriteCore from './items/ferrite-core.png';
import transformer from './items/transformer.png';
import carton from './items/carton.png';
import caseStandard from './items/case-standard.png';
import cpu from './items/cpu-8c.png';
import gpu from './items/gpu-8g.png';
import motherboard from './items/motherboard-atx.png';
import pcGaming from './items/pc-gaming.png';
import pcCustom from './items/pc-custom.png';
import pcCustomTested from './items/pc-custom-tested.png';
import pcCustomPackaged from './items/pc-custom-packaged.png';
import pcGamingPackaged from './items/pc-gaming-packaged.png';
import pcGamingTested from './items/pc-gaming-tested.png';
import pcOffice from './items/pc-office.png';
import pcOfficePackaged from './items/pc-office-packaged.png';
import pcOfficeTested from './items/pc-office-tested.png';
import pcProfessional from './items/pc-professional.png';
import pcProfessionalPackaged from './items/pc-professional-packaged.png';
import pcProfessionalRejected from './items/pc-professional-rejected.png';
import pcProfessionalTested from './items/pc-professional-tested.png';
import psu from './items/psu-650.png';
import psu450 from './items/psu-450.png';
import ram from './items/ram-16g.png';
import ram32 from './items/ram-32g.png';
import ssd from './items/ssd-1t.png';
import ssd2 from './items/ssd-2t.png';
import eraCpu8bit from './items/cpu-8bit.png';
import eraCpu16bit from './items/cpu-16bit.png';
import eraCpu32bit from './items/cpu-32bit.png';
import eraCpu233m from './items/cpu-233m.png';
import eraCpu64bit from './items/cpu-64bit.png';
import eraRam4k from './items/ram-4k.png';
import eraRam640k from './items/ram-640k.png';
import eraRam1m from './items/ram-1m.png';
import eraRam32m from './items/ram-32m.png';
import eraRam1g from './items/ram-1g.png';
import eraFloppy8in from './items/floppy-8in.png';
import eraHdd10m from './items/hdd-10m.png';
import eraHdd40m from './items/hdd-40m.png';
import eraHdd4g from './items/hdd-4g.png';
import eraHdd250g from './items/hdd-250g.png';
import eraBoardS100 from './items/board-s100.png';
import eraBoardIsa8 from './items/board-isa8.png';
import eraBoardIsa16 from './items/board-isa16.png';
import eraBoardAgp from './items/board-agp.png';
import eraBoardPcie from './items/board-pcie.png';
import eraPsuLinear from './items/psu-linear.png';
import eraPsuAt from './items/psu-at.png';
import eraCaseDesk from './items/case-desk.png';
import eraCaseTower from './items/case-tower.png';
import eraGpu3d from './items/gpu-3d.png';
import eraGpu256m from './items/gpu-256m.png';
import siliconWafer from './items/silicon-wafer.png';
import chipSubstrate from './items/chip-substrate.png';
import chipRam from './items/chip-ram.png';
import chipCpu from './items/chip-cpu.png';
import chipGpu from './items/chip-gpu.png';
import type { ItemType } from '@silicon-empire/game-data';

export const ITEM_ART: Record<ItemType, string> = {
  'cpu-8c': cpu,
  'gpu-8g': gpu,
  'ram-16g': ram,
  'ram-32g': ram32,
  'ssd-1t': ssd,
  'ssd-2t': ssd2,
  'motherboard-atx': motherboard,
  'psu-650': psu,
  'psu-450': psu450,
  'case-standard': caseStandard,
  carton,
  'pc-office': pcOffice,
  'pc-office-tested': pcOfficeTested,
  'pc-office-packaged': pcOfficePackaged,
  'pc-gaming': pcGaming,
  'pc-gaming-tested': pcGamingTested,
  'pc-gaming-packaged': pcGamingPackaged,
  'pc-custom': pcCustom,
  'pc-custom-tested': pcCustomTested,
  'pc-custom-packaged': pcCustomPackaged,
  'pc-professional': pcProfessional,
  'pc-professional-tested': pcProfessionalTested,
  'pc-professional-packaged': pcProfessionalPackaged,
  'pc-professional-rejected': pcProfessionalRejected,
  'ceramic-powder': ceramicPowder,
  'copper-foil': copperFoil,
  'fiberglass-sheet': fiberglassSheet,
  'ferrite-core': ferriteCore,
  'capacitor-reel': capacitorReel,
  'bare-pcb': barePcb,
  transformer,
  'circuit-board': circuitBoard,
  'cpu-8bit': eraCpu8bit,
  'cpu-16bit': eraCpu16bit,
  'cpu-32bit': eraCpu32bit,
  'cpu-233m': eraCpu233m,
  'cpu-64bit': eraCpu64bit,
  'ram-4k': eraRam4k,
  'ram-640k': eraRam640k,
  'ram-1m': eraRam1m,
  'ram-32m': eraRam32m,
  'ram-1g': eraRam1g,
  'floppy-8in': eraFloppy8in,
  'hdd-10m': eraHdd10m,
  'hdd-40m': eraHdd40m,
  'hdd-4g': eraHdd4g,
  'hdd-250g': eraHdd250g,
  'board-s100': eraBoardS100,
  'board-isa8': eraBoardIsa8,
  'board-isa16': eraBoardIsa16,
  'board-agp': eraBoardAgp,
  'board-pcie': eraBoardPcie,
  'psu-linear': eraPsuLinear,
  'psu-at': eraPsuAt,
  'case-desk': eraCaseDesk,
  'case-tower': eraCaseTower,
  'gpu-3d': eraGpu3d,
  'gpu-256m': eraGpu256m,
  'silicon-wafer': siliconWafer,
  'chip-substrate': chipSubstrate,
  'chip-ram': chipRam,
  'chip-cpu': chipCpu,
  'chip-gpu': chipGpu,
};
