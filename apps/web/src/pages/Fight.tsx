import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '../api.js';
import { FightLog } from '../FightLog.js';

// Pixi y GSAP son la mitad del peso del bundle y solo se usan en esta pantalla.
const FightPlayer = lazy(() =>
  import('../FightPlayer.js').then((m) => ({ default: m.FightPlayer })),
);

export function FightPage() {
  const { id = '' } = useParams();
  const fight = useQuery({ queryKey: ['fight', id], queryFn: () => api.fight(id) });

  if (fight.isPending) return <main className="apagado">Cargando...</main>;
  if (fight.error)
    return (
      <main>
        <h1>Ese combate no existe</h1>
        <Link to="/">Volver</Link>
      </main>
    );

  const { snapshotA, snapshotB } = fight.data;

  return (
    <main>
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
        <button onClick={() => void navigator.clipboard.writeText(window.location.href)}>
          Copiar enlace
        </button>
        <Link to={`/b/${snapshotB.slug}`} className="apagado">
          Ver a {snapshotB.name}
        </Link>
      </div>
    </main>
  );
}
