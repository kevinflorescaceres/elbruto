import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Sin esto, cualquier error de render deja la pagina en blanco y el jugador no
 * sabe si ha fallado el juego o su conexion.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { fallo: Error | null }> {
  override state: { fallo: Error | null } = { fallo: null };

  static getDerivedStateFromError(fallo: Error): { fallo: Error } {
    return { fallo };
  }

  override componentDidCatch(fallo: Error, info: ErrorInfo): void {
    console.error('Camorra se ha caido:', fallo, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.fallo === null) return this.props.children;
    return (
      <main>
        <h1>Se ha liado</h1>
        <p className="apagado">
          Algo ha fallado por nuestra parte. Si vuelve a pasar, cuentanoslo y lo miramos.
        </p>
        <div className="fila">
          <button onClick={() => window.location.reload()}>Recargar</button>
          <a href="/">
            <button>Volver al principio</button>
          </a>
        </div>
        <details style={{ marginTop: '1.5rem' }}>
          <summary className="apagado">Detalle tecnico</summary>
          <pre style={{ overflowX: 'auto', fontSize: '0.8rem' }}>{this.state.fallo.message}</pre>
        </details>
      </main>
    );
  }
}
