import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Icon } from '../ui/shared';
import { MAX_ZOOM, MIN_ZOOM, WorkshopScene, ZOOM_STEP } from './workshop-scene';
import type { Simulation } from '@silicon-empire/simulation';
import type { WorkshopControls } from './controls';

export default function WorkshopViewport({ simulation, controls, name }: {
  simulation: Simulation;
  controls: WorkshopControls;
  name: string;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<WorkshopScene | null>(null);
  const [ready, setReady] = useState(false);
  const hover = useStore(controls.store, state => state.hover);
  const zoom = useStore(controls.store, state => state.zoom);
  const { columns, rows } = simulation.getSnapshot();
  const onGrid = hover && hover.x >= 0 && hover.y >= 0 && hover.x < columns && hover.y < rows;

  useEffect(() => {
    const parent = mount.current;
    if (!parent) return;
    let active = true;

    const workshop = new WorkshopScene(simulation, controls, () => {
      if (active) setReady(true);
    });
    scene.current = workshop;
    const game = new Phaser.Game({
      parent,
      type: Phaser.CANVAS,
      width: parent.clientWidth,
      height: parent.clientHeight,
      backgroundColor: '#111917',
      pixelArt: true,
      roundPixels: false,
      banner: false,
      scale: { mode: Phaser.Scale.RESIZE },
      input: { keyboard: false, mouse: false, touch: false },
      scene: workshop,
    });
    return () => {
      active = false;
      scene.current = null;
      game.destroy(true);
    };
  }, [simulation, controls]);

  return (
    <section className="map-panel" aria-label="Carte de l’atelier">
      <div className="map-surface">
        <div className="canvas-container" ref={mount} />
        {!ready && <div className="map-loading" role="status">Chargement de la grille…</div>}
        <header className="map-overlay">
          <h1>{name}</h1>
          <div className="zoom-panel" role="group" aria-label="Caméra">
            <button
              className="icon-button"
              type="button"
              title="Zoom arrière"
              aria-label="Zoom arrière"
              disabled={!ready || zoom <= MIN_ZOOM}
              onClick={() => scene.current?.zoomBy(1 / ZOOM_STEP)}
            ><Icon name="minus" /></button>
            <output className="zoom-value" aria-label="Zoom">{Math.round(zoom * 100)}&#8201;%</output>
            <button
              className="icon-button"
              type="button"
              aria-label="Zoom avant"
              title="Zoom avant"
              disabled={!ready || zoom >= MAX_ZOOM}
              onClick={() => scene.current?.zoomBy(ZOOM_STEP)}
            ><Icon name="plus" /></button>
            <button
              className="icon-button recenter"
              type="button"
              title="Recentrer la carte"
              aria-label="Recentrer la carte"
              disabled={!ready}
              onClick={() => scene.current?.resetView()}
            ><Icon name="target" /></button>
          </div>
        </header>
      </div>

      <div className="map-status">
        <span><Icon name="grid" /> {columns} × {rows} tuiles</span>
        <span aria-label="Case survolée">{onGrid ? `X ${hover.x + 1} / Y ${hover.y + 1}` : 'X — / Y —'}</span>
      </div>
    </section>
  );
}
