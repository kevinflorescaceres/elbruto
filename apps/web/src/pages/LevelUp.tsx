import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { getPet, getSkill, getWeapon, type LevelUpOption } from '@camorra/engine';
import { Confirmar, ESTADISTICAS, Pagina, QUE_HACE, TarjetaBoton, TusCifras } from '../ui.js';
import { armaVisible, Fighter } from '../art/Fighter.js';
import { Escenario } from '../Escenario.js';
import { useBrute } from '../hooks.js';
import type { WeaponCategory } from '../art/parts.js';
import { api } from '../api.js';
import { describeSkill, describeWeapon } from '../skillText.js';

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

/** Las cifras de ahora, para ensenar cuanto cambia cada camino. */
type Cifras = Record<string, number>;

function describeOption(option: LevelUpOption, ahora: Cifras | undefined): Opcion {
  switch (option.type) {
    case 'weapon': {
      const weapon = getWeapon(option.id);
      return {
        title: weapon.name,
        detail: describeWeapon(weapon),
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
      const antes = ahora?.endurance;
      const coste =
        antes === undefined
          ? `te quita ${pet.enduranceCost} de ${aguante}`
          : `${aguante} ${antes} → ${Math.max(0, antes - pet.enduranceCost)}`;
      return {
        title: pet.name,
        detail: `Bicho · ${pet.hp} de vida · ${pet.damage} de daño · ${coste}`,
      };
    }
    case 'stat': {
      const parts = Object.entries(option.gains).map(
        ([stat, amount]) => `+${amount} de ${STAT_NAMES[stat] ?? stat}`,
      );
      // "Reflejos 3 → 6": lo que se gana, contado contra lo que ya se tiene.
      const cambios = Object.entries(option.gains).map(([stat, amount]) => {
        const antes = ahora?.[stat];
        // Lo que hace va al lado: elegir entre Reflejos y Brio sin saberlo era a ciegas.
        const que = QUE_HACE[stat as keyof typeof QUE_HACE]?.corto;
        const cifra =
          antes === undefined
            ? `+${amount} de ${STAT_NAMES[stat] ?? stat}`
            : `${STAT_NAMES[stat] ?? stat} ${antes} → ${antes + amount}`;
        return que === undefined ? cifra : `${cifra} (${que})`;
      });
      return { title: parts.join(' y '), detail: cambios.join(' · ') };
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
  // Tocar una opcion la elige; quedarsela es otro gesto (Confirmar).
  const [elegida, setElegida] = useState<0 | 1 | null>(null);

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

  const b = brute.data;
  const ahora: Cifras | undefined =
    b === undefined
      ? undefined
      : Object.fromEntries(ESTADISTICAS.map(([, campo]) => [campo, b[campo]]));
  const opciones = pending.data.options.map((o) => describeOption(o, ahora));
  const enLaMano =
    (probando === null ? undefined : opciones[probando]?.arma) ??
    (elegida === null ? undefined : opciones[elegida]?.arma) ??
    (b && armaVisible(b.weapons));

  return (
    <Pagina volver={b === undefined ? undefined : { a: `/b/${slug}`, texto: b.name }}>
      <section className="subida">
        <div className="subida-cabecera">
          {b !== undefined && (
            <Escenario
              className="subida-escena"
              alto={140}
              // Ha subido de nivel: la sonrisa de la victoria, no la cara de espera.
              figuras={[
                { appearance: b.appearance, slug: b.slug, weapon: enLaMano, expresion: 'alegria' },
              ]}
            />
          )}
          {/* El cartel cuelga sobre el escenario, como los rotulos del combate. */}
          <h1 className="cartel subida-titulo">Nivel {pending.data.level}</h1>
        </div>
        <div className="subida-opciones">
          <p className="subida-voz">Dos caminos. Uno se queda por el camino.</p>
          {b !== undefined && <TusCifras brute={b} />}
          <div className="rejilla">
            {opciones.map(({ title, detail, arma }, index) => (
              <TarjetaBoton
                key={index}
                disabled={choose.isPending}
                seleccionada={elegida === index}
                onClick={() => setElegida(index as 0 | 1)}
                alPasar={(dentro) =>
                  setProbando((actual) => (dentro ? index : actual === index ? null : actual))
                }
              >
                <span className="opcion">
                  {/* Tu peleon en todas: con el arma nueva en la mano, o como esta. Si
                      solo la tuviera el arma, tiraria de la vista mas que la otra. */}
                  {b !== undefined && (
                    <span className="opcion-figura" aria-hidden>
                      <Fighter
                        appearance={b.appearance}
                        slug={b.slug}
                        weapon={arma ?? armaVisible(b.weapons)}
                        height={76}
                      />
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
          {elegida !== null && (
            <Confirmar disabled={choose.isPending} onClick={() => choose.mutate(elegida)}>
              {choose.isPending ? 'Guardando…' : `Quedarme con ${opciones[elegida]?.title ?? ''}`}
            </Confirmar>
          )}
        </div>
      </section>
    </Pagina>
  );
}
