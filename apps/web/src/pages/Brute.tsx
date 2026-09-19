import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { getPet, getSkill, getWeapon, type WeaponCategory } from '@camorra/engine';
import { Fighter } from '../art/Fighter.js';
import { Cuenta } from '../Cuenta.js';
import { Barra, Boton, Chips, Estadistica, Pagina, Tarjeta } from '../ui.js';
import { api } from '../api.js';
import { useBrute, useIsMine } from '../hooks.js';

const STATS = [
  ['Aguante', 'endurance'],
  ['Fuerza', 'strength'],
  ['Maña', 'agility'],
  ['Brío', 'speed'],
] as const;

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
        placeholder="Qué problema hay con este peleón"
        style={{ flex: 1 }}
      />
      <button type="submit" disabled={reason.trim().length < 3}>
        Enviar
      </button>
    </form>
  );
}

/** El arma que se lleva a la vista: la de mas alcance, que es la que mas luce. */
function mejorArma(ids: string[]): { category: WeaponCategory; reach: number } | undefined {
  const armas = ids.map(getWeapon).sort((a, b) => b.reach - a.reach);
  const arma = armas[0];
  return arma === undefined ? undefined : { category: arma.category, reach: arma.reach };
}

export function BrutePage() {
  const { slug = '' } = useParams();
  const brute = useBrute(slug);
  const mine = useIsMine(slug);
  const history = useQuery({ queryKey: ['fights', slug], queryFn: () => api.fights(slug) });

  if (brute.isPending)
    return (
      <Pagina>
        <p className="apagado">Cargando...</p>
      </Pagina>
    );
  if (brute.error)
    return (
      <Pagina>
        <h1>No hay nadie con ese nombre</h1>
        <Link to="/">Volver</Link>
      </Pagina>
    );

  const b = brute.data;

  return (
    <Pagina volver={{ a: '/', texto: 'Mis peleones' }}>
      <h1>{b.name}</h1>
      <p className="apagado">
        Nivel {b.level} · {b.xp}/{b.xpToNextLevel} de experiencia · {b.wins} victorias, {b.losses}{' '}
        derrotas{b.isBot && ' · peleón de la casa'}
      </p>

      <Tarjeta>
        <div className="ficha-cuerpo">
          <div className="retrato">
            <Fighter
              appearance={b.appearance}
              slug={b.slug}
              weapon={mejorArma(b.weapons)}
              height={170}
            />
          </div>

          <div className="ficha-datos">
            <div className="estadisticas">
              <Estadistica etiqueta="Vida" valor={b.maxHp} />
              {STATS.map(([etiqueta, campo]) => (
                <Estadistica key={campo} etiqueta={etiqueta} valor={b[campo]} />
              ))}
            </div>

            <Barra de={b.xp} entre={b.xpToNextLevel} etiqueta="Experiencia" />

            <dl className="equipo">
              <dt>Armas</dt>
              <dd>
                <Chips nombres={b.weapons.map((id) => getWeapon(id).name)} vacio="Solo los puños" />
              </dd>
              <dt>Mañas</dt>
              <dd>
                <Chips nombres={b.skills.map((id) => getSkill(id).name)} vacio="Ninguna" />
              </dd>
              <dt>Bichos</dt>
              <dd>
                <Chips nombres={b.pets.map((id) => getPet(id).name)} vacio="Ninguno" />
              </dd>
            </dl>
          </div>
        </div>
      </Tarjeta>

      {mine && (
        <Tarjeta>
          {/* Mientras se refresca, lo cacheado puede estar viejo: ensenar el boton
              de pelear cuando ya hay mejora pendiente lleva a un 409 sin sentido. */}
          {brute.isFetching ? (
            <p className="apagado">Comprobando...</p>
          ) : b.pendingLevelUp ? (
            <>
              <p>Tienes una mejora sin elegir. Hasta que la elijas no puedes pelear.</p>
              <Link to={`/b/${slug}/level-up`}>
                <Boton tipo="principal">Elegir mejora</Boton>
              </Link>
            </>
          ) : (
            <>
              {b.fightsLeftToday > 0 ? (
                <p>
                  Te quedan <strong>{b.fightsLeftToday}</strong> peleas hoy.
                </p>
              ) : (
                <p>
                  Por hoy se acabó. Vuelven en{' '}
                  <strong>
                    <Cuenta hasta={b.nextResetAt} />
                  </strong>
                  .
                </p>
              )}
              <Link to={`/b/${slug}/arena`}>
                <Boton tipo="principal" disabled={b.fightsLeftToday === 0}>
                  Buscar pelea
                </Boton>
              </Link>
            </>
          )}
        </Tarjeta>
      )}

      {mine && (
        <Tarjeta hundida>
          <h3>Recluta gente</h3>
          <p className="apagado">
            Cada peleón que entre con tu enlace te da <strong>una pelea diaria más</strong>, hasta
            seis. A quien recluta no le cuesta nada.
          </p>
          <code style={{ wordBreak: 'break-all' }}>
            {`${window.location.origin}/reclutar/${slug}`}
          </code>
          <div className="fila enlace-recluta">
            <Boton
              onClick={() =>
                void navigator.clipboard.writeText(`${window.location.origin}/reclutar/${slug}`)
              }
            >
              Copiar enlace
            </Boton>
            <span className="apagado">
              {b.pupils === 0
                ? 'Todavía no has reclutado a nadie.'
                : `${b.pupils} reclutado${b.pupils === 1 ? '' : 's'}.`}
            </span>
          </div>
        </Tarjeta>
      )}

      <h2>Peleas</h2>
      {history.data?.fights.length === 0 && <p className="apagado">Todavía no ha peleado.</p>}
      {history.data?.fights.map((fight) => (
        <p key={fight.id}>
          <Link to={`/fight/${fight.id}`}>
            {fight.won ? 'Ganó' : 'Perdió'} contra {fight.opponent.name} (nivel{' '}
            {fight.opponent.level})
          </Link>{' '}
          <span className="apagado">{new Date(fight.createdAt).toLocaleDateString()}</span>
        </p>
      ))}

      <div className="denuncia">
        <Denuncia slug={slug} />
      </div>
    </Pagina>
  );
}
