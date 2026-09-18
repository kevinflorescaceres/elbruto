import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { getPet, getSkill, getWeapon } from '@rufianes/engine';
import { api } from '../api.js';
import { useBrute, useIsMine } from '../hooks.js';

const STATS = [
  ['Aguante', 'endurance'],
  ['Fuerza', 'strength'],
  ['Maña', 'agility'],
  ['Brío', 'speed'],
] as const;

function Equipo({
  ids,
  resolve,
  vacio,
}: {
  ids: string[];
  resolve: (id: string) => string;
  vacio: string;
}) {
  if (ids.length === 0) return <span className="apagado">{vacio}</span>;
  return <span>{ids.map(resolve).join(', ')}</span>;
}

function Denuncia({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const report = useMutation({ mutationFn: () => api.report(slug, reason) });

  if (report.isSuccess) return <p className="apagado">Denuncia recibida. Gracias.</p>;
  if (!open)
    return (
      <button className="apagado" onClick={() => setOpen(true)}>
        Denunciar este nombre
      </button>
    );

  return (
    <form
      className="fila"
      onSubmit={(e) => {
        e.preventDefault();
        report.mutate();
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Que problema hay con este peleon"
        style={{ flex: 1 }}
      />
      <button type="submit" disabled={reason.trim().length < 3}>
        Enviar
      </button>
    </form>
  );
}

export function BrutePage() {
  const { slug = '' } = useParams();
  const brute = useBrute(slug);
  const mine = useIsMine(slug);
  const history = useQuery({ queryKey: ['fights', slug], queryFn: () => api.fights(slug) });

  if (brute.isPending) return <main className="apagado">Cargando...</main>;
  if (brute.error)
    return (
      <main>
        <h1>No hay nadie con ese nombre</h1>
        <Link to="/">Volver</Link>
      </main>
    );

  const b = brute.data;

  return (
    <main>
      <p className="apagado">
        <Link to="/">← Mis peleones</Link>
      </p>
      <h1>{b.name}</h1>
      <p className="apagado">
        Nivel {b.level} · {b.xp}/{b.xpToNextLevel} de experiencia · {b.wins} victorias, {b.losses}{' '}
        derrotas{b.isBot && ' · peleon de la casa'}
      </p>

      <div className="tarjeta">
        <table>
          <tbody>
            <tr>
              <th>Vida</th>
              <td>{b.maxHp}</td>
            </tr>
            {STATS.map(([label, key]) => (
              <tr key={key}>
                <th>{label}</th>
                <td>{b[key]}</td>
              </tr>
            ))}
            <tr>
              <th>Armas</th>
              <td>
                <Equipo
                  ids={b.weapons}
                  resolve={(id) => getWeapon(id).name}
                  vacio="Solo los puños"
                />
              </td>
            </tr>
            <tr>
              <th>Mañas</th>
              <td>
                <Equipo ids={b.skills} resolve={(id) => getSkill(id).name} vacio="Ninguna" />
              </td>
            </tr>
            <tr>
              <th>Bichos</th>
              <td>
                <Equipo ids={b.pets} resolve={(id) => getPet(id).name} vacio="Ninguno" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {mine && (
        <div className="tarjeta">
          {b.pendingLevelUp ? (
            <>
              <p>Tienes una mejora sin elegir. Hasta que la elijas no puedes pelear.</p>
              <Link to={`/b/${slug}/level-up`}>
                <button>Elegir mejora</button>
              </Link>
            </>
          ) : (
            <>
              <p>
                Te quedan <strong>{b.fightsLeftToday}</strong> peleas hoy.
              </p>
              <Link to={`/b/${slug}/arena`}>
                <button disabled={b.fightsLeftToday === 0}>Buscar pelea</button>
              </Link>
            </>
          )}
        </div>
      )}

      <h2>Peleas</h2>
      {history.data?.fights.length === 0 && <p className="apagado">Todavia no ha peleado.</p>}
      {history.data?.fights.map((fight) => (
        <p key={fight.id}>
          <Link to={`/fight/${fight.id}`}>
            {fight.won ? 'Gano' : 'Perdio'} contra {fight.opponent.name} (nivel{' '}
            {fight.opponent.level})
          </Link>{' '}
          <span className="apagado">{new Date(fight.createdAt).toLocaleDateString()}</span>
        </p>
      ))}

      <div style={{ marginTop: '2rem' }}>
        <Denuncia slug={slug} />
      </div>
    </main>
  );
}
