import { TIME } from '@silicon-empire/game-data';
import { useEffect, useId, useRef } from 'react';
import arrow from '../art/icons/arrow.png';
import back from '../art/icons/back.png';
import chip from '../art/icons/chip.png';
import folder from '../art/icons/folder.png';
import grid from '../art/icons/grid.png';
import minus from '../art/icons/minus.png';
import move from '../art/icons/move.png';
import plus from '../art/icons/plus.png';
import rotate from '../art/icons/rotate.png';
import save from '../art/icons/save.png';
import target from '../art/icons/target.png';
import trash from '../art/icons/trash.png';
import type { ReactNode } from 'react';

const icons = { arrow, back, chip, folder, grid, minus, move, plus, rotate, save, target, trash };

export function Icon({ name }: { name: keyof typeof icons }) {
  return <span className="icon" aria-hidden="true" style={{ maskImage: `url("${icons[name]}")` }} />;
}


/** Simulated time as h:mm:ss. */
export function gameTime(tick: number): string {
  const seconds = Math.floor(tick / TIME.ticksPerSecond);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

export function Dialog({ title, children, actions, onDismiss }: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onDismiss: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="dialog-copy">{children}</div>
      <div className="dialog-actions">{actions}</div>
    </dialog>
  );
}
