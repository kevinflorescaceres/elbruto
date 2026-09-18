import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useMe } from '../hooks.js';

export function RankingPage() {
  const ranking = useQuery({ queryKey: ['ranking'], queryFn: api.ranking });
  const me = useMe();
  const mios = new Set(me.data?.brutes.map((b) => b.slug) ?? []);

  if (ranking.isPending) return <main className="apagado">Cargando...</main>;
  if (ranking.error)
    return (
      <main>
        <h1>No se ha podido cargar el ranking</h1>
        <Link to="/">Volver</Link>
      </main>
    );

  return (
    <main>
      <p className="apagado">
        <Link to="/">← Mis peleones</Link>
      </p>
      <h1>Los más temidos</h1>
      <p className="apagado">
        {ranking.data.total} peleones en la calle. Los bots de la casa no cuentan.
      </p>

      <div className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Peleón</th>
              <th>Nivel</th>
              <th>Récord</th>
            </tr>
          </thead>
          <tbody>
            {ranking.data.brutes.map((b) => (
              <tr key={b.slug} style={mios.has(b.slug) ? { fontWeight: 'bold' } : undefined}>
                <td className="apagado">{b.rank}</td>
                <td>
                  <Link to={`/b/${b.slug}`}>{b.name}</Link>
                  {mios.has(b.slug) && <span className="apagado"> · tuyo</span>}
                </td>
                <td>{b.level}</td>
                <td className="apagado">
                  {b.wins}V {b.losses}D
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ranking.data.brutes.length === 0 && (
        <p className="apagado">Todavía no hay nadie. Sé el primero.</p>
      )}
    </main>
  );
}
