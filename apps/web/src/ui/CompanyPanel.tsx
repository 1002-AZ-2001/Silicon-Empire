import { BRAND_COLORS, BRAND_EMBLEMS, BRAND_HEX, OFFICE_ROLES, ROLES, ROLE_EFFECTS } from '@silicon-empire/game-data';
import {
  developerPercent, equippedByRole, managerMorale, researchBoost, salesBonusPercent, workstations,
} from '@silicon-empire/simulation';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { Dialog, Icon } from './shared';
import type { BrandColor, BrandEmblem, Role } from '@silicon-empire/game-data';
import type { Company, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';
import type { Messages } from '../i18n';

/** Company emblem in its brand colour. */
export function Emblem({ company }: { company: Company }) {
  return (
    <span className="brand-mark" style={{ background: BRAND_HEX[company.color] }}>
      <Icon name={company.emblem} />
    </span>
  );
}

function roleEffect(t: Messages, world: World, role: Role): string {
  const equipped = equippedByRole(world)[role];
  switch (role) {
    case 'operator': return t.company.effects.operator(world.staff.employees.filter(employee => employee.role === role && employee.machineId !== null).length);
    case 'storekeeper': return t.company.effects.storekeeper(world.staff.employees.filter(employee => employee.role === role && employee.machineId !== null).length);
    case 'technician': return t.company.effects.technician(world.staff.employees
      .filter(employee => employee.role === role).reduce((total, employee) => total + employee.skill * ROLE_EFFECTS.repairPerSkill, 0));
    case 'researcher': return t.company.effects.researcher(1 + researchBoost(world));
    case 'developer': return t.company.effects.developer(100 - developerPercent(world));
    case 'designer': return t.company.effects.designer(Math.min(ROLE_EFFECTS.maxDesigners, equipped) * ROLE_EFFECTS.designerPercent);
    case 'manager': return t.company.effects.manager(managerMorale(world));
    case 'sales': return t.company.effects.sales(salesBonusPercent(world));
  }
}

export function CompanyPanel({ world, controls, onClose }: { world: World; controls: WorkshopControls; onClose: () => void }) {
  const { t } = useI18n();
  const [color, setColor] = useState<BrandColor>(world.company.color);
  const [emblem, setEmblem] = useState<BrandEmblem>(world.company.emblem);
  const officeStaff = world.staff.employees.filter(employee => OFFICE_ROLES.includes(employee.role)).length;
  const seats = workstations(world);
  return (
    <Dialog wide title={t.company.title} onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.tutorial.close}</button>}
    >
      <p>{t.company.intro}</p>
      <section className="tier" aria-label={t.company.brand}>
        <h3>{t.company.brand}</h3>
        <div className="brand-editor">
          <Emblem company={{ color, emblem }} />
          <label className="order-form">
            <span>{t.company.color}</span>
            <select value={color} onChange={event => setColor(event.target.value as BrandColor)}>
              {BRAND_COLORS.map(option => <option key={option} value={option}>{t.company.colors[option]}</option>)}
            </select>
          </label>
          <label className="order-form">
            <span>{t.company.emblem}</span>
            <select value={emblem} onChange={event => setEmblem(event.target.value as BrandEmblem)}>
              {BRAND_EMBLEMS.map(option => <option key={option} value={option}>{t.company.emblems[option]}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="button button-primary"
            disabled={color === world.company.color && emblem === world.company.emblem}
            onClick={() => controls.brand({ color, emblem })}
          >
            {t.company.save}
          </button>
        </div>
      </section>
      <section className="tier" aria-label={t.company.teams}>
        <h3>{t.company.teams}</h3>
        <p className={seats < officeStaff ? 'order-hint text-error' : 'placement-status'}>{t.company.workstations(seats, officeStaff)}</p>
        {seats < officeStaff && <p className="order-hint">{t.company.workstationsHint}</p>}
        <ul className="staff-list">
          {ROLES.map(role => {
            const count = world.staff.employees.filter(employee => employee.role === role).length;
            return (
              <li key={role} className="staff-card" aria-label={t.staff.roles[role]}>
                <header><strong>{t.staff.roles[role]}</strong><span>{t.company.count(count)}</span></header>
                <small className="staff-effect">{t.staff.roleHints[role]}</small>
                {count > 0 && <span>{roleEffect(t, world, role)}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </Dialog>
  );
}
