/**
 * El marco del combate: marcador, hueco del lienzo, pie y controles. Sin Pixi a
 * proposito: lo pinta tambien la pagina mientras baja el reproductor, y asi la
 * espera ocupa lo mismo que el combate. Antes era una linea de texto, y al
 * llegar el reproductor todo lo de debajo daba un salto.
 */
import type { ReactNode, Ref } from 'react';

/**
 * Marcador en HTML, no dentro del lienzo. En pantalla estrecha el lienzo se
 * recorta por los lados y se llevaba por delante las chapas de los nombres;
 * aqui el marcador mide siempre lo que mide la ventana, y el nombre sale con
 * la tipografia de verdad en vez de con texto rasterizado por Pixi.
 */
function Vida({
  nombre,
  lado,
  barra,
}: {
  nombre: string;
  lado: 'izq' | 'der';
  barra?: Ref<HTMLDivElement>;
}) {
  return (
    <div className={`vida vida-${lado}`}>
      <div className="vida-cubeta">
        <div className="vida-relleno" ref={barra} />
      </div>
      <span className="vida-nombre">{nombre}</span>
    </div>
  );
}

export interface Controles {
  reproduciendo: boolean;
  velocidad: number;
  pausa: () => void;
  acelerar: () => void;
  alFinal: () => void;
  repetir: () => void;
}

export function EscenaCombate({
  nombres,
  pie,
  controles,
  barras,
  lienzo,
  aviso,
  terminado = false,
}: {
  nombres: [string, string];
  pie: string;
  /** Sin controles, los botones salen apagados: la escena aun no esta. */
  controles?: Controles;
  barras?: [Ref<HTMLDivElement>, Ref<HTMLDivElement>];
  lienzo?: Ref<HTMLDivElement>;
  aviso?: ReactNode;
  /** Acabado: los cuatro controles sobran, queda volver a verlo. */
  terminado?: boolean;
}) {
  const c = controles;
  const apagado = c === undefined;
  return (
    <div>
      <div className="marcador">
        <Vida nombre={nombres[0]} lado="izq" barra={barras?.[0]} />
        <Vida nombre={nombres[1]} lado="der" barra={barras?.[1]} />
      </div>

      <div ref={lienzo} className="lienzo-combate" />

      {aviso}

      <p className="apagado combate-pie">{pie}</p>

      {terminado && c !== undefined ? (
        <div className="fila">
          <button onClick={c.repetir}>Repetir</button>
        </div>
      ) : (
        <div className="fila">
          <button disabled={apagado} onClick={c?.pausa}>
            {c === undefined || c.reproduciendo ? 'Pausa' : 'Seguir'}
          </button>
          {/* "×2" se lee "por dos": dicho asi, el lector de pantalla no deletrea la equis. */}
          <button
            disabled={apagado}
            onClick={c?.acelerar}
            aria-label={`Velocidad por ${c?.velocidad ?? 1}`}
          >
            ×{c?.velocidad ?? 1}
          </button>
          <button disabled={apagado} onClick={c?.alFinal}>
            Ir al final
          </button>
          <button disabled={apagado} onClick={c?.repetir}>
            Repetir
          </button>
        </div>
      )}
    </div>
  );
}
