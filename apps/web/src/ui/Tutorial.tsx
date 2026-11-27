import { isComponentMachine } from '@silicon-empire/game-data';
import { portConnections, powerRatio } from '@silicon-empire/simulation';
import { useState } from 'react';
import { useI18n } from '../i18n';
import type { World } from '@silicon-empire/simulation';
import type { Messages } from '../i18n';

export type TutorialStep = keyof Messages['tutorial']['steps'];

/** Where the current step points: a header button or a construction tool. */
export type TutorialTarget = 'bank' | 'shop' | 'technologies' | 'receiving' | 'machine' | 'shipping' | 'grid-connection' | null;

const TARGETS: Record<TutorialStep, TutorialTarget> = {
  specialty: null, loan: 'bank', dock: 'receiving', machine: 'machine', power: 'grid-connection', feed: null, shipping: 'shipping', order: 'shop',
  sell: null, tech: 'technologies',
};

/** Steps of the career tutorial with whether the world already shows them done. */
export function tutorialSteps(world: World): { step: TutorialStep; done: boolean }[] {
  const career = world.progress.career;
  const producers = world.machines.filter(machine => isComponentMachine(machine.type));
  const ports = producers.flatMap(machine => portConnections(world, machine));
  return [
    { step: 'specialty', done: career?.specialty != null },
    { step: 'loan', done: (career?.borrowedCents ?? 0) > 0 },
    { step: 'dock', done: world.machines.some(machine => machine.type === 'receiving') },
    { step: 'machine', done: producers.length > 0 },
    { step: 'power', done: producers.length > 0 && producers.every(machine => powerRatio(world, machine) > 0) },
    { step: 'feed', done: ports.some(port => port.kind === 'input' && port.connected) },
    {
      step: 'shipping',
      done: world.machines.some(machine => machine.type === 'shipping') && ports.some(port => port.kind === 'output' && port.connected),
    },
    { step: 'order', done: Object.keys(world.ledger.purchased).length > 0 || world.deliveries.length > 0 },
    { step: 'sell', done: (career?.marketRevenueCents ?? 0) > 0 },
    { step: 'tech', done: (career?.technologies.length ?? 0) > 1 },
  ];
}

export function tutorialTarget(world: World, hidden: boolean): TutorialTarget {
  if (hidden || !world.progress.career) return null;
  const current = tutorialSteps(world).find(entry => !entry.done);
  return current ? TARGETS[current.step] : null;
}

const key = (id: string) => `silicon-empire.tutorial.${id}`;

/** Whether the player hid the tutorial of this workshop; kept on this device only. */
export function useTutorialHidden(id: string): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key(id)) === 'hidden';
    } catch {
      return false;
    }
  });
  return [hidden, (value: boolean) => {
    setHidden(value);
    try {
      if (value) localStorage.setItem(key(id), 'hidden');
      else localStorage.removeItem(key(id));
    } catch {
      // The choice still applies for this session.
    }
  }];
}

export function TutorialCard({ world, onHide }: { world: World; onHide: () => void }) {
  const { t } = useI18n();
  const steps = tutorialSteps(world);
  const index = steps.findIndex(entry => !entry.done);
  const current = steps[index];
  return (
    <aside className="tutorial-card" aria-label={t.tutorial.title}>
      <header>
        <strong>{t.tutorial.title}</strong>
        {current && <span>{t.tutorial.step(index + 1, steps.length)}</span>}
      </header>
      <p role="status">{current ? t.tutorial.steps[current.step] : t.tutorial.done}</p>
      <progress max={steps.length} value={steps.filter(entry => entry.done).length} aria-hidden="true" />
      <button type="button" className="button" onClick={onHide}>{current ? t.tutorial.skip : t.tutorial.close}</button>
    </aside>
  );
}
