import { useEffect } from 'react';
import { Pagina } from '../ui.js';
import { ReportarProblema } from '../ReportarProblema.js';
import { ETIQUETA, NOVEDADES, formatearFecha, marcarVista } from '../novedades.js';

/** Lo que cambio, de lo mas nuevo a lo mas viejo. Verla apaga el punto de la barra. */
export function NovedadesPage() {
  useEffect(() => {
    marcarVista();
  }, []);

  return (
    <Pagina volver={{ a: '/', texto: 'Volver' }} cabecera={{ titulo: 'Novedades' }}>
      {NOVEDADES.map((n) => (
        <section key={n.fecha} className="novedad">
          <h2>{formatearFecha(n.fecha)}</h2>
          <ul className="novedad-puntos">
            {n.puntos.map((p, i) => (
              <li key={i}>
                <span className={`novedad-tipo novedad-${p.tipo}`}>{ETIQUETA[p.tipo]}</span>
                <span>{p.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="novedad-reportar">
        ¿Algo no te convence? Cuéntanoslo. <ReportarProblema />
      </p>
    </Pagina>
  );
}
