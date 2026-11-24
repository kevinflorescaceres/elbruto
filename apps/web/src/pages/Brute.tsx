import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { getPet, getSkill, getWeapon } from '@camorra/engine';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { Cuenta } from '../Cuenta.js';
import type { BruteProfile } from '@camorra/shared';
import {
  Barra,
  Boton,
  BuscarPelea,
  Chips,
  ESTADISTICAS,
  Estadistica,
  Pagina,
  record,
  Resultado,
  Tarjeta,
} from '../ui.js';
import { api, ApiError } from '../api.js';
import { useBrute, useIsMine, useMe } from '../hooks.js';
import { CompartirEnlace } from '../CompartirEnlace.js';
import { NadieAqui } from '../Escenario.js';
import { CrearAqui } from '../CrearPeleon.js';
import { describeSkill } from '../skillText.js';

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
        aria-label="Qué problema hay con este peleón"
        className="campo-crece"
      />
      <Boton type="submit" disabled={reason.trim().length < 3}>
        Enviar
      </Boton>
    </form>
  );
}

/**
 * Desafiar a un peleon ajeno. El endpoint ya lo admitia: solo exige que el
 * rival exista y este a un nivel de distancia. Lo que faltaba era la forma de
 * decirlo desde la interfaz, que es lo unico que ataba a pelear contra los seis
 * del sorteo.
 */
function Desafio({ rival }: { rival: BruteProfile }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();

  // Solo valen los mios que esten a un nivel de distancia.
  const candidatos = (me.data?.brutes ?? [])
    .filter((b) => Math.abs(b.level - rival.level) <= 1)
    .sort((a, b) => b.level - a.level);

  const desafiar = useMutation({
    mutationFn: (mio: string) => api.startFight(mio, rival.slug),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['brute', rival.slug] });
      await navigate(`/fight/${res.fightId}`);
    },
  });

  if (me.data === undefined) return null;
  if (me.data.brutes.length === 0) {
    return (
      <CrearAqui
        titulo="¿Y tú?"
        aviso={`Para desafiar a ${rival.name} necesitas un peleón. Pon un nombre y lo tienes.`}
      />
    );
  }

  if (candidatos.length === 0) {
    return (
      <Tarjeta hundida>
        <p className="apagado">
          Ninguno de tus peleones está a su altura: solo se pelea contra gente de un nivel de
          distancia, y {rival.name} va por el {rival.level}.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta hundida>
      <h3>Desafiar a {rival.name}</h3>
      {desafiar.error && (
        <p className="error">
          {desafiar.error instanceof ApiError ? desafiar.error.message : 'No se ha podido pelear'}
        </p>
      )}
      <div className="fila">
        {candidatos.map((mio) => (
          <Boton
            key={mio.slug}
            tipo="principal"
            disabled={desafiar.isPending}
            onClick={() => desafiar.mutate(mio.slug)}
          >
            Con {mio.name}
          </Boton>
        ))}
      </div>
    </Tarjeta>
  );
}

