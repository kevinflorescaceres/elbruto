/**
 * Componentes base (ARTE-Y-TOKENS.md §2.4). Existen para que las pantallas
 * dejen de resolver cada hueco con un `style={{}}` suelto: todo lo visual sale
 * de los tokens y de aqui.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

/** Barra superior de madera y contenedor. Envuelve cada pantalla. */
export function Pagina({
  children,
  volver,
}: {
  children: ReactNode;
  volver?: { a: string; texto: string };
}) {
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
      <main>
        {volver !== undefined && (
          <p className="apagado">
            <Link to={volver.a}>← {volver.texto}</Link>
          </p>
        )}
        {children}
      </main>
    </>
  );
}

export function Tarjeta({
  children,
  hundida,
  style,
}: {
  children: ReactNode;
  hundida?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={hundida === true ? 'tarjeta hundida' : 'tarjeta'} style={style}>
      {children}
    </div>
  );
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

/** Un arma, una maña o un bicho. Si no hay nada, lo dice en vez de dejar hueco. */
export function Chips({ nombres, vacio }: { nombres: string[]; vacio: string }) {
  if (nombres.length === 0) return <span className="apagado">{vacio}</span>;
  return (
    <span className="fila" style={{ gap: '0.3rem' }}>
      {nombres.map((n) => (
        <span key={n} className="chip">
          {n}
        </span>
      ))}
    </span>
  );
}

/** Etiqueta encima y cifra grande debajo. */
export function Estadistica({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div className="estadistica">
      <span className="apagado">{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

/** Barra de progreso: experiencia o vida. */
export function Barra({ de, entre, etiqueta }: { de: number; entre: number; etiqueta?: string }) {
  const parte = entre > 0 ? Math.max(0, Math.min(1, de / entre)) : 0;
  return (
    <div>
      {etiqueta !== undefined && (
        <div className="fila" style={{ justifyContent: 'space-between' }}>
          <span className="apagado">{etiqueta}</span>
          <span className="apagado">
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
