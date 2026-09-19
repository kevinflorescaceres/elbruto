import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useMe } from '../hooks.js';
import { Pagina } from '../ui.js';

interface Fila {
  rank: number;
  name: string;
  slug: string;
  level: number;
  wins: number;
  losses: number;
}

/** Nivel y récord apilados: es lo que permite pasar de cuatro columnas a tres. */
function Marcador({ fila }: { fila: Fila }) {
  return (
    <span className="rk-marcador">
      <span className="rk-nivel">Nivel {fila.level}</span>
      <span className="apagado">
        {fila.wins}V {fila.losses}D
      </span>
    </span>
  );
}

function FilaRanking({ fila, mia }: { fila: Fila; mia: boolean }) {
  // La fila entera es el enlace: a 390 px el objetivo tactil es la fila.
  return (
    <Link to={`/b/${fila.slug}`} className={mia ? 'rk-fila mia' : 'rk-fila'}>
      <span className="rk-puesto">{fila.rank}</span>
      <span className="rk-nombre">{fila.name}</span>
      <Marcador fila={fila} />
    </Link>
  );
}

export function RankingPage() {
  const ranking = useQuery({ queryKey: ['ranking'], queryFn: api.ranking });
  const me = useMe();

  // El puesto propio no viene en la tabla: se pide la ficha del mejor peleon.
  const mejorPropio = [...(me.data?.brutes ?? [])].sort((a, b) => b.level - a.level)[0];
  const propio = useQuery({
    queryKey: ['brute', mejorPropio?.slug],
    queryFn: () => api.brute(mejorPropio?.slug ?? ''),
    enabled: mejorPropio !== undefined,
  });

  const mios = new Set(me.data?.brutes.map((b) => b.slug) ?? []);

  if (ranking.isPending)
    return (
      <Pagina>
        <p className="apagado">Cargando...</p>
      </Pagina>
    );

  if (ranking.error)
    return (
      <Pagina>
        <h1>No se ha podido cargar el ranking</h1>
        <Link to="/">Volver</Link>
      </Pagina>
    );

  const yo = propio.data;

  return (
    <Pagina volver={{ a: '/', texto: 'Mis peleones' }}>
      <h1>Los más temidos</h1>
      <p className="apagado">
        {ranking.data.total} peleones en la calle. Los bots de la casa no cuentan.
      </p>

      {ranking.data.brutes.length === 0 ? (
        <p className="apagado">Todavía no hay nadie. Sé el primero.</p>
      ) : (
        <div className="rk-panel">
          <div className="rk-cabecera" aria-hidden="true">
            <span className="rk-puesto">#</span>
            <span className="rk-nombre">Peleón</span>
            <span className="rk-marcador">Nivel y récord</span>
          </div>
          {ranking.data.brutes.map((b) => (
            <FilaRanking key={b.slug} fila={b} mia={mios.has(b.slug)} />
          ))}
        </div>
      )}

      {yo !== undefined && yo.rank !== null && (
        <div className="rk-propia">
          <Link to={`/b/${yo.slug}`} className="rk-fila mia">
            <span className="rk-puesto">{yo.rank}</span>
            <span className="rk-nombre">
              {yo.name}
              <span className="apagado rk-etiqueta"> · Tu peleón</span>
            </span>
            <Marcador fila={{ ...yo, rank: yo.rank }} />
          </Link>
        </div>
      )}
    </Pagina>
  );
}
