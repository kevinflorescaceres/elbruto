import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { getPet, getSkill, getWeapon, type LevelUpOption } from '@rufianes/engine';
import { api } from '../api.js';

const STAT_NAMES: Record<string, string> = {
  endurance: 'Aguante',
  strength: 'Fuerza',
  agility: 'Maña',
  speed: 'Brío',
};

function describeOption(option: LevelUpOption): { title: string; detail: string } {
  switch (option.type) {
    case 'weapon': {
      const weapon = getWeapon(option.id);
      return {
        title: weapon.name,
        detail: `Arma ${weapon.category} · ${weapon.damage} de daño · ${weapon.accuracy}% de acierto`,
      };
    }
    case 'skill': {
      const skill = getSkill(option.id);
      return {
        title: skill.name,
        detail: skill.type === 'activa' ? 'Maña de un solo uso por pelea' : 'Maña permanente',
      };
    }
    case 'pet': {
      const pet = getPet(option.id);
      return { title: pet.name, detail: `Bicho · ${pet.hp} de vida · ${pet.damage} de daño` };
    }
    case 'stat': {
      const parts = Object.entries(option.gains).map(
        ([stat, amount]) => `+${amount} de ${STAT_NAMES[stat] ?? stat}`,
      );
      return { title: parts.join(' y '), detail: 'Mejora de aptitudes' };
    }
  }
}

export function LevelUpPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pending = useQuery({ queryKey: ['level-up', slug], queryFn: () => api.levelUp(slug) });

  const choose = useMutation({
    mutationFn: (index: 0 | 1) => api.chooseLevelUp(slug, index),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['brute', slug] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.removeQueries({ queryKey: ['level-up', slug] });
      await navigate(`/b/${slug}`);
    },
  });

  if (pending.error)
    return (
      <main>
        <h1>Nada que elegir</h1>
        <Link to={`/b/${slug}`}>Volver a la ficha</Link>
      </main>
    );
  if (pending.isPending) return <main className="apagado">Cargando...</main>;

  return (
    <main>
      <h1>Nivel {pending.data.level}</h1>
      <p className="apagado">Dos caminos. Uno se queda por el camino.</p>

      <div className="rejilla">
        {pending.data.options.map((option, index) => {
          const { title, detail } = describeOption(option);
          return (
            <button
              key={index}
              className="tarjeta"
              style={{ textAlign: 'left' }}
              disabled={choose.isPending}
              onClick={() => choose.mutate(index as 0 | 1)}
            >
              <strong>{title}</strong>
              <div className="apagado">{detail}</div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
