import carton from './items/carton.png';
import caseStandard from './items/case-standard.png';
import cpu from './items/cpu-8c.png';
import gpu from './items/gpu-8g.png';
import motherboard from './items/motherboard-atx.png';
import pcGaming from './items/pc-gaming.png';
import pcGamingPackaged from './items/pc-gaming-packaged.png';
import pcGamingTested from './items/pc-gaming-tested.png';
import pcOffice from './items/pc-office.png';
import pcOfficePackaged from './items/pc-office-packaged.png';
import pcOfficeTested from './items/pc-office-tested.png';
import psu from './items/psu-650.png';
import ram from './items/ram-16g.png';
import ssd from './items/ssd-1t.png';
import type { ItemType } from '@silicon-empire/game-data';

export const ITEM_ART: Record<ItemType, string> = {
  'cpu-8c': cpu,
  'gpu-8g': gpu,
  'ram-16g': ram,
  'ssd-1t': ssd,
  'motherboard-atx': motherboard,
  'psu-650': psu,
  'case-standard': caseStandard,
  carton,
  'pc-office': pcOffice,
  'pc-office-tested': pcOfficeTested,
  'pc-office-packaged': pcOfficePackaged,
  'pc-gaming': pcGaming,
  'pc-gaming-tested': pcGamingTested,
  'pc-gaming-packaged': pcGamingPackaged,
};
