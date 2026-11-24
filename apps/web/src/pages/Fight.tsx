import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api, ApiError } from '../api.js';
import { Boton, Pagina } from '../ui.js';
import { FightLog } from '../FightLog.js';
import { EscenaCombate } from '../EscenaCombate.js';
import { CompartirEnlace } from '../CompartirEnlace.js';

// Pixi y GSAP son la mitad del peso del bundle y solo se usan en esta pantalla.
const cargarPlayer = () => import('../FightPlayer.js');
const FightPlayer = lazy(() => cargarPlayer().then((m) => ({ default: m.FightPlayer })));

export function FightPage() {
  const { id = '' } = useParams();
  const fight = useQuery({ queryKey: ['fight', id], queryFn: () => api.fight(id) });
  // El reproductor se pide a la vez que el combate, no despues: `lazy` no lo
  // pediria hasta pintarlo, y eso es cuando ya han llegado los datos. En un
  // movil son dos viajes seguidos en vez de dos a la vez.
  useEffect(() => {
    void cargarPlayer();
  }, []);

  if (fight.isPending)
    return (
      <Pagina>
        <p className="apagado">Cargando…</p>
      </Pagina>
    );
  if (fight.error) {
    // Solo un 404 dice que no existe. Un corte de red o un fallo del servidor no
    // significa eso, y decirlo mandaba a casa a quien solo tenia que reintentar.
    const noExiste = fight.error instanceof ApiError && fight.error.status === 404;
    return (
      <Pagina>
        <h1>{noExiste ? 'Ese combate no existe' : 'No se ha podido cargar el combate'}</h1>
        <div className="fila">
          {!noExiste && (
            <Boton tipo="principal" onClick={() => void fight.refetch()}>
              Reintentar
            </Boton>
          )}
          <Link to="/">Volver al principio</Link>
        </div>
      </Pagina>
    );
  }

  const { snapshotA, snapshotB } = fight.data;
  const titulo = `${snapshotA.name} contra ${snapshotB.name}`;

  return (
    <Pagina>
      <p className="apagado">
        <Link to={`/b/${snapshotA.slug}`}>← {snapshotA.name}</Link>
      </p>
      <h1>{titulo}</h1>

      <Suspense
        fallback={
          <EscenaCombate nombres={[snapshotA.name, snapshotB.name]} pie="Montando la escena…" />
        }
      >
        <FightPlayer replay={fight.data} />
      </Suspense>

      <details style={{ marginTop: '1.5rem' }}>
        {/* Un lienzo no lo lee un lector de pantalla: el texto es el respaldo. */}
        <summary>Ver el combate en texto</summary>
        <div style={{ marginTop: '0.75rem' }}>
          <FightLog replay={fight.data} />
        </div>
      </details>

      <div className="fila" style={{ marginTop: '1rem' }}>
        <CompartirEnlace
          url={window.location.href}
          titulo={titulo}
          dondeCopiar="de la barra de direcciones"
        >
          <Link to={`/b/${snapshotB.slug}`} className="apagado">
            Ver a {snapshotB.name}
          </Link>
        </CompartirEnlace>
      </div>
    </Pagina>
  );
}
