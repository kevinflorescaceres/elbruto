import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { Pagina, TarjetaBoton } from '../ui.js';
import { api, ApiError } from '../api.js';

export function ArenaPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      await navigate(`/fight/${result.fightId}`);
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
    <Pagina>
      <p className="apagado">
        <Link to={`/b/${slug}`}>← Volver a la ficha</Link>
      </p>
      <h1>Elige rival</h1>
      <p className="apagado">Gente de tu nivel, más o menos. Elige y ya no hay vuelta atrás.</p>

      {fight.error && (
        <p className="error">
          {fight.error instanceof ApiError ? fight.error.message : 'No se ha podido pelear'}
        </p>
      )}

      {opponents.isPending && <p className="apagado">Buscando...</p>}
      <div className="rejilla">
        {opponents.data?.opponents.map((rival) => (
          <TarjetaBoton
            key={rival.slug}
            disabled={fight.isPending}
            onClick={() => fight.mutate(rival.slug)}
          >
            <div className="ficha-mini">
              <Fighter
                appearance={rival.appearance}
                slug={rival.slug}
                weapon={armaVisible(rival.weapons)}
                height={92}
              />
              <div>
                <strong>{rival.name}</strong>
                <div className="apagado">
                  Nivel {rival.level} · {rival.wins}V {rival.losses}D · {rival.maxHp} de vida
                </div>
                <div className="apagado">
                  {rival.weapons.length} armas · {rival.skills.length} mañas · {rival.pets.length}{' '}
                  bichos
                </div>
              </div>
            </div>
          </TarjetaBoton>
        ))}
      </div>
    </Pagina>
  );
}
