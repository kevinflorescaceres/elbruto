/**
 * Reproductor del combate con PixiJS y GSAP (PLAN.md fase 4).
 *
 * El guion lo construye `fightScene.ts`, que es puro y esta probado. Aqui solo
 * se monta el lienzo, se ata la linea de tiempo y se exponen los controles.
 */
import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
// Las extensiones del navegador van en este mismo trozo. Sin esto, Pixi las pide
// por su cuenta al arrancar, otro viaje de red despues de bajar este fichero.
import 'pixi.js/browser';
import { aEntero, LIENZO, type FightReplay } from '@camorra/shared';
import { planFight } from './fightScene.js';
import { SIZE } from './pixiScene.js';
import { buildTimeline } from './timeline.js';
import { EscenaCombate } from './EscenaCombate.js';

/**
 * Pixeles de verdad por pixel de escena. El lienzo se dibuja a SIZE y `cover` lo
 * escala para llenar su hueco: en un movil lo encoge a la mitad, y dibujarlo a
 * la densidad entera de la pantalla era pintar cuatro veces los pixeles que se
 * ven, en cada fotograma. Nunca pasa de la densidad de la pantalla.
 */
function resolucion(contenedor: HTMLElement): number {
  const { width, height } = contenedor.getBoundingClientRect();
  const escala = Math.max(width / SIZE.width, height / SIZE.height);
  const densidad = window.devicePixelRatio || 1;
  return escala > 0 ? densidad * Math.min(1, escala) : densidad;
}

export function FightPlayer({
  replay,
  alTerminar,
}: {
  replay: FightReplay;
  /** Avisa al acabar (o al saltar al final) y al volver a empezar. */
  alTerminar?: (terminado: boolean) => void;
}) {
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
  const [terminado, setTerminado] = useState(false);

  useEffect(() => {
    alTerminar?.(terminado);
  }, [terminado, alTerminar]);

  useEffect(() => {
    const contenedor = host.current;
    if (contenedor === null) return;

    // StrictMode monta dos veces en desarrollo: si el init asincrono termina
    // despues de desmontar, hay que tirar la aplicacion en vez de pintarla.
    let cancelado = false;
    let app: Application | null = null;
    let vigia: ResizeObserver | null = null;

    void (async () => {
      try {
        const aplicacion = new Application();
        await aplicacion.init({
          width: SIZE.width,
          height: SIZE.height,
          background: aEntero(LIENZO.fondo),
          antialias: true,
          skipExtensionImports: true,
          // Sin autoDensity: el tamano en CSS lo pone este componente (100%), y
          // autoDensity lo pisaria en pixeles a cada cambio de resolucion.
          resolution: resolucion(contenedor),
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
        // Girar el movil o cambiar la ventana cambia lo que ocupa el lienzo.
        vigia = new ResizeObserver(() => {
          const nueva = resolucion(contenedor);
          if (Math.abs(nueva - aplicacion.renderer.resolution) > 0.05) {
            aplicacion.renderer.resize(SIZE.width, SIZE.height, nueva);
          }
        });
        vigia.observe(contenedor);

        const tl = buildTimeline(
          aplicacion.stage,
          planFight(replay),
          setPie,
          {
            A: barraA.current,
            B: barraB.current,
          },
          { menosMovimiento: sinMovimiento },
        );
        if (sinMovimiento) tl.pause();
        // Al acabar solo, el boton seguia diciendo "Pausa" sin nada que pausar.
        tl.eventCallback('onComplete', () => {
          setReproduciendo(false);
          setTerminado(true);
        });
        timeline.current = tl;
        setListo(true);
      } catch (error) {
        if (!cancelado) setFallo(error instanceof Error ? error.message : 'Error de dibujo');
      }
    })();

    return () => {
      cancelado = true;
      vigia?.disconnect();
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
    <EscenaCombate
      nombres={[replay.snapshotA.name, replay.snapshotB.name]}
      barras={[barraA, barraB]}
      lienzo={host}
      terminado={terminado}
      pie={pie ?? (listo ? 'Preparados…' : 'Montando la escena…')}
      aviso={
        fallo !== null && (
          <p className="error">
            No se ha podido dibujar el combate: {fallo}. Lo tienes entero en texto más abajo.
          </p>
        )
      }
      controles={
        !listo || tl === null
          ? undefined
          : {
              reproduciendo,
              velocidad,
              pausa: () => {
                if (reproduciendo) tl.pause();
                else if (tl.progress() === 1) tl.restart();
                else tl.resume();
                setReproduciendo(!reproduciendo);
              },
              acelerar: () => setVelocidad((v) => (v === 1 ? 2 : v === 2 ? 4 : 1)),
              alFinal: () => {
                tl.progress(1);
                setReproduciendo(false);
                setTerminado(true);
              },
              repetir: () => {
                tl.restart();
                setReproduciendo(true);
                setTerminado(false);
              },
            }
      }
    />
  );
}
