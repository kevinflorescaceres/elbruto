import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { createBrute, getSkill, getWeapon } from '@camorra/engine';
import { NAME_MAX, type BruteProfile } from '@camorra/shared';
import { api, ApiError } from '../api.js';
import { Boton, ESTADISTICAS, Estadistica, Pagina, Tarjeta, TarjetaEnlace } from '../ui.js';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { useMe } from '../hooks.js';
import { ayudaNombre } from '../nombre.js';
import { EnlaceRecuperacion } from '../EnlaceRecuperacion.js';
import { anadirPendiente, leerPendientes, quitarPendiente } from '../enlacesPendientes.js';

/*
 * Dos peleones de muestra, sacados del motor igual que cualquier otro: la cara
 * sale del nombre. Elegidos porque los dos empiezan con arma y se distinguen
 * bien. No existen en la base; si alguien crea uno con ese nombre, sera este.
 */
const MUESTRA = ['Rosca la Brava', 'Matías Puñetas'].map(createBrute);

/**
 * Lo primero que se ve al crear: el peleon en grande y el siguiente paso. Antes
 * aparecia pequeno al fondo de la lista y el formulario seguia arriba, vacio,
 * pidiendo otro.
 */
function RecienCreado({ brute, otro }: { brute: BruteProfile; otro: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  // Foco al titulo: quien usa lector de pantalla oye quien es. Y arriba del
  // todo, porque la tarjeta pasa a ser lo primero de la pagina y en el movil la
  // pantalla se quedaba donde estaba el formulario.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [brute.slug]);

  // Empieza con una mejora: un arma o una maña (createBrute en el motor).
  const inicial = [
    ...brute.weapons.map((id) => getWeapon(id).name),
    ...brute.skills.map((id) => getSkill(id).name),
  ];

  return (
    <Tarjeta>
      <h1 ref={titulo} tabIndex={-1} className="recien-titulo">
        Aquí está {brute.name}
      </h1>
      <div className="ficha-cuerpo">
        <div className="retrato">
          <Fighter
            appearance={brute.appearance}
            slug={brute.slug}
            weapon={armaVisible(brute.weapons)}
            height={170}
          />
        </div>
        <div className="ficha-datos">
          <div className="estadisticas">
            <Estadistica etiqueta="Vida" valor={brute.maxHp} />
            {ESTADISTICAS.map(([etiqueta, campo]) => (
              <Estadistica key={campo} etiqueta={etiqueta} valor={brute[campo]} />
            ))}
          </div>
          {inicial.length > 0 && (
            <p className="recien-inicial">
              Sale a la calle con <strong>{inicial.join(' y ')}</strong>.
            </p>
          )}
          <div className="fila">
            <Link to={`/b/${brute.slug}/arena`} className="boton principal">
              Buscar pelea
            </Link>
            <Boton onClick={otro}>Crear otro</Boton>
          </div>
        </div>
      </div>
    </Tarjeta>
  );
}

/**
 * Que pasa con el enlace de reclutamiento. El servidor ignora sin decir nada un
 * maestro que no existe, que es un bot o que es tuyo, asi que la promesa de "se
 * lleva una pelea mas" solo se hace cuando de verdad se cumple.
 */
type Recluta =
  | { tipo: 'ninguno' }
  | { tipo: 'cargando' }
  | { tipo: 'valido'; maestro: BruteProfile }
  | { tipo: 'aviso'; texto: string };

function recluta(
  masterSlug: string | undefined,
  maestro: { data?: BruteProfile; isPending: boolean; error: Error | null },
  propios: string[],
): Recluta {
  if (masterSlug === undefined) return { tipo: 'ninguno' };
  if (maestro.isPending) return { tipo: 'cargando' };
  if (maestro.data === undefined) {
    const noExiste = maestro.error instanceof ApiError && maestro.error.status === 404;
    return {
      tipo: 'aviso',
      texto: noExiste
        ? 'Ese enlace no lleva a nadie, pero puedes crear tu peleón igual.'
        : 'No se ha podido comprobar quién te recluta. Puedes crear tu peleón igual.',
    };
  }
  if (propios.includes(maestro.data.slug)) {
    return {
      tipo: 'aviso',
      texto: `Este es el enlace de ${maestro.data.name}: mándaselo a otros. Con tus propios peleones no cuenta.`,
    };
  }
  if (maestro.data.isBot) {
    return {
      tipo: 'aviso',
      texto: `${maestro.data.name} es un peleón de la casa y no recluta, pero puedes crear el tuyo igual.`,
    };
  }
  return { tipo: 'valido', maestro: maestro.data };
}

export function Home() {
  // Si se llega por un enlace de invitacion, el maestro viene en la ruta.
  const { slug: masterSlug } = useParams();
  const maestro = useQuery({
    queryKey: ['brute', masterSlug],
    queryFn: () => api.brute(masterSlug ?? ''),
    enabled: masterSlug !== undefined,
  });

  const me = useMe();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  // Se leen al montar: si se fue a pelear sin guardarlo, al volver sigue ahi.
  const [pendientes, setPendientes] = useState(() => leerPendientes());
  const [creado, setCreado] = useState<BruteProfile | null>(null);

  const ayuda = ayudaNombre(name);
  const reclutamiento = recluta(
    masterSlug,
    maestro,
    (me.data?.brutes ?? []).map((b) => b.slug),
  );
  // Si te recluta alguien, en el escenario esta el: dice mas que dos de muestra.
  const escena = reclutamiento.tipo === 'valido' ? [reclutamiento.maestro] : MUESTRA;

  const create = useMutation({
    mutationFn: () => api.createBrute(name, masterSlug),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setName('');
      setCreado(data.brute);
      // Se ensena una sola vez: no hay endpoint para volver a pedirlo.
      setPendientes(
        anadirPendiente({
          slug: data.brute.slug,
          nombre: data.brute.name,
          url: `${window.location.origin}${data.claimUrl}`,
        }),
      );
    },
  });

  return (
    <Pagina>
      {creado !== null ? (
        <RecienCreado
          brute={creado}
          otro={() => {
            create.reset();
            setCreado(null);
          }}
        />
      ) : (
        <>
          {/* La marca ya esta en la barra: el h1 dice lo que pasa aqui. */}
          <header className="portada-cabecera">
            <div>
              {/* Si te recluta alguien, la cabecera habla de el: es por quien has venido. */}
              {reclutamiento.tipo === 'valido' ? (
                <>
                  <h1>Te recluta {reclutamiento.maestro.name}</h1>
                  <p className="apagado">
                    Crea tu peleón y {reclutamiento.maestro.name} se lleva una pelea diaria más. Tú
                    empiezas igual que todos: eso no te quita nada.
                  </p>
                </>
              ) : (
                <>
                  <h1>Pon un nombre y tendrás un peleón.</h1>
                  <p className="apagado">Lo demás lo deciden él y la mala suerte.</p>
                </>
              )}
              <p className="portada-vuelta">
                Cada día, unas cuantas peleas. Cada nivel, una mejora a elegir entre dos.
              </p>
            </div>
            {/* Decorativa: el nombre ya va en el texto, o son de muestra. */}
            <div className="portada-escena" aria-hidden="true">
              {escena.map((brute, i) => (
                <figure key={brute.slug} className={i === 1 ? 'rival' : undefined}>
                  <div className="portada-figura">
                    <Fighter
                      appearance={brute.appearance}
                      slug={brute.slug}
                      weapon={armaVisible(brute.weapons)}
                      height={150}
                    />
                  </div>
                  <figcaption>{brute.name}</figcaption>
                </figure>
              ))}
            </div>
          </header>

          <Tarjeta>
            <h2>Nuevo peleón</h2>
            {reclutamiento.tipo === 'cargando' && (
              <p className="apagado recluta-texto">Buscando a quien te recluta…</p>
            )}
            {reclutamiento.tipo === 'aviso' && (
              <p className="apagado recluta-texto">{reclutamiento.texto}</p>
            )}
            <label htmlFor="nombre-peleon" className="etiqueta">
              Nombre del peleón
            </label>
            <form
              className="campo-nombre"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <input
                id="nombre-peleon"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chirlo de la Cava"
                maxLength={NAME_MAX}
                aria-describedby="nombre-ayuda"
                aria-invalid={ayuda.tipo === 'error'}
              />
              <Boton type="submit" tipo="principal" disabled={!ayuda.valido || create.isPending}>
                {create.isPending ? 'Creando…' : 'Crear'}
              </Boton>
            </form>
            {/* Dice por que el boton no se deja pulsar, en vez de dejarlo apagado sin mas. */}
            <p
              id="nombre-ayuda"
              className={ayuda.tipo === 'error' ? 'ayuda error' : 'ayuda apagado'}
              aria-live="polite"
            >
              {ayuda.texto}
            </p>
            {create.error && (
              <p className="error" role="alert">
                {create.error instanceof ApiError
                  ? create.error.message
                  : 'No se ha podido crear. Inténtalo otra vez.'}
              </p>
            )}
          </Tarjeta>
        </>
      )}

      {pendientes.map((enlace) => (
        <EnlaceRecuperacion
          key={enlace.slug}
          enlace={enlace}
          onGuardado={() => setPendientes(quitarPendiente(enlace.slug))}
        />
      ))}

      {me.isPending && <p className="apagado">Cargando...</p>}
      {/* Quien llega por primera vez no tiene peleones: no se le ensena una lista vacia. */}
      {me.data !== undefined && me.data.brutes.length > 0 && (
        <section className="portada-seccion">
          <h2>Mis peleones</h2>
          <div className="rejilla">
            {me.data?.brutes.map((brute) => (
              <TarjetaEnlace key={brute.slug} a={`/b/${brute.slug}`}>
                {/* Con cara: es la lista que mas se mira y era la unica sin retrato. */}
                <div className="ficha-mini">
                  <Fighter
                    appearance={brute.appearance}
                    slug={brute.slug}
                    weapon={armaVisible(brute.weapons)}
                    height={92}
                  />
                  <div>
                    <strong>{brute.name}</strong>
                    <div className="apagado">
                      Nivel {brute.level} · {brute.wins}V {brute.losses}D
                    </div>
                    {brute.pendingLevelUp && <div className="aviso">Mejora pendiente</div>}
                  </div>
                </div>
              </TarjetaEnlace>
            ))}
          </div>
        </section>
      )}

      {/* El ranking ya esta en la barra superior: aqui solo lo legal. */}
      <footer className="apagado portada-pie">
        Juego inspirado en los combates automáticos por turnos. Todo el contenido es original. ·{' '}
        <Link to="/legal">Condiciones y privacidad</Link>
      </footer>
    </Pagina>
  );
}
