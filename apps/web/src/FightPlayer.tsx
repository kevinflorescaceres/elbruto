/**
 * Reproductor del combate con PixiJS y GSAP (PLAN.md fase 4).
 *
 * El guion lo construye `fightScene.ts`, que es puro y esta probado. Aqui solo
 * se monta el lienzo, se ata la linea de tiempo y se exponen los controles.
 */
import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import type { FightReplay } from '@rufianes/shared';
import { planFight } from './fightScene.js';
import { SIZE } from './pixiScene.js';
import { buildTimeline } from './timeline.js';

export function FightPlayer({ replay }: { replay: FightReplay }) {
  const host = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [reproduciendo, setReproduciendo] = useState(true);
  const [velocidad, setVelocidad] = useState(1);
  const [pie, setPie] = useState<string | null>(null);

  useEffect(() => {
    const contenedor = host.current;
    if (contenedor === null) return;

    // StrictMode monta dos veces en desarrollo: si el init asincrono termina
    // despues de desmontar, hay que tirar la aplicacion en vez de pintarla.
    let cancelado = false;
    let app: Application | null = null;

    void (async () => {
      try {
        const aplicacion = new Application();
        await aplicacion.init({
          width: SIZE.width,
          height: SIZE.height,
          background: 0xf6f6f4,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio,
        });

        if (cancelado) {
          aplicacion.destroy(true, { children: true });
          return;
        }

        app = aplicacion;
        aplicacion.canvas.style.width = '100%';
        aplicacion.canvas.style.height = 'auto';
        contenedor.appendChild(aplicacion.canvas);

        timeline.current = buildTimeline(aplicacion.stage, planFight(replay), setPie);
        setListo(true);
      } catch (error) {
        if (!cancelado) setFallo(error instanceof Error ? error.message : 'Error de dibujo');
      }
    })();

    return () => {
      cancelado = true;
      timeline.current?.kill();
      timeline.current = null;
      app?.destroy(true, { children: true });
    };
  }, [replay]);

  useEffect(() => {
    timeline.current?.timeScale(velocidad);
  }, [velocidad, listo]);

  const tl = timeline.current;

  return (
    <div>
      <div
        ref={host}
        style={{
          border: '1px solid var(--linea)',
          borderRadius: 6,
          overflow: 'hidden',
          lineHeight: 0,
          background: '#f6f6f4',
          aspectRatio: `${SIZE.width} / ${SIZE.height}`,
        }}
      />

      {fallo !== null && (
        <p className="error">
          No se ha podido dibujar el combate: {fallo}. Lo tienes entero en texto mas abajo.
        </p>
      )}

      <p className="apagado" style={{ minHeight: '1.5rem', marginTop: '0.5rem' }}>
        {pie ?? (listo ? 'Preparados...' : 'Montando la escena...')}
      </p>

      <div className="fila">
        <button
          disabled={!listo}
          onClick={() => {
            if (tl === null) return;
            if (reproduciendo) tl.pause();
            else if (tl.progress() === 1) tl.restart();
            else tl.resume();
            setReproduciendo(!reproduciendo);
          }}
        >
          {reproduciendo ? 'Pausa' : 'Seguir'}
        </button>
        <button
          disabled={!listo}
          onClick={() => setVelocidad((v) => (v === 1 ? 2 : v === 2 ? 4 : 1))}
        >
          x{velocidad}
        </button>
        <button
          disabled={!listo}
          onClick={() => {
            tl?.progress(1);
            setReproduciendo(false);
          }}
        >
          Ir al final
        </button>
        <button
          disabled={!listo}
          onClick={() => {
            tl?.restart();
            setReproduciendo(true);
          }}
        >
          Repetir
        </button>
      </div>
    </div>
  );
}
