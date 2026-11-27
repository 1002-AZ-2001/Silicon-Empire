import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  const hover = useStore(controls.store, state => state.hover);
  const zoom = useStore(controls.store, state => state.zoom);
  const { columns, rows, parcels } = simulation.getSnapshot();
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

  useEffect(() => {
    if (ready) mount.current?.querySelector('canvas')?.setAttribute('aria-label', t.viewport.grid);
  }, [ready, t]);

  return (
    <section className="map-panel" aria-label={t.viewport.map}>
      <div className="map-surface">
        <div className="canvas-container" ref={mount} />
        {!ready && <div className="map-loading" role="status">{t.viewport.loading}</div>}
        <header className="map-overlay">
          <h1>{name}</h1>
          <div className="zoom-panel" role="group" aria-label={t.viewport.camera}>
            <button
              className="icon-button"
              type="button"
              title={t.viewport.zoomOut}
              aria-label={t.viewport.zoomOut}
              disabled={!ready || zoom <= MIN_ZOOM}
              onClick={() => scene.current?.zoomBy(1 / ZOOM_STEP)}
            ><Icon name="minus" /></button>
            <output className="zoom-value" aria-label={t.viewport.zoom}>{Math.round(zoom * 100)}&#8201;%</output>
            <button
              className="icon-button"
              type="button"
              aria-label={t.viewport.zoomIn}
              title={t.viewport.zoomIn}
              disabled={!ready || zoom >= MAX_ZOOM}
              onClick={() => scene.current?.zoomBy(ZOOM_STEP)}
            ><Icon name="plus" /></button>
            <button
              className="icon-button recenter"
              type="button"
              title={t.viewport.recenter}
              aria-label={t.viewport.recenter}
              disabled={!ready}
              onClick={() => scene.current?.resetView()}
            ><Icon name="target" /></button>
          </div>
        </header>
      </div>

      <div className="map-status">
        <span><Icon name="grid" /> {t.land.owned(parcels.length)}</span>
        <span aria-label={t.viewport.hovered}>{onGrid ? `X ${hover.x + 1} / Y ${hover.y + 1}` : 'X — / Y —'}</span>
      </div>
    </section>
  );
}
