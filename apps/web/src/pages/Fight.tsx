import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '../api.js';
import { Boton, Pagina } from '../ui.js';
import { FightLog } from '../FightLog.js';

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
        <p className="apagado">Cargando...</p>
      </Pagina>
    );
  if (fight.error)
    return (
      <Pagina>
        <h1>Ese combate no existe</h1>
        <Link to="/">Volver</Link>
      </Pagina>
    );

  const { snapshotA, snapshotB } = fight.data;

  return (
    <Pagina>
      <p className="apagado">
        <Link to={`/b/${snapshotA.slug}`}>← {snapshotA.name}</Link>
      </p>
      <h1>
        {snapshotA.name} contra {snapshotB.name}
      </h1>

      <Suspense fallback={<p className="apagado">Montando la escena...</p>}>
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
        <Boton onClick={() => void navigator.clipboard.writeText(window.location.href)}>
          Copiar enlace
        </Boton>
        <Link to={`/b/${snapshotB.slug}`} className="apagado">
          Ver a {snapshotB.name}
        </Link>
      </div>
    </Pagina>
  );
}
