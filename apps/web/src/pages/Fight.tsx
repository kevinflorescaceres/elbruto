import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '../api.js';
import { FightLog } from '../FightLog.js';

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

      <FightLog replay={fight.data} />

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
