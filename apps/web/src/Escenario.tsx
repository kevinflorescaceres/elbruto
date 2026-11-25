/**
 * El escenario del combate en pequeno: fondo hondo, trazo de tinta y una franja
 * de suelo donde se plantan los peleones, cada uno con su nombre en un cartel.
 * Lo usan la portada, la subida de nivel y las paginas de "aqui no hay nadie":
 * antes solo existia en la portada, con su propio marcado.
 */
import type { ReactNode } from 'react';
import { createBrute, type Appearance } from '@camorra/engine';
import { Fighter } from './art/Fighter.js';
import type { Expresion, WeaponCategory } from './art/parts.js';

export interface Figura {
  appearance: Appearance;
  slug: string;
  weapon?: { category: WeaponCategory; reach: number };
  /** Sin nombre no hay cartel. */
  nombre?: string;
  expresion?: Expresion;
}

export function Escenario({
  figuras,
  alto = 150,
  className,
}: {
  figuras: Figura[];
  alto?: number;
  className?: string;
}) {
  return (
    // Decorativo: quien sale ya esta dicho en el texto de la pagina.
    <div className={className === undefined ? 'escenario' : `escenario ${className}`} aria-hidden>
      {figuras.map((f, i) => (
        // El segundo mira hacia el primero. Solo la figura: el cartel se lee igual.
        <figure key={f.slug} className={i === 1 ? 'rival' : undefined}>
          <div className="escenario-figura">
            <Fighter
              appearance={f.appearance}
              slug={f.slug}
              weapon={f.weapon}
              height={alto}
              expresion={f.expresion}
            />
          </div>
          {f.nombre !== undefined && <figcaption className="cartel">{f.nombre}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/*
 * Para las paginas donde no hay nadie: en el escenario esta Nadie, un peleon
 * sacado del motor como cualquier otro (la cara sale del nombre). La pagina dice
 * que no hay nadie, y ahi lo tienes.
 */
const NADIE = createBrute('Nadie');

export function NadieAqui({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="nadie">
      <Escenario
        className="nadie-escena"
        alto={110}
        figuras={[{ appearance: NADIE.appearance, slug: NADIE.slug, nombre: NADIE.name }]}
      />
      <div>
        <h1>{titulo}</h1>
        {children}
      </div>
    </section>
  );
}
