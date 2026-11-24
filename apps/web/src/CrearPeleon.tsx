/**
 * Crear un peleon: el campo del nombre con la cara que saldria, y lo que hay que
 * hacer al crearlo. Lo usan la portada y el combate (quien llega por un combate
 * compartido y aun no tiene peleon). Antes vivia dentro de la portada.
 */
import { useDeferredValue, useState } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { createBrute } from '@camorra/engine';
import { NAME_MAX, type BruteProfile } from '@camorra/shared';
import { api, ApiError } from './api.js';
import { Boton, Tarjeta } from './ui.js';
import { armaVisible, Fighter } from './art/Fighter.js';
import { ayudaNombre, type AyudaNombre } from './nombre.js';
import { anadirPendiente, type EnlacePendiente } from './enlacesPendientes.js';

/**
 * El nombre, su ayuda y la creacion. Al crear, el enlace de recuperacion se
 * guarda como pendiente: se ensena una sola vez y no hay endpoint para volver a
 * pedirlo, asi que no puede depender de que la pantalla siga montada.
 */
export function useCrearPeleon(
  masterSlug: string | undefined,
  alCrear: (brute: BruteProfile, pendientes: EnlacePendiente[]) => void,
) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const ayuda = ayudaNombre(name);
  const create = useMutation({
    mutationFn: () => api.createBrute(name, masterSlug),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setName('');
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
  return { name, setName, ayuda, create };
}

/**
 * La cara que saldria con el nombre escrito. El servidor crea el peleon con
 * `createBrute(name.trim())` y rechaza los nombres repetidos sin anadir sufijo,
 * asi que esta es exactamente la que se guardara.
 */
export function VistaPrevia({ name, ayuda }: { name: string; ayuda: AyudaNombre }) {
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

export function FormularioNombre({
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
 * Crear sin salir de la pagina: para quien llega por un combate o una ficha
 * compartidos y aun no tiene peleon, que es casi todo el que llega (PRODUCT.md).
 * Antes solo habia un enlace a la portada, que le hacia empezar de cero. Al
 * crear va a la portada con el recien creado: ahi esta el enlace de recuperacion,
 * que se ensena una sola vez.
 */
export function CrearAqui({ titulo, aviso }: { titulo: string; aviso: string }) {
  const navigate = useNavigate();
  const { name, setName, ayuda, create } = useCrearPeleon(undefined, (brute) => {
    void navigate('/', { state: { creado: brute } });
  });
  return (
    <FormularioNombre
      titulo={titulo}
      name={name}
      setName={setName}
      ayuda={ayuda}
      create={create}
      aviso={aviso}
    />
  );
}
