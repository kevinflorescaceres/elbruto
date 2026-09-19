/**
 * Reproductor del combate con PixiJS y GSAP (PLAN.md fase 4).
 *
 * El guion lo construye `fightScene.ts`, que es puro y esta probado. Aqui solo
 * se monta el lienzo, se ata la linea de tiempo y se exponen los controles.
 */
import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import { aEntero, LIENZO, type FightReplay } from '@camorra/shared';
import { planFight } from './fightScene.js';
import { SIZE } from './pixiScene.js';
import { buildTimeline } from './timeline.js';

/**
 * Marcador en HTML, no dentro del lienzo. En pantalla estrecha el lienzo se
 * recorta por los lados y se llevaba por delante las chapas de los nombres;
 * aqui el marcador mide siempre lo que mide la ventana, y el nombre sale con
 * la tipografia de verdad en vez de con texto rasterizado por Pixi.
 */
function Vida({
  nombre,
  lado,
  barra,
}: {
  nombre: string;
  lado: 'izq' | 'der';
  barra: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className={`vida vida-${lado}`}>
      <div className="vida-cubeta">
        <div className="vida-relleno" ref={barra} />
      </div>
      <span className="vida-nombre">{nombre}</span>
    </div>
  );
}

export function FightPlayer({ replay }: { replay: FightReplay }) {
  const host = useRef<HTMLDivElement>(null);
  const barraA = useRef<HTMLDivElement>(null);
  const barraB = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const [listo, setListo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  // Quien pide menos movimiento no deberia encontrarse un combate animandose solo.
  const sinMovimiento =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [reproduciendo, setReproduciendo] = useState(!sinMovimiento);
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
          background: aEntero(LIENZO.fondo),
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio,
        });

        if (cancelado) {
          aplicacion.destroy(true, { children: true });
          return;
        }

        app = aplicacion;
        // El lienzo llena la ventana; `cover` recorta por los LADOS cuando la
        // pantalla es mas estrecha que la escena. Nunca por arriba: ahi estan
        // el marcador y las cabezas.
        aplicacion.canvas.style.width = '100%';
        aplicacion.canvas.style.height = '100%';
        aplicacion.canvas.style.objectFit = 'cover';
        contenedor.appendChild(aplicacion.canvas);

        const tl = buildTimeline(aplicacion.stage, planFight(replay), setPie, {
          A: barraA.current,
          B: barraB.current,
        });
        if (sinMovimiento) tl.pause();
        timeline.current = tl;
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
  }, [replay, sinMovimiento]);

  useEffect(() => {
    timeline.current?.timeScale(velocidad);
  }, [velocidad, listo]);

  const tl = timeline.current;

  return (
    <div>
      <div className="marcador">
        <Vida
          nombre={replay.snapshotA.name}
          lado="izq"
          barra={(el) => {
            barraA.current = el;
          }}
        />
        <Vida
          nombre={replay.snapshotB.name}
          lado="der"
          barra={(el) => {
            barraB.current = el;
          }}
        />
      </div>

      <div ref={host} className="lienzo-combate" />

      {fallo !== null && (
        <p className="error">
          No se ha podido dibujar el combate: {fallo}. Lo tienes entero en texto más abajo.
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
