import { STAFF } from '@silicon-empire/game-data';
import { breakRoomSeats, isStaffed, payroll, poolSizeOf, severance, staffRequired } from '@silicon-empire/simulation';
import { useI18n } from '../i18n';
import { Dialog, gameTime } from './shared';
import type { SkillLevel } from '@silicon-empire/game-data';
import type { Machine, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';
import type { Messages } from '../i18n';

export function machineLabel(t: Messages, machine: Machine): string {
  return `${t.machines[machine.type].name} · ${machine.id}`;
}

function SkillEffect({ skill }: { skill: SkillLevel }) {
  const { t } = useI18n();
  return <small className="staff-effect">{t.staff.effect(STAFF.batchPercent[skill], STAFF.rejectionEveryPercent[skill])}</small>;
}

export function StaffPanel({ world, controls, onClose }: { world: World; controls: WorkshopControls; onClose: () => void }) {
  const { t, money } = useI18n();
  const { staff } = world;
  const posts = world.machines.filter(machine => isStaffed(machine.type));
  const full = staff.employees.length >= STAFF.maxEmployees;

  return (
    <Dialog
      wide
      title={t.staff.title}
      onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.staff.close}</button>}
    >
      <p>{t.staff.intro}</p>
      <p className="tier-hint">{staffRequired(world.progress) ? t.staff.required : t.staff.optional}</p>
      <dl className="machine-stats staff-summary">
        <div><dt>{t.staff.payroll}</dt><dd>{t.staff.perMonth(money(payroll(staff)))}</dd></div>
        <div><dt>{t.staff.paidTotal}</dt><dd>{money(staff.paidCents)}</dd></div>
      </dl>
      <p className="placement-status">{t.staff.nextPayday(gameTime(staff.nextPayday - world.tick))}</p>
      <p className="placement-status">{t.rooms.rested(breakRoomSeats(world), staff.employees.length)}</p>
      {poolSizeOf(world) > STAFF.poolSize && <p className="placement-status">{t.rooms.extra(poolSizeOf(world) - STAFF.poolSize)}</p>}

      <section aria-label={t.staff.employees}>
        <h3>{t.staff.employees}</h3>
        {staff.employees.length === 0 ? <p className="placement-status">{t.staff.none}</p> : (
          <ul className="staff-list">
            {staff.employees.map(employee => (
              <li key={employee.id} className="staff-card" aria-label={employee.name}>
                <header>
                  <strong>{employee.name}</strong>
                  <span>{t.staff.level(employee.skill)}</span>
                </header>
                <SkillEffect skill={employee.skill} />
                <span>{t.staff.perMonth(money(employee.salaryCents))}</span>
                <label className="staff-morale">
                  <span>{t.staff.morale}</span>
                  <meter min={0} max={100} low={35} high={70} optimum={100} value={employee.morale} />
                  <span>{employee.morale}</span>
                </label>
                <label className="order-form">
                  <span>{t.staff.post}</span>
                  <select
                    value={employee.machineId ?? ''}
                    onChange={event => controls.assign(employee.id, event.target.value === '' ? null : Number(event.target.value))}
                  >
                    <option value="">{t.staff.unassigned}</option>
                    {posts.map(machine => <option key={machine.id} value={machine.id}>{machineLabel(t, machine)}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className="button"
                  disabled={world.capitalCents < severance(employee)}
                  onClick={() => controls.fire(employee.id)}
                >
                  {t.staff.fire(money(severance(employee)))}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t.staff.candidates}>
        <h3>{t.staff.candidates}</h3>
        <p className="placement-status">{t.staff.newPool(gameTime(staff.nextPool - world.tick))}</p>
        {staff.candidates.length === 0 ? <p className="placement-status">{t.staff.noCandidates}</p> : (
          <ul className="staff-list">
            {staff.candidates.map(candidate => (
              <li key={candidate.id} className="staff-card" aria-label={candidate.name}>
                <header>
                  <strong>{candidate.name}</strong>
                  <span>{t.staff.level(candidate.skill)}</span>
                </header>
                <SkillEffect skill={candidate.skill} />
                <button type="button" className="button button-primary" disabled={full} onClick={() => controls.hire(candidate.id)}>
                  {t.staff.hire(money(candidate.salaryCents))}
                </button>
              </li>
            ))}
          </ul>
        )}
        {full && <p className="order-hint text-error">{t.errors['staff-full']}</p>}
      </section>
    </Dialog>
  );
}
