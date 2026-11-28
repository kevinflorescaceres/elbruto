/**
 * Crear un peleon: el campo del nombre con la cara que saldria, y lo que hay que
 * hacer al crearlo. Lo usan la portada y el combate (quien llega por un combate
 * compartido y aun no tiene peleon). Antes vivia dentro de la portada.
 */
import { useDeferredValue, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { createBrute, type Gender } from '@camorra/engine';
import { NAME_MAX, type BruteProfile } from '@camorra/shared';
import { api, ApiError } from './api.js';
import { Boton, Tarjeta } from './ui.js';
import { armaVisible, Fighter } from './art/Fighter.js';
import { ayudaNombre, type AyudaNombre } from './nombre.js';
import { segun } from './genero.js';
import { anadirPendiente, type EnlacePendiente } from './enlacesPendientes.js';

/**
 * El nombre, el sexo, su ayuda y la creacion. El sexo empieza sin elegir: nada
 * decide por el jugador. Al crear, el enlace de recuperacion se
 * guarda como pendiente: se ensena una sola vez y no hay endpoint para volver a
 * pedirlo, asi que no puede depender de que la pantalla siga montada.
 */
export function useCrearPeleon(
  masterSlug: string | undefined,
  alCrear: (brute: BruteProfile, pendientes: EnlacePendiente[]) => void,
) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const ayuda = ayudaNombre(name);
  const create = useMutation({
    mutationFn: () => {
      // El boton no se deja pulsar sin sexo; esto es solo por si llega un Intro.
      if (gender === null) throw new Error('Falta elegir si es hombre o mujer');
      return api.createBrute(name, gender, masterSlug);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setName('');
      setGender(null);
      alCrear(
        data.brute,
        anadirPendiente({
          slug: data.brute.slug,
          nombre: data.brute.name,
          url: `${window.location.origin}${data.claimUrl}`,
        }),
      );
    },
  });
  return { name, setName, gender, setGender, ayuda, create };
}

/**
 * La cara que saldria con el nombre escrito. El servidor crea el peleon con
 * `createBrute(name.trim(), gender)` y rechaza los nombres repetidos sin anadir
 * sufijo, asi que esta es exactamente la que se guardara. Sin sexo elegido
 * ensena los dos, mas pequenos: ayuda a elegir y deja ver que el resto de la
 * cara es la misma.
 */
export function VistaPrevia({
  name,
  ayuda,
  gender,
}: {
  name: string;
  ayuda: AyudaNombre;
  gender: Gender | null;
}) {
  // Diferido: mientras se teclea rapido no se recalcula a cada letra.
  const diferido = useDeferredValue(name.trim());
  if (!ayuda.valido || diferido.length === 0) return null;
  const sexos: Gender[] = gender === null ? ['male', 'female'] : [gender];
  let brutes;
  try {
    brutes = sexos.map((g) => createBrute(diferido, g));
  } catch {
    return null;
  }
  return (
    <div className="nombre-vista" aria-hidden="true">
      {brutes.map((brute, i) => (
        <Fighter
          key={sexos[i]}
          appearance={brute.appearance}
          slug={brute.slug}
          weapon={armaVisible(brute.weapons)}
          height={72}
        />
      ))}
    </div>
  );
}

const OPCIONES_SEXO: { valor: Gender; texto: string }[] = [
  { valor: 'male', texto: 'Hombre' },
  { valor: 'female', texto: 'Mujer' },
];

/**
 * Hombre o mujer, como un grupo de radios accesible: una sola parada de
 * tabulador, y las flechas mueven la seleccion (patron radiogroup de WAI-ARIA).
 * Sin nada marcado, la parada es la primera opcion.
 */
