import { useEffect, useState } from 'react';

/** Lo que falta para un instante, en palabras. */
function faltan(hasta: number, ahora: number): string {
  const segundos = Math.max(0, Math.floor((hasta - ahora) / 1000));
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}

/**
 * Cuenta atrás hasta que vuelven las peleas. Da algo concreto a lo que volver
 * en vez de un "ya no te quedan" sin más.
 */
export function Cuenta({ hasta }: { hasta: string }) {
  const objetivo = new Date(hasta).getTime();
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    // Un tick por segundo basta: lo que se enseña son minutos salvo al final.
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (Number.isNaN(objetivo)) return null;
  if (objetivo <= ahora) return <>ya mismo</>;
  return <>{faltan(objetivo, ahora)}</>;
}
