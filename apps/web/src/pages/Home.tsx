import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { NAME_MAX, NAME_MIN } from '@camorra/shared';
import { api, ApiError } from '../api.js';
import { useMe } from '../hooks.js';

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
    <main>
      <h1>Camorra</h1>

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
      <p className="apagado">
        Pon un nombre y tendrás un peleón. Lo demás lo deciden él y la mala suerte.
      </p>

      <div className="tarjeta">
        <h2>Nuevo peleón</h2>
        <form
          className="fila"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chirlo de la Cava"
            maxLength={NAME_MAX}
            aria-label="Nombre del peleón"
          />
          <button type="submit" disabled={name.trim().length < NAME_MIN || create.isPending}>
            {create.isPending ? 'Creando...' : 'Crear'}
          </button>
        </form>
        {create.error && (
          <p className="error">
            {create.error instanceof ApiError ? create.error.message : 'Algo ha fallado'}
          </p>
        )}
      </div>

      {claimUrl !== null && (
        <div className="tarjeta">
          <h3>Guarda este enlace</h3>
          <p className="apagado">
            Es la única forma de recuperar tu peleón en otro navegador. No se vuelve a enseñar.
          </p>
          <code style={{ wordBreak: 'break-all' }}>{claimUrl}</code>
          <div className="fila" style={{ marginTop: '0.5rem' }}>
            <button onClick={() => void navigator.clipboard.writeText(claimUrl)}>Copiar</button>
            <button onClick={() => setClaimUrl(null)}>Ya lo tengo</button>
          </div>
        </div>
      )}

      <h2>Mis peleones</h2>
      <p className="apagado">
        <Link to="/ranking">Ver quién manda en la calle →</Link>
      </p>
      {me.isPending && <p className="apagado">Cargando...</p>}
      {me.data?.brutes.length === 0 && <p className="apagado">Todavía no tienes ninguno.</p>}
      <div className="rejilla">
        {me.data?.brutes.map((brute) => (
          <button
            key={brute.slug}
            className="tarjeta"
            style={{ textAlign: 'left' }}
            onClick={() => void navigate(`/b/${brute.slug}`)}
          >
            <strong>{brute.name}</strong>
            <div className="apagado">
              Nivel {brute.level} · {brute.wins}V {brute.losses}D
              {brute.pendingLevelUp && ' · mejora pendiente'}
            </div>
          </button>
        ))}
      </div>

      <footer className="apagado" style={{ marginTop: '3rem' }}>
        Juego inspirado en los combates automáticos por turnos. Todo el contenido es original. ·{' '}
        <Link to="/ranking">Ranking</Link> · <Link to="/legal">Condiciones y privacidad</Link>
      </footer>
    </main>
  );
}
