import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { getPet, getSkill, getWeapon, type LevelUpOption } from '@camorra/engine';
import { ESTADISTICAS, Pagina, TarjetaBoton } from '../ui.js';
import { api } from '../api.js';
import { describeSkill } from '../skillText.js';

// Los mismos nombres que la ficha: antes era una copia aparte y podian divergir.
const STAT_NAMES: Record<string, string> = Object.fromEntries(
  ESTADISTICAS.map(([etiqueta, campo]) => [campo, etiqueta]),
);

function describeOption(option: LevelUpOption): { title: string; detail: string } {
  switch (option.type) {
    case 'weapon': {
      const weapon = getWeapon(option.id);
      return {
        title: weapon.name,
        detail: `Arma ${weapon.category} · ${weapon.damage} de daño · intervalo ${weapon.interval}`,
      };
    }
    case 'skill': {
      const skill = getSkill(option.id);
      return {
        title: skill.name,
        detail: `Maña · ${describeSkill(skill)}`,
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
      <Pagina>
        <h1>Nada que elegir</h1>
        <Link to={`/b/${slug}`}>Volver a la ficha</Link>
      </Pagina>
    );
  if (pending.isPending)
    return (
      <Pagina>
        <p className="apagado">Cargando...</p>
      </Pagina>
    );

  return (
    <Pagina>
      <h1>Nivel {pending.data.level}</h1>
      <p className="apagado">Dos caminos. Uno se queda por el camino.</p>

      <div className="rejilla">
        {pending.data.options.map((option, index) => {
          const { title, detail } = describeOption(option);
          return (
            <TarjetaBoton
              key={index}
              disabled={choose.isPending}
              onClick={() => choose.mutate(index as 0 | 1)}
            >
              <strong>{title}</strong>
              <div className="apagado">{detail}</div>
            </TarjetaBoton>
          );
        })}
      </div>
    </Pagina>
  );
}