export function BrutePage() {
  const { slug = '' } = useParams();
  const brute = useBrute(slug);
  const { mio: mine, sabido: saberDeQuienEs } = useIsMine(slug);
  const history = useQuery({ queryKey: ['fights', slug], queryFn: () => api.fights(slug) });

  if (brute.isPending)
    return (
      <Pagina>
        <p className="apagado">Cargando…</p>
      </Pagina>
    );
  if (brute.error)
    return (
      <Pagina>
        <NadieAqui titulo="No hay nadie con ese nombre">
          <p className="apagado">O se escribió mal, o ese peleón nunca existió.</p>
          <Link to="/" className="boton">
            Volver al principio
          </Link>
        </NadieAqui>
      </Pagina>
    );

  const b = brute.data;
  const enlaceRecluta = `${window.location.origin}/reclutar/${slug}`;

  return (
    <Pagina
      volver={{ a: '/', texto: 'Mis peleones' }}
      cabecera={{
        titulo: b.name,
        bajada: (
          <>
            {/* La experiencia ya va en su barra: aqui sobraba repetida. */}
            Nivel {b.level} · {record(b.wins, b.losses)}
            {b.isBot && ' · peleón de la casa'}
          </>
        ),
      }}
    >
      <Tarjeta className="ficha">
        <div className="ficha-cuerpo">
          <div className="retrato">
            <Fighter
              appearance={b.appearance}
              slug={b.slug}
              weapon={armaVisible(b.weapons)}
              height={170}
            />
          </div>

          <div className="ficha-datos">
            <div className="estadisticas">
              <Estadistica etiqueta="Vida" valor={b.maxHp} />
              {ESTADISTICAS.map(([etiqueta, campo]) => (
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
                <Manas ids={b.skills} />
              </dd>
              <dt>Bichos</dt>
              <dd>
                <Chips nombres={b.pets.map((id) => getPet(id).name)} vacio="Ninguno" />
              </dd>
            </dl>
          </div>
        </div>
      </Tarjeta>

      {saberDeQuienEs && !mine && <Desafio rival={b} />}

      {mine && (
        // En el movil va pegada al pie: lo que se viene a hacer cada dia quedaba
        // debajo del pliegue, tras el retrato y las cifras.
        <Tarjeta className="ficha-accion">
          {/* Mientras se refresca, lo cacheado puede estar viejo: ensenar el boton
              de pelear cuando ya hay mejora pendiente lleva a un 409 sin sentido. */}
          {brute.isFetching ? (
            <p className="apagado">Comprobando…</p>
          ) : b.pendingLevelUp ? (
            <>
              <p>Tienes una mejora sin elegir. Hasta que la elijas no puedes pelear.</p>
              {/* Un enlace con forma de boton, no un boton dentro de un enlace: anidados
                  son dos paradas de tabulador y un lector de pantalla los anuncia dos veces. */}
              <Link to={`/b/${slug}/level-up`} className="boton principal">
                Elegir mejora
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
              <BuscarPelea slug={slug} quedan={b.fightsLeftToday} />
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
          <code className="enlace-url">{enlaceRecluta}</code>
          <div className="fila enlace-recluta">
            <CompartirEnlace
              url={enlaceRecluta}
              titulo="Camorra"
              texto={`Hazte un peleón en Camorra y pelea contra ${b.name}:`}
              dondeCopiar="de aquí arriba"
            >
              <span className="apagado">
                {b.pupils === 0
                  ? 'Todavía no has reclutado a nadie.'
                  : `${b.pupils} reclutado${b.pupils === 1 ? '' : 's'}.`}
              </span>
            </CompartirEnlace>
          </div>
        </Tarjeta>
      )}

      <h2>Peleas</h2>
      {history.data?.fights.length === 0 && <p className="apagado">Todavía no ha peleado.</p>}
      {history.data !== undefined && history.data.fights.length > 0 && (
        <ul className="historial">
          {history.data.fights.map((fight) => (
            <li key={fight.id}>
              <Link to={`/fight/${fight.id}`}>
                <Resultado gano={fight.won} />
                <span className="historial-rival">
                  contra {fight.opponent.name}{' '}
                  <span className="apagado">(nivel {fight.opponent.level})</span>
                </span>
                <time dateTime={fight.createdAt}>
                  {new Date(fight.createdAt).toLocaleDateString('es')}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="denuncia">
        <Denuncia slug={slug} />
      </div>
    </Pagina>
  );
}

/** Cada mania con lo que hace: el nombre solo no dice nada a quien empieza. */
function Manas({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <span className="apagado">Ninguna</span>;
  return (
    <ul className="manas">
      {ids.map((id) => {
        const skill = getSkill(id);
        return (
          <li key={id}>
            <span className="chip">{skill.name}</span>
            <span className="apagado">{describeSkill(skill)}</span>
          </li>
        );
      })}
    </ul>
  );
}
