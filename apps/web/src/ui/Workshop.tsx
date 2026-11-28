import { contentsOf, demolitionRefund, erasBehind, inventoryTotal, machineUnlocked, modelUnlocked, sameContents, Simulation } from '@silicon-empire/simulation';
import { CAREER, ERAS, MILESTONES, TIME } from '@silicon-empire/game-data';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { createWorkshopControls } from '../game/controls';
import { writeSave } from '../persistence/indexed-saves';
import { SAVE_VERSION } from '../persistence/save-data';
import { BankPanel, BankruptPanel, CareerDate, EraPanel, StarterPanel, TechPanel } from './CareerPanels';
import { CompanyPanel, Emblem } from './CompanyPanel';
import { ConstructionBar, getShortcut } from './ConstructionBar';
import { DesignerPanel } from './DesignerPanel';
import { GuidePanel } from './GuidePanel';
import { Inspector } from './Inspector';
import { useI18n } from '../i18n';
import { ProgressionPanel } from './ProgressionPanel';
import { ResearchPanel } from './ResearchPanel';
import { ShopPanel } from './ShopPanel';
import { StaffPanel } from './StaffPanel';
import { TutorialCard, tutorialTarget, useTutorialHidden } from './Tutorial';
import type { TutorialTarget } from './Tutorial';
import { SalesPanel } from './SalesPanel';
import { Dialog, Icon, gameTime } from './shared';
import { useWorld } from './use-world';
import type { World } from '@silicon-empire/simulation';

const WorkshopViewport = lazy(() => import('../game/WorkshopViewport'));

export interface WorkshopSession {
  id: string;
  name: string;
  createdAt: number;
  savedAt: number | null;
  world: World;
}

