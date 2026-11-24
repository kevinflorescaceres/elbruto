/**
 * Componentes base (ARTE-Y-TOKENS.md §2.4). Existen para que las pantallas
 * dejen de resolver cada hueco con un `style={{}}` suelto: todo lo visual sale
 * de los tokens y de aqui.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { usePendientes } from './hooks.js';
import { sinGuardar } from './enlacesPendientes.js';

/**
 * El cartel de la pantalla: una franja de madera a todo lo ancho, con el titulo
 * en oro a tamano de cartel. Es el recurso mas fuerte que ya tenia el juego (la
 * barra superior, los rotulos del combate) puesto donde se abre cada pantalla;
 * antes los titulos iban sueltos sobre el papel y todo pesaba lo mismo.
 */
export interface Cabecera {
  titulo: ReactNode;
  /** Una frase debajo, en papel. */
  bajada?: ReactNode;
  /** Lo que va al lado o debajo del titulo: el escenario de la portada, cifras... */
  extra?: ReactNode;
}

/** Barra superior de madera y contenedor. Envuelve cada pantalla. */
export function Pagina({
  children,
  volver,
  cabecera,
  pegada,
}: {
  children: ReactNode;
  volver?: { a: string; texto: string };
  cabecera?: Cabecera;
  /** Sin aire entre el cartel y lo primero: el marcador del combate se le une. */
  pegada?: boolean;
}) {
  const enlaceVolver = volver !== undefined && (
    <p className="volver">
      <Link to={volver.a}>← {volver.texto}</Link>
    </p>
  );
  return (
    <>
      <header className="barra-superior">
        <Link to="/" className="marca">
          Camorra
        </Link>
        <nav className="fila">
          <Link to="/ranking">Ranking</Link>
        </nav>
      </header>
      {cabecera !== undefined && (
        <section className={cabecera.extra === undefined ? 'cabecera' : 'cabecera con-extra'}>
          <div className="cabecera-dentro">
            <div className="cabecera-texto">
              {enlaceVolver}
              <h1>{cabecera.titulo}</h1>
              {cabecera.bajada !== undefined && (
                <p className="cabecera-bajada">{cabecera.bajada}</p>
              )}
            </div>
            {cabecera.extra !== undefined && <div className="cabecera-extra">{cabecera.extra}</div>}
          </div>
        </section>
      )}
      <main className={pegada === true ? 'pegada' : undefined}>
        {cabecera === undefined && enlaceVolver}
        {children}
      </main>
    </>
  );
}

export function Tarjeta({ children, hundida }: { children: ReactNode; hundida?: boolean }) {
  return <div className={hundida === true ? 'tarjeta hundida' : 'tarjeta'}>{children}</div>;
}

interface BotonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tipo?: 'principal' | 'secundario';
  type?: 'button' | 'submit';
}

