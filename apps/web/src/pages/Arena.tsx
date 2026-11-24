import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { Confirmar, cuenta, Pagina, record, TarjetaBoton, TusCifras } from '../ui.js';
import { useBrute } from '../hooks.js';
import { api, ApiError } from '../api.js';

export function ArenaPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const yo = useBrute(slug);
  // Tocar una tarjeta la elige; pelear es otro gesto (Confirmar).
  const [elegido, setElegido] = useState<string | null>(null);
  const opponents = useQuery({
    queryKey: ['opponents', slug],
    queryFn: () => api.opponents(slug),
    // Cada visita a la arena debe traer una tanda nueva.
    staleTime: 0,
    gcTime: 0,
  });

  const fight = useMutation({
    mutationFn: (opponentSlug: string) => api.startFight(slug, opponentSlug),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['brute', slug] });
      await queryClient.invalidateQueries({ queryKey: ['fights', slug] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      // El resultado viaja con la navegacion: la repeticion no trae la experiencia.
      await navigate(`/fight/${result.fightId}`, {
        state: {
          resultado: {
            slug,
            won: result.won,
            xpGained: result.xpGained,
            leveledUp: result.leveledUp,
          },
        },
      });
    },
  });

  if (opponents.error)
    return (
      <Pagina>
        <h1>Aquí no pintas nada</h1>
        <p className="apagado">Solo el dueño de un peleón puede buscarle pelea.</p>
        <Link to={`/b/${slug}`}>Volver a la ficha</Link>
      </Pagina>
    );

  return (
    <Pagina
      volver={{ a: `/b/${slug}`, texto: 'Volver a la ficha' }}
      cabecera={{
        titulo: 'Elige rival',
        bajada: 'Gente de tu nivel, más o menos. Elige y ya no hay vuelta atrás.',
      }}
    >
      {fight.error && (
        <p className="error">
          {fight.error instanceof ApiError ? fight.error.message : 'No se ha podido pelear'}
        </p>
      )}

      {opponents.isPending && <p className="apagado">Buscando…</p>}
      {yo.data !== undefined && <TusCifras brute={yo.data} />}
      <div className="rejilla">
        {opponents.data?.opponents.map((rival) => (
          <TarjetaBoton
            key={rival.slug}
            disabled={fight.isPending}
            seleccionada={elegido === rival.slug}
            onClick={() => setElegido(rival.slug)}
          >
            <div className="ficha-mini">
              <Fighter
                appearance={rival.appearance}
                slug={rival.slug}
                weapon={armaVisible(rival.weapons)}
                height={92}
              />
              <div className="rival-datos">
                <strong className="rival-nombre">{rival.name}</strong>
                <span className="apagado">
                  Nivel {rival.level} · {rival.maxHp} de vida
                </span>
                <span className="apagado">{record(rival.wins, rival.losses)}</span>
                <span className="apagado">
                  {cuenta(rival.weapons.length, 'arma', 'armas')} ·{' '}
                  {cuenta(rival.skills.length, 'maña', 'mañas')} ·{' '}
                  {cuenta(rival.pets.length, 'bicho', 'bichos')}
                </span>
              </div>
            </div>
          </TarjetaBoton>
        ))}
      </div>
      {elegido !== null && (
        <Confirmar disabled={fight.isPending} onClick={() => fight.mutate(elegido)}>
          {fight.isPending
            ? 'Peleando…'
            : `Pelear contra ${opponents.data?.opponents.find((r) => r.slug === elegido)?.name ?? ''}`}
        </Confirmar>
      )}
    </Pagina>
  );
}
