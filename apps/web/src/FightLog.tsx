/**
 * El combate entero en texto, de una vez. Es la alternativa al lienzo para quien
 * no lo ve, y para quien quiere leerlo: antes era un segundo reproductor con sus
 * propios cuatro botones, sin sincronizar con el lienzo, y habia que darle al
 * play tambien aqui.
 */
import { useMemo } from 'react';
import type { FightReplay } from '@camorra/shared';
import { buildSteps } from './fightLines.js';

export function FightLog({ replay }: { replay: FightReplay }) {
  const steps = useMemo(() => buildSteps(replay), [replay]);
  const a = replay.snapshotA.name;
  const b = replay.snapshotB.name;
  const ganador = replay.winner === 'A' ? a : b;

  return (
    <div className="log">
      <p className="apagado transcripcion-leyenda">
        A la derecha de cada línea, la vida que les queda: {a} · {b}.
      </p>
      <ol className="transcripcion">
        {steps.map((step, i) => (
          <li key={i}>
            <span>{step.text}</span>
            {/* La vida de los dos tras esa linea: el marcador, pero leido. */}
            <span className="transcripcion-vida apagado">
              {step.hpA}·{step.hpB}
            </span>
          </li>
        ))}
      </ol>
      <p className="transcripcion-final">
        <strong>Gana {ganador}.</strong>
      </p>
    </div>
  );
}