export function Boton({
  children,
  onClick,
  disabled,
  tipo = 'secundario',
  type = 'button',
}: BotonProps) {
  return (
    <button
      type={type}
      className={tipo === 'principal' ? 'boton principal' : 'boton'}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** "1 victoria · 3 derrotas": la abreviatura "1V 3D" no la entendia nadie. */
export function record(wins: number, losses: number): string {
  const v = wins === 1 ? '1 victoria' : `${wins} victorias`;
  const d = losses === 1 ? '1 derrota' : `${losses} derrotas`;
  return `${v} · ${d}`;
}

/** "1 arma", "0 mañas": la cuenta con su nombre, concordando. */
export function cuenta(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * Ganó o perdió, con su color y su palabra: el color solo no lo distingue quien
 * no ve el rojo del verde.
 */
export function Resultado({ gano }: { gano: boolean }) {
  return (
    <span className={gano ? 'resultado gana' : 'resultado pierde'}>{gano ? 'Ganó' : 'Perdió'}</span>
  );
}

/** Un arma, una maña o un bicho. Si no hay nada, lo dice en vez de dejar hueco. */
export function Chips({ nombres, vacio }: { nombres: string[]; vacio: string }) {
  if (nombres.length === 0) return <span className="apagado">{vacio}</span>;
  return (
    <span className="chips">
      {nombres.map((n) => (
        <span key={n} className="chip">
          {n}
        </span>
      ))}
    </span>
  );
}

/** Las cuatro estadisticas con su nombre visible, en el orden de la ficha. */
export const ESTADISTICAS = [
  ['Aguante', 'endurance'],
  ['Fuerza', 'strength'],
  ['Reflejos', 'agility'],
  ['Brío', 'speed'],
] as const;

/** Etiqueta encima y cifra grande debajo. */
export function Estadistica({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div className="estadistica">
      <span className="apagado">{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

/**
 * Una tarjeta entera que se pulsa: rival de la arena, peleon propio, mejora.
 * Las tres pantallas la tenian como `<button className="tarjeta">` con el
 * mismo estilo en linea para desalinear el texto.
 */
export function TarjetaBoton({
  children,
  disabled,
  onClick,
  alPasar,
  seleccionada,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  /** Elegida pero sin confirmar (arena, subida de nivel). */
  seleccionada?: boolean;
  /** Avisa cuando el puntero o el foco entran (true) y salen (false). */
  alPasar?: (dentro: boolean) => void;
}) {
  return (
    <button
      className="tarjeta tarjeta-boton"
      disabled={disabled}
      aria-pressed={seleccionada}
      onClick={onClick}
      onPointerEnter={() => alPasar?.(true)}
      onPointerLeave={() => alPasar?.(false)}
      onFocus={() => alPasar?.(true)}
      onBlur={() => alPasar?.(false)}
    >
      {children}
    </button>
  );
}

/** Barra de progreso: experiencia o vida. */
export function Barra({ de, entre, etiqueta }: { de: number; entre: number; etiqueta?: string }) {
  const parte = entre > 0 ? Math.max(0, Math.min(1, de / entre)) : 0;
  return (
    <div>
      {etiqueta !== undefined && (
        <div className="barra-cabecera apagado">
          <span>{etiqueta}</span>
          <span className="barra-cifras">
            {de} / {entre}
          </span>
        </div>
      )}
      <div className="barra" role="img" aria-label={`${etiqueta ?? 'Progreso'}: ${de} de ${entre}`}>
        <div style={{ width: `${parte * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * "Buscar pelea", con sus dos candados: sin peleas hoy, apagado; y con el enlace
 * de recuperacion sin guardar, apagado y diciendo por que. Perder el peleon es
 * lo unico que no tiene arreglo, asi que se guarda antes de la primera pelea.
 */
export function BuscarPelea({ slug, quedan }: { slug: string; quedan: number }) {
  const pendientes = usePendientes();
  if (sinGuardar(slug, pendientes)) {
    return (
      <span className="buscar-bloqueado">
        <Boton tipo="principal" disabled>
          Buscar pelea
        </Boton>
        <span className="aviso">Antes, guarda su enlace.</span>
      </span>
    );
  }
  if (quedan <= 0) {
    return (
      <Boton tipo="principal" disabled>
        Buscar pelea
      </Boton>
    );
  }
  return (
    <Link to={`/b/${slug}/arena`} className="boton principal">
      Buscar pelea
    </Link>
  );
}

/**
 * Tus cifras, en una linea, donde se decide algo que depende de ellas: la arena y
 * la subida de nivel. Antes habia que acordarse de la ficha.
 */
export function TusCifras({
  brute,
}: {
  brute: { name: string; maxHp: number } & Record<(typeof ESTADISTICAS)[number][1], number>;
}) {
  return (
    <p className="tus-cifras">
      <strong>{brute.name}</strong>
      <span>Vida {brute.maxHp}</span>
      {ESTADISTICAS.map(([etiqueta, campo]) => (
        <span key={campo}>
          {etiqueta} {brute[campo]}
        </span>
      ))}
    </p>
  );
}

/**
 * Elegir y confirmar son dos gestos: en el movil, tocar una tarjeta al hacer
 * scroll ya lanzaba una pelea sin vuelta atras. Va pegado al pie mientras hay algo
 * elegido.
 */
export function Confirmar({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="confirmar">
      <Boton tipo="principal" onClick={onClick} disabled={disabled}>
        {children}
      </Boton>
    </div>
  );
}
