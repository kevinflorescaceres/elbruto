import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { getPet, getSkill, getWeapon, type LevelUpOption } from '@camorra/engine';
import { ESTADISTICAS, Pagina, TarjetaBoton } from '../ui.js';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { Escenario } from '../Escenario.js';
import { useBrute } from '../hooks.js';
import type { WeaponCategory } from '../art/parts.js';
import { api } from '../api.js';
import { describeSkill } from '../skillText.js';

// Los mismos nombres que la ficha: antes era una copia aparte y podian divergir.
const STAT_NAMES: Record<string, string> = Object.fromEntries(
  ESTADISTICAS.map(([etiqueta, campo]) => [campo, etiqueta]),
);

interface Opcion {
  title: string;
  detail: string;
  /** Si es un arma, lo que hace falta para dibujarla en la mano. */
  arma?: { category: WeaponCategory; reach: number };
}

function describeOption(option: LevelUpOption): Opcion {
  switch (option.type) {
    case 'weapon': {
      const weapon = getWeapon(option.id);
      return {
        title: weapon.name,
        detail: `Arma ${weapon.category} · ${weapon.damage} de daño · intervalo ${weapon.interval}`,
        arma: { category: weapon.category, reach: weapon.reach },
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
      // Lo que cuesta es lo que decide: sin esto se elegia a ciegas (COMBATE.md §4.8).
      const aguante = STAT_NAMES.endurance ?? 'Aguante';
      return {
        title: pet.name,
        detail: `Bicho · ${pet.hp} de vida · ${pet.damage} de daño · te quita ${pet.enduranceCost} de ${aguante}`,
      };
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
  const brute = useBrute(slug);
  // La opcion bajo el puntero o el foco: si es un arma, el peleon se la prueba.
  const [probando, setProbando] = useState<number | null>(null);

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
        <p className="apagado">Cargando…</p>
      </Pagina>
    );

  const opciones = pending.data.options.map(describeOption);
  const b = brute.data;
  const enLaMano =
    (probando === null ? undefined : opciones[probando]?.arma) ?? (b && armaVisible(b.weapons));

  return (
    <Pagina volver={b === undefined ? undefined : { a: `/b/${slug}`, texto: b.name }}>
      <section className="subida">
        <div className="subida-cabecera">
          {b !== undefined && (
            <Escenario
              className="subida-escena"
              alto={140}
              figuras={[{ appearance: b.appearance, slug: b.slug, weapon: enLaMano }]}
            />
          )}
          {/* El cartel cuelga sobre el escenario, como los rotulos del combate. */}
          <h1 className="cartel subida-titulo">Nivel {pending.data.level}</h1>
        </div>
        <div className="subida-opciones">
          <p className="subida-voz">Dos caminos. Uno se queda por el camino.</p>
          <div className="rejilla">
            {opciones.map(({ title, detail, arma }, index) => (
              <TarjetaBoton
                key={index}
                disabled={choose.isPending}
                onClick={() => choose.mutate(index as 0 | 1)}
                alPasar={(dentro) =>
                  setProbando((actual) => (dentro ? index : actual === index ? null : actual))
                }
              >
                <span className="opcion">
                  {/* Un arma se ensena ya en la mano de tu peleon: en el movil no hay
                      puntero que pasar por encima, y tocar la tarjeta ya la elige. */}
                  {arma !== undefined && b !== undefined && (
                    <span className="opcion-figura" aria-hidden>
                      <Fighter appearance={b.appearance} slug={b.slug} weapon={arma} height={76} />
                    </span>
                  )}
                  <span className="opcion-texto">
                    <strong className="opcion-titulo">{title}</strong>
                    <span className="apagado">{detail}</span>
                  </span>
                </span>
              </TarjetaBoton>
            ))}
          </div>
        </div>
      </section>
    </Pagina>
  );
}
