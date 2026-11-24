import { TIME } from '@silicon-empire/game-data';
import { step } from './logistics';
import { applyCommand } from './world';
import type { Command, CommandResult, World } from './world';

export type Speed = (typeof TIME.speeds)[number];
export type ChangeCause = 'command' | 'tick';

/**
 * Fixed-step clock, independent of the frame rate.
 * It converts elapsed real time into a whole number of ticks at the chosen speed.
 */
export class FixedStepClock {
  private accumulatorMs = 0;
  private currentSpeed: Speed = 1;
  private readonly tickMs = 1000 / TIME.ticksPerSecond;

  get speed(): Speed {
    return this.currentSpeed;
  }

  set speed(speed: Speed) {
    this.currentSpeed = speed;
  }

  /** Fraction of the next tick already elapsed, used to interpolate rendering. */
  get progress(): number {
    return Math.min(this.accumulatorMs / this.tickMs, 1);
  }

  advance(elapsedMs: number): number {
    if (this.currentSpeed === 0 || !(elapsedMs > 0)) return 0;
    this.accumulatorMs += elapsedMs * this.currentSpeed;
    const ticks = Math.floor(this.accumulatorMs / this.tickMs);
    if (ticks > TIME.maxTicksPerFrame) {
      this.accumulatorMs %= this.tickMs;
      return TIME.maxTicksPerFrame;
    }
    this.accumulatorMs -= ticks * this.tickMs;
    return ticks;
  }
}

export class Simulation {
  private readonly listeners = new Set<(cause: ChangeCause) => void>();
  private previous: World;

  constructor(private world: World) {
    this.previous = world;
  }

  getSnapshot = (): World => this.world;

  /** State one tick before the current snapshot, or the current snapshot after a command. */
  getPrevious = (): World => this.previous;

  subscribe = (listener: (cause: ChangeCause) => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  dispatch(command: Command): CommandResult {
    const result = applyCommand(this.world, command);
    if (result.ok) {
      this.world = result.world;
      this.previous = result.world;
      this.listeners.forEach(listener => listener('command'));
    }
    return result;
  }

  advance(ticks: number) {
    if (ticks <= 0) return;
    for (let tick = 0; tick < ticks; tick++) {
      this.previous = this.world;
      this.world = step(this.world);
    }
    this.listeners.forEach(listener => listener('tick'));
  }
}
