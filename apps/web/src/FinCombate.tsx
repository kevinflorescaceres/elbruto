/**
 * El final del combate. Antes era "Se acabó en N turnos." en gris y un boton de
 * "Seguir": quien ganaba solo se veia en el lienzo (un lector de pantalla no se
 * enteraba), y el dueno tenia que volver a la ficha a buscar que hacer. Ahora el
 * resultado va en texto, y debajo una sola accion: la que toca.
 */
import { Link } from 'react-router';
import type { FightReplay } from '@camorra/shared';
import { useBrute, useMe } from './hooks.js';
import { BuscarPelea, Resultado } from './ui.js';
import { CompartirEnlace } from './CompartirEnlace.js';
import { Cuenta } from './Cuenta.js';

/** Lo que devuelve el servidor al pelear y la arena pasa al navegar aqui. */
export interface ResultadoReciente {
  slug: string;
  won: boolean;
  xpGained: number;
  leveledUp: boolean;
}

export function resultadoDe(estado: unknown): ResultadoReciente | null {
  if (typeof estado !== 'object' || estado === null || !('resultado' in estado)) return null;
  const r = (estado as { resultado: unknown }).resultado;
  if (typeof r !== 'object' || r === null) return null;
  const o = r as Record<string, unknown>;
  return typeof o.slug === 'string' &&
    typeof o.won === 'boolean' &&
    typeof o.xpGained === 'number' &&
    typeof o.leveledUp === 'boolean'
    ? (o as unknown as ResultadoReciente)
    : null;
}

export function FinCombate({
  replay,
  reciente,
}: {
  replay: FightReplay;
  reciente: ResultadoReciente | null;
}) {
  const me = useMe();
  const ganador = replay.winner === 'A' ? replay.snapshotA : replay.snapshotB;
  // El mio: el que acaba de pelear, o si no, cualquiera de los dos que sea mio.
  const mios = new Set(me.data?.brutes.map((b) => b.slug) ?? []);
  const slugMio =
    reciente?.slug ?? [replay.snapshotA.slug, replay.snapshotB.slug].find((slug) => mios.has(slug));
  const mio = useBrute(slugMio ?? '', slugMio !== undefined);
  const b = slugMio === undefined ? undefined : mio.data;
  const gano = slugMio === undefined ? undefined : ganador.slug === slugMio;

  return (
    <section className="tarjeta fin" aria-labelledby="fin-titulo">
      {/* Se anuncia al aparecer: es lo que el lienzo no puede decir. */}
      <div role="status">
        <h2 id="fin-titulo" className="fin-titulo">
          Gana {ganador.name}
        </h2>
        {gano !== undefined && (
          <p className="fin-resumen">
            <Resultado gano={gano} />
            {reciente !== null && <span>+{reciente.xpGained} de experiencia</span>}
            {reciente?.leveledUp === true && b !== undefined && (
              <strong className="fin-nivel">¡Sube a nivel {b.level}!</strong>
            )}
          </p>
        )}
      </div>

      <div className="fila fin-acciones">
        {b !== undefined &&
          (b.pendingLevelUp ? (
            <Link to={`/b/${b.slug}/level-up`} className="boton principal">
              Elegir mejora
            </Link>
          ) : b.fightsLeftToday > 0 ? (
            <>
              <BuscarPelea slug={b.slug} quedan={b.fightsLeftToday} />
              <span className="apagado">
                {b.fightsLeftToday === 1
                  ? 'Te queda 1 pelea hoy.'
                  : `Te quedan ${b.fightsLeftToday} peleas hoy.`}
              </span>
            </>
          ) : (
            <span className="apagado">
              Por hoy se acabó. Vuelven en <Cuenta hasta={b.nextResetAt} />.
            </span>
          ))}
      </div>

      <div className="fila fin-compartir">
        <CompartirEnlace
          url={window.location.href}
          titulo={`${replay.snapshotA.name} contra ${replay.snapshotB.name}`}
          dondeCopiar="de la barra de direcciones"
        />
      </div>
    </section>
  );
}
