import { useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { createBrute, getSkill } from '@camorra/engine';
import { NAME_MAX, type BruteProfile } from '@camorra/shared';
import { api, ApiError } from '../api.js';
import { Boton, ESTADISTICAS, Estadistica, Pagina, record, Tarjeta } from '../ui.js';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { Cuenta } from '../Cuenta.js';
import { useMe } from '../hooks.js';
import { ayudaNombre, type AyudaNombre } from '../nombre.js';
import { EnlaceRecuperacion } from '../EnlaceRecuperacion.js';
import { describeSkill } from '../skillText.js';
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

  // Empieza con una mania y sin arma (createBrute en el motor).
  const mania = brute.skills[0] === undefined ? undefined : getSkill(brute.skills[0]);

  return (
    <div className="recien">
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
            {mania !== undefined && (
              <p className="recien-inicial">
                Sale a la calle a puño limpio y con una maña: <strong>{mania.name}</strong>.{' '}
                <span className="apagado">{describeSkill(mania)}</span>
              </p>
            )}
            <div className="fila recien-acciones">
              <Link to={`/b/${brute.slug}/arena`} className="boton principal">
                Buscar pelea
              </Link>
              <Boton onClick={otro}>Crear otro</Boton>
              <Link to={`/b/${brute.slug}`} className="apagado">
                Ver su ficha
              </Link>
            </div>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

/**
 * Un peleon propio en la portada, con lo que puede hacer hoy. Quien vuelve cada
 * dia viene a esto: antes tenia que entrar en cada ficha para saber si le
 * quedaban peleas.
 */
function TarjetaPeleon({ brute }: { brute: BruteProfile }) {
  const quedan = brute.fightsLeftToday;
  return (
    <div className="tarjeta tarjeta-peleon">
      <Link to={`/b/${brute.slug}`} className="ficha-mini enlace-ficha">
        <Fighter
          appearance={brute.appearance}
          slug={brute.slug}
          weapon={armaVisible(brute.weapons)}
          height={92}
        />
        <div>
          <strong className="enlace-ficha-nombre">{brute.name}</strong>
          <div className="apagado">
            Nivel {brute.level} · {record(brute.wins, brute.losses)}
          </div>
        </div>
      </Link>
      {/* Dos enlaces hermanos, no uno dentro de otro: no se pueden anidar. */}
      <div className="peleon-estado">
        {brute.pendingLevelUp ? (
          <>
            <span className="aviso">Mejora pendiente</span>
            <Link to={`/b/${brute.slug}/level-up`} className="boton principal">
              Elegir mejora
            </Link>
          </>
        ) : quedan > 0 ? (
          <>
            <span>{quedan === 1 ? 'Queda 1 pelea hoy' : `Quedan ${quedan} peleas hoy`}</span>
            <Link to={`/b/${brute.slug}/arena`} className="boton principal">
              Buscar pelea
            </Link>
          </>
        ) : (
          <span className="apagado">
            Por hoy se acabó. Vuelven en <Cuenta hasta={brute.nextResetAt} />.
          </span>
        )}
      </div>
    </div>
  );
}

function MisPeleones({ brutes, principal }: { brutes: BruteProfile[]; principal: boolean }) {
  // Quien ya juega llega aqui primero: entonces es el titulo de la pagina.
  const Titulo = principal ? 'h1' : 'h2';
  return (
    <section className={principal ? 'mis-peleones' : 'mis-peleones portada-seccion'}>
      <Titulo>Mis peleones</Titulo>
      <div className="lista-peleones">
        {brutes.map((brute) => (
          <TarjetaPeleon key={brute.slug} brute={brute} />
        ))}
      </div>
    </section>
  );
}

/**
 * La cara que saldria con el nombre escrito. El servidor crea el peleon con
 * `createBrute(name.trim())` y rechaza los nombres repetidos sin anadir sufijo,
 * asi que esta es exactamente la que se guardara.
 */
function VistaPrevia({ name, ayuda }: { name: string; ayuda: AyudaNombre }) {
  // Diferido: mientras se teclea rapido no se recalcula a cada letra.
  const diferido = useDeferredValue(name.trim());
  if (!ayuda.valido || diferido.length === 0) return null;
  let brute;
  try {
    brute = createBrute(diferido);
  } catch {
    return null;
  }
  return (
    <div className="nombre-vista" aria-hidden="true">
      <Fighter
        appearance={brute.appearance}
        slug={brute.slug}
        weapon={armaVisible(brute.weapons)}
        height={72}
      />
    </div>
  );
}

function FormularioNombre({
  titulo,
  name,
  setName,
  ayuda,
  create,
  aviso,
}: {
  titulo: string;
  name: string;
  setName: (n: string) => void;
  ayuda: AyudaNombre;
  create: UseMutationResult<Awaited<ReturnType<typeof api.createBrute>>, Error, void>;
  aviso: string | null;
}) {
  return (
    <Tarjeta>
      <h2>{titulo}</h2>
      {aviso !== null && <p className="apagado recluta-texto">{aviso}</p>}
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
        {/* Es un nombre inventado y para siempre: sin autocorrector que lo cambie. */}
        <input
          id="nombre-peleon"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chirlo de la Cava"
          maxLength={NAME_MAX}
          aria-describedby="nombre-ayuda"
          aria-invalid={ayuda.tipo === 'error'}
          autoCapitalize="words"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <Boton type="submit" tipo="principal" disabled={!ayuda.valido || create.isPending}>
          {create.isPending ? 'Creando…' : 'Crear'}
        </Boton>
      </form>
      <div className="nombre-ayuda-fila">
        <VistaPrevia name={name} ayuda={ayuda} />
        {/* Dice por que el boton no se deja pulsar, en vez de dejarlo apagado sin mas. */}
        <p
          id="nombre-ayuda"
          className={ayuda.tipo === 'error' ? 'ayuda error' : 'ayuda apagado'}
          aria-live="polite"
        >
          {ayuda.texto}
        </p>
      </div>
      {create.error && (
        <p className="error" role="alert">
          {create.error instanceof ApiError
            ? create.error.message
            : 'No se ha podido crear. Inténtalo otra vez.'}
        </p>
      )}
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
  const misPeleones = me.data?.brutes ?? [];
  const reclutamiento = recluta(
    masterSlug,
    maestro,
    misPeleones.map((b) => b.slug),
  );
  // Si te recluta alguien, en el escenario esta el: dice mas que dos de muestra.
  const escena = reclutamiento.tipo === 'valido' ? [reclutamiento.maestro] : MUESTRA;
  // Quien ya tiene peleones y no viene por un enlace de otro, viene a jugar.
  const veterano = misPeleones.length > 0 && reclutamiento.tipo === 'ninguno';

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

  const aviso =
    reclutamiento.tipo === 'cargando'
      ? 'Buscando a quien te recluta…'
      : reclutamiento.tipo === 'aviso'
        ? reclutamiento.texto
        : null;
  const formulario = (titulo: string) => (
    <FormularioNombre
      titulo={titulo}
      name={name}
      setName={setName}
      ayuda={ayuda}
      create={create}
      aviso={aviso}
    />
  );

  const enlaces = pendientes.map((enlace) => (
    <EnlaceRecuperacion
      key={enlace.slug}
      enlace={enlace}
      // Con "Buscar pelea" en pantalla, un solo boton principal.
      discreto={creado !== null || veterano}
      onGuardado={() => setPendientes(quitarPendiente(enlace.slug))}
    />
  ));

  // Hasta saber si tiene peleones no se decide que portada toca: si no,
  // quien vuelve veria un instante la de bienvenida.
  if (me.isPending) {
    return (
      <Pagina>
        <p className="apagado">Cargando…</p>
      </Pagina>
    );
  }

  return (
    <Pagina>
      {creado !== null ? (
        <>
          <RecienCreado
            brute={creado}
            otro={() => {
              create.reset();
              setCreado(null);
            }}
          />
          {enlaces}
        </>
      ) : veterano ? (
        <>
          <MisPeleones brutes={misPeleones} principal />
          {enlaces}
          <div className="portada-seccion">{formulario('Otro peleón')}</div>
        </>
      ) : (
        <>
          <section className="portada-cabecera">
            <div className="portada-texto">
              {/* Si te recluta alguien, la cabecera habla de el: es por quien has venido. */}
              {reclutamiento.tipo === 'valido' ? (
                <>
                  <h1>Te recluta {reclutamiento.maestro.name}</h1>
                  <p className="portada-voz">
                    Crea tu peleón y {reclutamiento.maestro.name} se lleva una pelea diaria más. Tú
                    empiezas igual que todos: eso no te quita nada.
                  </p>
                </>
              ) : (
                <>
                  <h1>Pon un nombre y tendrás un peleón.</h1>
                  <p className="portada-voz">Lo demás lo deciden él y la mala suerte.</p>
                </>
              )}
              <p className="apagado portada-vuelta">
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
            <div className="portada-form">{formulario('Nuevo peleón')}</div>
          </section>
          {enlaces}
          {/* Tiene peleones pero viene por el enlace de otro: abajo, por si acaso. */}
          {misPeleones.length > 0 && <MisPeleones brutes={misPeleones} principal={false} />}
        </>
      )}

      <footer className="apagado portada-pie">
        <p>
          Juego inspirado en los combates automáticos por turnos. Todo el contenido es original.
        </p>
        <Link to="/legal">Condiciones y privacidad</Link>
      </footer>
    </Pagina>
  );
}
