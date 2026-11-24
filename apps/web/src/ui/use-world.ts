import { useEffect, useState } from 'react';
import type { Simulation, World } from '@silicon-empire/simulation';

/** React panels refresh at most this often while time passes. Commands publish at once. */
const TICK_REFRESH_MS = 200;

/**
 * Subscribes React to the simulation without re-rendering on every tick.
 * Command results are published immediately; tick results are grouped.
 */
export function useWorld(simulation: Simulation): World {
  const [world, setWorld] = useState(simulation.getSnapshot);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const publish = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      setWorld(simulation.getSnapshot());
    };
    const unsubscribe = simulation.subscribe(cause => {
      if (cause === 'command') publish();
      else timer ??= setTimeout(publish, TICK_REFRESH_MS);
    });
    publish();
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [simulation]);

  return world;
}
