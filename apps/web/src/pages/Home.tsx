import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { createBrute } from '@camorra/engine';
import { NAME_MAX } from '@camorra/shared';
import { api, ApiError } from '../api.js';
import { Boton, Pagina, Tarjeta, TarjetaBoton } from '../ui.js';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { useMe } from '../hooks.js';
import { ayudaNombre } from '../nombre.js';

/*
 * Dos peleones de muestra, sacados del motor igual que cualquier otro: la cara
 * sale del nombre. Elegidos porque los dos empiezan con arma y se distinguen
 * bien. No existen en la base; si alguien crea uno con ese nombre, sera este.
 */
const MUESTRA = ['Rosca la Brava', 'Matías Puñetas'].map(createBrute);

export function Home() {
  // Si se llega por un enlace de invitacion, el maestro viene en la ruta.
  const { slug: masterSlug } = useParams();
  const maestro = useQuery({
    queryKey: ['brute', masterSlug],
    queryFn: () => api.brute(masterSlug ?? ''),
    enabled: masterSlug !== undefined,
  });

  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [claimUrl, setClaimUrl] = useState<string | null>(null);

  const ayuda = ayudaNombre(name);

  const create = useMutation({
    mutationFn: () => api.createBrute(name, masterSlug),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setName('');
      // Se ensena una sola vez: no hay endpoint para volver a pedirlo.
      setClaimUrl(`${window.location.origin}${data.claimUrl}`);
    },
  });

  return (
    <Pagina>
      {/* La marca ya esta en la barra: el h1 dice lo que pasa aqui. */}
      <header className="portada-cabecera">
        <div>
          <h1>Pon un nombre y tendrás un peleón.</h1>
          <p className="apagado">Lo demás lo deciden él y la mala suerte.</p>
          <p className="portada-vuelta">
            Cada día, unas cuantas peleas. Cada nivel, una mejora a elegir entre dos.
          </p>
        </div>
        {/* Decorativa: los nombres son de muestra y no llevan a ninguna parte. */}
        <div className="portada-escena" aria-hidden="true">
          {MUESTRA.map((brute, i) => (
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

      {masterSlug !== undefined && (
        <div className="tarjeta">
          {maestro.data ? (
            <>
              <h2>Te recluta {maestro.data.name}</h2>
              <p className="apagado">
                Crea tu peleón aquí y {maestro.data.name} se lleva una pelea diaria más. Tú empiezas
                igual que todos: eso no te quita nada.
              </p>
            </>
          ) : (
            <p className="apagado">
              {maestro.isPending ? 'Buscando a quien te recluta...' : 'Ese reclutador no existe.'}
            </p>
          )}
        </div>
      )}

      <Tarjeta>
        <h2>Nuevo peleón</h2>
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

      {claimUrl !== null && (
        <Tarjeta hundida>
          <h3>Guarda este enlace</h3>
          <p className="apagado">
            Es la única forma de recuperar tu peleón en otro navegador. No se vuelve a enseñar.
          </p>
          <code style={{ wordBreak: 'break-all' }}>{claimUrl}</code>
          <div className="fila" style={{ marginTop: '0.5rem' }}>
            <Boton onClick={() => void navigator.clipboard.writeText(claimUrl)}>Copiar</Boton>
            <Boton onClick={() => setClaimUrl(null)}>Ya lo tengo</Boton>
          </div>
        </Tarjeta>
      )}

      {me.isPending && <p className="apagado">Cargando...</p>}
      {/* Quien llega por primera vez no tiene peleones: no se le ensena una lista vacia. */}
      {me.data !== undefined && me.data.brutes.length > 0 && (
        <section className="portada-seccion">
          <h2>Mis peleones</h2>
          <div className="rejilla">
            {me.data?.brutes.map((brute) => (
              <TarjetaBoton key={brute.slug} onClick={() => void navigate(`/b/${brute.slug}`)}>
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
              </TarjetaBoton>
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
