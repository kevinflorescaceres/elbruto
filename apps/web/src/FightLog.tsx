/**
 * El combate como log de texto animado (PLAN.md fase 3). La linea de tiempo que
 * se construye aqui es la misma que alimentara al render de PixiJS en la fase 4.
 */
import { useEffect, useMemo, useState } from 'react';
import type { FightReplay } from '@camorra/shared';
import { buildSteps } from './fightLines.js';

function Vida({ nombre, hp, maxHp }: { nombre: string; hp: number; maxHp: number }) {
  return (
    <div style={{ flex: '1 1 12rem' }}>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <strong>{nombre}</strong>
        <span className="apagado">
          {hp} / {maxHp}
        </span>
      </div>
      <div className="barra">
        <div style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }} />
      </div>
    </div>
  );
}

export function FightLog({ replay }: { replay: FightReplay }) {
  const steps = useMemo(() => buildSteps(replay), [replay]);
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing || shown >= steps.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), 700 / speed);
    return () => clearTimeout(timer);
  }, [playing, shown, speed, steps.length]);

  const current = steps[shown - 1];
  const ended = shown >= steps.length;

  return (
    <div>
      <div className="fila" style={{ gap: '1.5rem', marginBottom: '0.75rem' }}>
        <Vida
          nombre={replay.snapshotA.name}
          hp={current?.hpA ?? replay.snapshotA.maxHp}
          maxHp={replay.snapshotA.maxHp}
        />
        <Vida
          nombre={replay.snapshotB.name}
          hp={current?.hpB ?? replay.snapshotB.maxHp}
          maxHp={replay.snapshotB.maxHp}
        />
      </div>

      <div className="fila" style={{ marginBottom: '0.75rem' }}>
        <button onClick={() => setPlaying((p) => !p)} disabled={ended}>
          {playing ? 'Pausa' : 'Seguir'}
        </button>
        <button onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}>x{speed}</button>
        <button onClick={() => setShown(steps.length)} disabled={ended}>
          Ir al final
        </button>
        <button
          onClick={() => {
            setShown(1);
            setPlaying(true);
          }}
        >
          Repetir
        </button>
        <span className="apagado">
          {Math.min(shown, steps.length)} / {steps.length}
        </span>
      </div>

      <div className="log">
        {steps.slice(0, shown).map((step, i) => (
          <p key={i}>{step.text}</p>
        ))}
        {ended && (
          <p>
            <strong>
              Gana {replay.winner === 'A' ? replay.snapshotA.name : replay.snapshotB.name}.
            </strong>
          </p>
        )}
      </div>
    </div>
  );
}