function ElegirSexo({
  gender,
  setGender,
}: {
  gender: Gender | null;
  setGender: (g: Gender) => void;
}) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const actual = OPCIONES_SEXO.findIndex((o) => o.valor === gender);

  const alPulsarTecla = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const paso =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (paso === 0) return;
    e.preventDefault();
    const siguiente = (i + paso + OPCIONES_SEXO.length) % OPCIONES_SEXO.length;
    const opcion = OPCIONES_SEXO[siguiente];
    if (opcion === undefined) return;
    setGender(opcion.valor);
    botones.current[siguiente]?.focus();
  };

  return (
    <div className="sexo" role="radiogroup" aria-label="Sexo">
      {OPCIONES_SEXO.map((opcion, i) => {
        const marcada = opcion.valor === gender;
        return (
          <button
            key={opcion.valor}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={marcada}
            tabIndex={marcada || (actual === -1 && i === 0) ? 0 : -1}
            className="boton sexo-opcion"
            onClick={() => setGender(opcion.valor)}
            onKeyDown={(e) => alPulsarTecla(e, i)}
          >
            {/* La marca dice cual esta elegida sin depender del color. */}
            <span className="sexo-marca" aria-hidden="true">
              ✓
            </span>
            {opcion.texto}
          </button>
        );
      })}
    </div>
  );
}

export function FormularioNombre({
  titulo,
  name,
  setName,
  gender,
  setGender,
  ayuda,
  create,
  aviso,
}: {
  titulo: string;
  name: string;
  setName: (n: string) => void;
  gender: Gender | null;
  setGender: (g: Gender) => void;
  ayuda: AyudaNombre;
  create: UseMutationResult<Awaited<ReturnType<typeof api.createBrute>>, Error, void>;
  aviso: string | null;
}) {
  // Con el nombre bien, lo unico que falta es el sexo: la ayuda lo dice.
  const faltaSexo = ayuda.valido && gender === null;
  const textoAyuda = faltaSexo ? 'Elige si es hombre o mujer.' : ayuda.texto;
  return (
    <Tarjeta>
      <h2>{titulo}</h2>
      {aviso !== null && <p className="apagado recluta-texto">{aviso}</p>}
      <label htmlFor="nombre-peleon" className="etiqueta">
        {/* Generico hasta que se elige: entonces ya es un peleon concreto. */}
        {segun(gender ?? undefined, 'Nombre del peleón', 'Nombre de la peleona')}
      </label>
      <form
        className="campo-nombre"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ayuda.valido || gender === null || create.isPending) return;
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
        <ElegirSexo gender={gender} setGender={setGender} />
        <Boton
          type="submit"
          tipo="principal"
          disabled={!ayuda.valido || gender === null || create.isPending}
        >
          {create.isPending ? 'Creando…' : 'Crear'}
        </Boton>
      </form>
      <div className="nombre-ayuda-fila">
        <VistaPrevia name={name} ayuda={ayuda} gender={gender} />
        {/* Dice por que el boton no se deja pulsar, en vez de dejarlo apagado sin mas. */}
        <p
          id="nombre-ayuda"
          className={ayuda.tipo === 'error' ? 'ayuda error' : 'ayuda apagado'}
          aria-live="polite"
        >
          {textoAyuda}
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
 * Crear sin salir de la pagina: para quien llega por un combate o una ficha
 * compartidos y aun no tiene peleon, que es casi todo el que llega (PRODUCT.md).
 * Antes solo habia un enlace a la portada, que le hacia empezar de cero. Al
 * crear va a la portada con el recien creado: ahi esta el enlace de recuperacion,
 * que se ensena una sola vez.
 */
export function CrearAqui({ titulo, aviso }: { titulo: string; aviso: string }) {
  const navigate = useNavigate();
  const { name, setName, gender, setGender, ayuda, create } = useCrearPeleon(undefined, (brute) => {
    void navigate('/', { state: { creado: brute } });
  });
  return (
    <FormularioNombre
      titulo={titulo}
      name={name}
      setName={setName}
      gender={gender}
      setGender={setGender}
      ayuda={ayuda}
      create={create}
      aviso={aviso}
    />
  );
}