export function Workshop({ session, onMenu }: { session: WorkshopSession; onMenu: () => void }) {
  const [simulation] = useState(() => new Simulation(session.world));
  // A resumed workshop starts paused so the player can look around first.
  const [controls] = useState(() => createWorkshopControls(simulation, session.savedAt === null ? 1 : 0));
  const world = useWorld(simulation);
  const demolitionId = useStore(controls.store, state => state.demolitionId);
  const speed = useStore(controls.store, state => state.speed);
  const progressionOpen = useStore(controls.store, state => state.progressionOpen);
  const salesOpen = useStore(controls.store, state => state.salesOpen);
  const shopOpen = useStore(controls.store, state => state.shopOpen);
  const staffOpen = useStore(controls.store, state => state.staffOpen);
  const companyOpen = useStore(controls.store, state => state.companyOpen);
  const bankOpen = useStore(controls.store, state => state.bankOpen);
  const techOpen = useStore(controls.store, state => state.techOpen);
  const eraOpen = useStore(controls.store, state => state.eraOpen);
  const [tutorialHidden, setTutorialHidden] = useTutorialHidden(session.id);
  const career = world.progress.career;
  const target = tutorialTarget(world, tutorialHidden);
  const highlight = (name: TutorialTarget) => target === name ? ' tutorial-target' : '';
  const previousCareer = useRef(career);
  const previousUtilities = useRef(world.utilities);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const completedCount = useRef(world.progress.completed.length);
  const researchCount = useRef(world.research.completed.length);
  const previousStaff = useRef(world.staff);
  const researchOpen = useStore(controls.store, state => state.researchOpen);
  const [savedWorld, setSavedWorld] = useState<World | null>(session.savedAt === null ? null : session.world);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const { t, money } = useI18n();
  const [leaveDialog, setLeaveDialog] = useState(false);
  const saveInProgress = useRef(false);
  const lastSavedAt = useRef(session.savedAt ?? session.createdAt);
  const dirty = !savedWorld || !sameContents(savedWorld, world);
  const toDemolish = world.machines.find(machine => machine.id === demolitionId);
  const unitsLost = toDemolish ? inventoryTotal(contentsOf(world, toDemolish.id)) : 0;

  // Announce each milestone completed while playing.
  useEffect(() => {
    const { completed } = world.progress;
    if (completed.length > completedCount.current) {
      const done = completed[completed.length - 1];
      if (done) {
        controls.store.setState({
          feedback: {
            kind: 'success',
            message: ({ t: text, money: format }) => text.feedback.milestoneDone(text.progression.milestones[done], format(MILESTONES[done].rewardCents)),
          },
        });
      }
    }
    completedCount.current = completed.length;
  }, [world.progress, controls]);

  // Announce each research project completed while playing.
  useEffect(() => {
    const { completed } = world.research;
    const done = completed[completed.length - 1];
    if (completed.length > researchCount.current && done) {
      controls.store.setState({
        feedback: { kind: 'success', message: ({ t: text }) => text.feedback.researchDone(text.research.projects[done]) },
      });
    }
    researchCount.current = completed.length;
  }, [world.research, controls]);

  // Announce electricity bills, paid or not.
  useEffect(() => {
    const before = previousUtilities.current;
    const { utilities } = world;
    previousUtilities.current = utilities;
    if (!utilities.enabled || utilities.nextBill === before.nextBill) return;
    const paid = utilities.spentCents - before.spentCents;
    if (utilities.cut) {
      controls.store.setState({ feedback: { kind: 'error', message: ({ t: text }) => text.feedback.powerCut } });
    } else if (paid > 0) {
      controls.store.setState({ feedback: { kind: 'success', message: ({ t: text, money: format }) => text.feedback.billPaid(format(paid)) } });
    }
  }, [world.utilities, controls]);

  // Announce the eras going on sale.
  const previousRelease = useRef(career?.released);
  useEffect(() => {
    const before = previousRelease.current;
    previousRelease.current = career?.released;
    if (!career || !before || career.released === before) return;
    const era = career.released;
    controls.store.setState({ feedback: { kind: 'success', message: ({ t: text }) => text.feedback.eraReleased(text.eras.names[era], ERAS[era].year) } });
  }, [career, controls]);

  // Announce loan instalments in a career.
  useEffect(() => {
    const before = previousCareer.current;
    previousCareer.current = career;
    if (!career || !before || career.nextInstalment === before.nextInstalment) return;
    const paid = career.repaidCents - before.repaidCents;
    if (paid > 0) {
      controls.store.setState({ feedback: { kind: 'success', message: ({ t: text, money: format }) => text.feedback.instalmentPaid(format(paid)) } });
    } else if (career.missed > before.missed) {
      controls.store.setState({
        feedback: { kind: 'error', message: ({ t: text }) => text.feedback.instalmentMissed(career.missed, CAREER.maxMissed) },
      });
    }
  }, [career, controls]);

  // Announce paydays and the base operators the Direction assigns when staffing becomes required.
  useEffect(() => {
    const before = previousStaff.current;
    const { staff } = world;
    previousStaff.current = staff;
    if (staff === before) return;
    const arrived = staff.nextEmployeeId - before.nextEmployeeId;
    if (arrived > 0 && staff.candidates.length === before.candidates.length && staff.pool === before.pool) {
      const done = world.progress.completed.at(-1);
      controls.store.setState({
        feedback: {
          kind: 'success',
          message: ({ t: text, money: format }) => [
            done ? text.feedback.milestoneDone(text.progression.milestones[done], format(MILESTONES[done].rewardCents)) : '',
            text.feedback.operatorsArrived(arrived),
          ].join(' ').trim(),
        },
      });
    } else if (staff.nextPayday !== before.nextPayday && before.employees.length > 0) {
      const paid = staff.paidCents - before.paidCents;
      controls.store.setState({
        feedback: paid > 0
          ? { kind: 'success', message: ({ t: text, money: format }) => text.feedback.wagesPaid(format(paid)) }
          : { kind: 'error', message: ({ t: text }) => text.feedback.wagesUnpaid },
      });
    }
  }, [world.staff, world.progress, controls]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      simulation.advance(controls.clock.advance(now - last));
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [simulation, controls]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      const tool = getShortcut(simulation.getSnapshot(), event.code.startsWith('Digit') ? event.code.slice(5) : key);
      if (key === 'escape') {
        event.preventDefault();
        controls.selectTool('inspect');
      } else if (key === 'r') {
        event.preventDefault();
        controls.rotate();
      } else if (key === 'p') {
        event.preventDefault();
        controls.togglePause();
      } else if (tool) {
        event.preventDefault();
        controls.selectTool(tool);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [controls]);

  async function save(leaveAfter: boolean) {
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setSaveFailed(false);
    const snapshot = simulation.getSnapshot();
    const savedAt = Math.max(Date.now(), lastSavedAt.current);
    try {
      await writeSave({
        version: SAVE_VERSION,
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        savedAt,
        world: snapshot,
      });
      lastSavedAt.current = savedAt;
      setSavedWorld(snapshot);
      if (leaveAfter) onMenu();
    } catch {
      setSaveFailed(true);
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function openMenu() {
    if (saveInProgress.current) return;
    if (savedWorld && sameContents(simulation.getSnapshot(), savedWorld)) {
      onMenu();
    } else {
      setLeaveDialog(true);
    }
  }

  return (
    <div className="workshop-shell">
      <header className="workshop-header">
        <div className="workshop-brand"><Emblem company={world.company} /><span>Silicon<br />Empire</span></div>
        <div className="workshop-metrics">
          <div className="metric">
            <span className="metric-label">{t.workshop.capital}</span>
            <strong className="capital" aria-label={t.workshop.capital}>{money(world.capitalCents)}</strong>
          </div>
          <div className="metric equipment-count">
            <span className="metric-label">{t.workshop.equipment}</span>
            <strong aria-label={t.workshop.equipmentInstalled}>{world.machines.length}</strong>
          </div>
          <div className="metric">
            <span className="metric-label">{t.workshop.time}</span>
            <strong className="game-time" aria-label={t.workshop.time}>{gameTime(world.tick)}</strong>
          </div>
          {career && (
            <div className="metric">
              <span className="metric-label">{t.eras.date}</span>
              <strong className="career-date" aria-label={t.eras.date}><CareerDate career={career} tick={world.tick} /></strong>
            </div>
          )}
        </div>
        <div className="speed-control" role="group" aria-label={t.workshop.speed}>
          {TIME.speeds.map(option => (
            <button
              type="button"
              key={option}
              className="speed-button"
              aria-pressed={speed === option}
              aria-keyshortcuts={option === 0 ? 'P' : undefined}
              onClick={() => controls.setSpeed(option)}
            >{option === 0 ? t.workshop.pause : `×${option}`}</button>
          ))}
        </div>
        <nav className="workshop-panels" aria-label={t.workshop.panels}>
        {career && (
          <>
            <button type="button" className={`button${highlight('bank')}`} onClick={() => controls.store.setState({ bankOpen: true })}>
              {t.workshop.bank}
            </button>
            <button type="button" className={`button${highlight('technologies')}`} onClick={() => controls.store.setState({ techOpen: true })}>
              {t.workshop.technologies}
            </button>
            <button type="button" className="button" onClick={() => controls.store.setState({ eraOpen: true })}>
              {t.eras.title}
              {erasBehind(career) > 0 && career.technologies.includes('computers') && <small className="button-detail"> · {t.eras.newEra}</small>}
            </button>
          </>
        )}
        {!world.progress.sandbox && !career && (
          <button type="button" className="button progression-button" onClick={() => controls.store.setState({ progressionOpen: true })}>
            <Icon name="chip" /> {t.workshop.progression}
            <small>{world.progress.active ? t.progression.milestones[world.progress.active] : t.progression.none}</small>
          </button>
        )}
        {(world.progress.sandbox || machineUnlocked(world, 'lab')) && (
          <button type="button" className="button" onClick={() => controls.store.setState({ researchOpen: true })}>
            {t.workshop.research}
            {world.research.analysing && <small className="button-detail"> · {t.research.analysing}</small>}
          </button>
        )}
        <button type="button" className={`button${highlight('shop')}`} onClick={() => controls.store.setState({ shopOpen: true })}>{t.workshop.shop}</button>
        <button type="button" className="button" onClick={() => controls.store.setState({ companyOpen: true })}>{t.workshop.company}</button>
        <button type="button" className="button" onClick={() => controls.store.setState({ staffOpen: true })}>{t.workshop.staff}</button>
        <button type="button" className="button" onClick={() => controls.store.setState({ salesOpen: true })}>{t.trade.title}</button>
        {modelUnlocked(world.progress, 'custom') && (
          <button type="button" className="button" onClick={() => setDesignerOpen(true)}>{t.design.title}</button>
        )}
        {career && tutorialHidden && (
          <button type="button" className="button" onClick={() => setTutorialHidden(false)}>{t.tutorial.restart}</button>
        )}
        </nav>
        <div className="workshop-actions">
          <span className={`save-status${saveFailed ? ' text-error' : ''}`} role="status">
            {saveFailed ? t.workshop.saveFailed : saving ? t.workshop.saving : dirty ? t.workshop.unsaved : t.workshop.saved}
          </span>
          <button type="button" className="button save-button" disabled={saving} onClick={() => void save(false)}>
            <Icon name="save" /> {t.workshop.save}
          </button>
          <button type="button" className="button menu-button" disabled={saving} onClick={openMenu}>
            <Icon name="back" /> {t.workshop.menu}
          </button>
        </div>
      </header>

      <main className="workspace-grid">
        <Suspense fallback={<div className="map-panel map-loading" role="status">{t.workshop.loading}</div>}>
          <WorkshopViewport simulation={simulation} controls={controls} name={session.name} />
        </Suspense>
        <Inspector controls={controls} world={world} />
        {career && !tutorialHidden && !career.bankrupt && <TutorialCard world={world} onHide={() => setTutorialHidden(true)} />}
      </main>

      <ConstructionBar controls={controls} world={world} onGuide={() => setGuideOpen(true)} highlight={target} />

      {guideOpen && <GuidePanel world={world} onClose={() => setGuideOpen(false)} />}
      {progressionOpen && (
        <ProgressionPanel world={world} controls={controls} onClose={() => controls.store.setState({ progressionOpen: false })} />
      )}
      {salesOpen && <SalesPanel world={world} controls={controls} />}
      {career && !career.specialty && !career.bankrupt && <StarterPanel controls={controls} onMenu={openMenu} />}
      {career && bankOpen && (
        <BankPanel world={world} career={career} controls={controls} onClose={() => controls.store.setState({ bankOpen: false })} />
      )}
      {career && eraOpen && (
        <EraPanel world={world} career={career} controls={controls} onClose={() => controls.store.setState({ eraOpen: false })} />
      )}
      {career && techOpen && (
        <TechPanel world={world} career={career} controls={controls} onClose={() => controls.store.setState({ techOpen: false })} />
      )}
      {career?.bankrupt && <BankruptPanel name={session.name} career={career} onMenu={onMenu} />}
      {companyOpen && <CompanyPanel world={world} controls={controls} onClose={() => controls.store.setState({ companyOpen: false })} />}
      {staffOpen && <StaffPanel world={world} controls={controls} onClose={() => controls.store.setState({ staffOpen: false })} />}
      {shopOpen && <ShopPanel world={world} controls={controls} onClose={() => controls.store.setState({ shopOpen: false })} />}
      {researchOpen && (
        <ResearchPanel world={world} controls={controls} onClose={() => controls.store.setState({ researchOpen: false })} />
      )}
      {designerOpen && <DesignerPanel world={world} controls={controls} onClose={() => setDesignerOpen(false)} />}

      {toDemolish && (
        <Dialog
          title={t.workshop.demolishTitle}
          onDismiss={() => controls.store.setState({ demolitionId: null })}
          actions={<>
            <button type="button" className="button" onClick={() => controls.store.setState({ demolitionId: null })}>{t.common.cancel}</button>
            <button type="button" className="button button-danger" onClick={controls.confirmDemolition}>{t.workshop.confirmDemolition}</button>
          </>}
        >
          <p>{t.workshop.demolishBody(t.machines[toDemolish.type].name, money(demolitionRefund(toDemolish)))}</p>
          {unitsLost > 0 && <p className="text-error">{t.workshop.unitsLost(unitsLost)}</p>}
        </Dialog>
      )}

      {leaveDialog && (
        <Dialog
          title={t.workshop.leaveTitle}
          onDismiss={() => { if (!saving) setLeaveDialog(false); }}
          actions={<>
            <button type="button" className="button" disabled={saving} onClick={() => setLeaveDialog(false)}>{t.common.cancel}</button>
            <button type="button" className="button" disabled={saving} onClick={onMenu}>{t.workshop.leaveWithoutSaving}</button>
            <button type="button" className="button button-primary" disabled={saving} onClick={() => void save(true)}>{t.workshop.saveAndLeave}</button>
          </>}
        >
          <p>{t.workshop.leaveBody}</p>
          {saveFailed && <p role="alert" className="text-error">{t.workshop.saveFailed}</p>}
        </Dialog>
      )}
    </div>
  );
}
