import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../api.js';
import { useMe } from '../hooks.js';

export function Home() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [claimUrl, setClaimUrl] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createBrute(name),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setName('');
      // Se ensena una sola vez: no hay endpoint para volver a pedirlo.
      setClaimUrl(`${window.location.origin}${data.claimUrl}`);
    },
  });

  return (
    <main>
      <h1>Rufianes</h1>
      <p className="apagado">
        Pon un nombre y tendras un peleon. Lo demas lo decide el y la mala suerte.
      </p>

      <div className="tarjeta">
        <h2>Nuevo peleon</h2>
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
            maxLength={20}
            aria-label="Nombre del peleon"
          />
          <button type="submit" disabled={name.trim().length < 3 || create.isPending}>
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
            Es la unica forma de recuperar tu peleon en otro navegador. No se vuelve a ensenar.
          </p>
          <code style={{ wordBreak: 'break-all' }}>{claimUrl}</code>
          <div className="fila" style={{ marginTop: '0.5rem' }}>
            <button onClick={() => void navigator.clipboard.writeText(claimUrl)}>Copiar</button>
            <button onClick={() => setClaimUrl(null)}>Ya lo tengo</button>
          </div>
        </div>
      )}

      <h2>Mis peleones</h2>
      {me.isPending && <p className="apagado">Cargando...</p>}
      {me.data?.brutes.length === 0 && <p className="apagado">Todavia no tienes ninguno.</p>}
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

      <p className="apagado" style={{ marginTop: '2rem' }}>
        <Link to="/">Inicio</Link> · Juego inspirado en los combates automaticos por turnos. Todo el
        contenido es original.
      </p>
    </main>
  );
}
