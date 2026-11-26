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
};
