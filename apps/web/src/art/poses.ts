/**
 * Animaciones del rig, como tablas de keyframes (PLAN.md fase 5). Puro: datos,
 * ni Pixi ni GSAP. El renderer interpola entre frames y estira la animacion a
 * lo que dure el evento.
 *
 * Rotaciones en radianes. Una parte cuelga hacia abajo en reposo (rot 0), asi
 * que girar a negativo la lleva hacia delante y a positivo hacia atras.
 */
import type { PartName } from './parts.js';

export interface Pose {
  rot?: number;
  x?: number;
  y?: number;
}

export interface Frame {
  /** Momento dentro de la animacion, de 0 a 1. */
  t: number;
  parts: Partial<Record<PartName, Pose>>;
}

export interface Animation {
  frames: Frame[];
  loop?: boolean;
}

export type AnimName =
  | 'idle'
  | 'walk'
  | 'attackRapida'
  | 'attackPesada'
  | 'attackLarga'
  | 'attackArrojadiza'
  | 'hit'
  | 'evade'
  | 'block'
  | 'throw'
  | 'death'
  | 'victory';

/** Reposo: todo a cero. Sirve de base a la que volver. */
export const REST: Frame = {
  t: 0,
  parts: {
    hips: { rot: 0, x: 0, y: 0 },
    torso: { rot: 0, x: 0, y: 0 },
    head: { rot: 0 },
    armBack: { rot: 0 },
    forearmBack: { rot: 0 },
    armFront: { rot: 0 },
    forearmFront: { rot: 0 },
    legBack: { rot: 0 },
    legFront: { rot: 0 },
  },
};

export const ANIMATIONS: Record<AnimName, Animation> = {
  idle: {
    loop: true,
    frames: [
      { t: 0, parts: { torso: { rot: 0 }, head: { rot: 0 }, hips: { y: 0 } } },
      { t: 0.5, parts: { torso: { rot: 0.035 }, head: { rot: -0.03 }, hips: { y: 1.5 } } },
      { t: 1, parts: { torso: { rot: 0 }, head: { rot: 0 }, hips: { y: 0 } } },
    ],
  },

  walk: {
    loop: true,
    frames: [
      {
        t: 0,
        parts: {
          legBack: { rot: 0.45 },
          legFront: { rot: -0.45 },
          armBack: { rot: -0.35 },
          armFront: { rot: 0.35 },
          hips: { y: 0 },
        },
      },
      { t: 0.25, parts: { hips: { y: -3 } } },
      {
        t: 0.5,
        parts: {
          legBack: { rot: -0.45 },
          legFront: { rot: 0.45 },
          armBack: { rot: 0.35 },
          armFront: { rot: -0.35 },
          hips: { y: 0 },
        },
      },
      { t: 0.75, parts: { hips: { y: -3 } } },
      {
        t: 1,
        parts: {
          legBack: { rot: 0.45 },
          legFront: { rot: -0.45 },
          armBack: { rot: -0.35 },
          armFront: { rot: 0.35 },
          hips: { y: 0 },
        },
      },
    ],
  },

  // Rapida: poco recorrido, mucha punta. Es una punalada, no un mandoble.
  attackRapida: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, forearmFront: { rot: 0 }, torso: { rot: 0 } } },
      {
        t: 0.3,
        parts: { armFront: { rot: 0.6 }, forearmFront: { rot: 0.7 }, torso: { rot: 0.14 } },
      },
      {
        t: 0.5,
        parts: {
          armFront: { rot: -1.7 },
          forearmFront: { rot: -0.2 },
          torso: { rot: -0.2 },
          hips: { x: 7 },
        },
      },
      {
        t: 1,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  // Pesada: se carga por encima de la cabeza y cae con todo el cuerpo.
  attackPesada: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, forearmFront: { rot: 0 }, torso: { rot: 0 } } },
      {
        t: 0.4,
        parts: {
          armFront: { rot: 1.9 },
          forearmFront: { rot: 1 },
          torso: { rot: 0.3 },
          head: { rot: 0.15 },
          hips: { x: -5 },
        },
      },
      {
        t: 0.62,
        parts: {
          armFront: { rot: -1.5 },
          forearmFront: { rot: -0.3 },
          torso: { rot: -0.35 },
          head: { rot: -0.15 },
          hips: { x: 9 },
        },
      },
      {
        t: 1,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          head: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  // Larga: estocada recta, el cuerpo entero va detras del arma.
  attackLarga: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, forearmFront: { rot: 0 }, hips: { x: 0 } } },
      {
        t: 0.3,
        parts: { armFront: { rot: -0.9 }, forearmFront: { rot: 0.5 }, hips: { x: -4 } },
      },
      {
        t: 0.55,
        parts: {
          armFront: { rot: -1.55 },
          forearmFront: { rot: -0.1 },
          torso: { rot: -0.12 },
          legFront: { rot: -0.5 },
          hips: { x: 12 },
        },
      },
      {
        t: 1,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          legFront: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  attackArrojadiza: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, forearmFront: { rot: 0 } } },
      {
        t: 0.35,
        parts: { armFront: { rot: 1.4 }, forearmFront: { rot: 0.8 }, torso: { rot: 0.2 } },
      },
      {
        t: 0.55,
        parts: {
          armFront: { rot: -1.3 },
          forearmFront: { rot: -0.4 },
          torso: { rot: -0.22 },
          hips: { x: 6 },
        },
      },
      {
        t: 1,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  hit: {
    frames: [
      { t: 0, parts: { torso: { rot: 0 }, head: { rot: 0 }, hips: { x: 0 } } },
      {
        t: 0.25,
        parts: {
          torso: { rot: 0.22 },
          head: { rot: 0.12 },
          hips: { x: -10 },
          armFront: { rot: 0.5 },
          armBack: { rot: 0.4 },
        },
      },
      {
        t: 1,
        parts: {
          torso: { rot: 0 },
          head: { rot: 0 },
          hips: { x: 0 },
          armFront: { rot: 0 },
          armBack: { rot: 0 },
        },
      },
    ],
  },

  evade: {
    frames: [
      { t: 0, parts: { hips: { x: 0, y: 0 }, torso: { rot: 0 } } },
      {
        t: 0.45,
        parts: {
          hips: { x: -16, y: -14 },
          torso: { rot: 0.18 },
          legBack: { rot: 0.7 },
          legFront: { rot: -0.5 },
        },
      },
      {
        t: 1,
        parts: {
          hips: { x: 0, y: 0 },
          torso: { rot: 0 },
          legBack: { rot: 0 },
          legFront: { rot: 0 },
        },
      },
    ],
  },

  block: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, forearmFront: { rot: 0 } } },
      {
        t: 0.3,
        parts: {
          armFront: { rot: -1.9 },
          forearmFront: { rot: 1.6 },
          torso: { rot: 0.16 },
          hips: { x: -6 },
        },
      },
      {
        t: 1,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  throw: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, forearmFront: { rot: 0 } } },
      {
        t: 0.35,
        parts: {
          armFront: { rot: 2.2 },
          forearmFront: { rot: 1.1 },
          torso: { rot: 0.32 },
          hips: { x: -7 },
        },
      },
      {
        t: 0.55,
        parts: {
          armFront: { rot: -2 },
          forearmFront: { rot: -0.5 },
          torso: { rot: -0.3 },
          hips: { x: 8 },
        },
      },
      {
        t: 1,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  death: {
    frames: [
      { t: 0, parts: { torso: { rot: 0 }, hips: { y: 0 } } },
      { t: 0.35, parts: { torso: { rot: -0.3 }, head: { rot: -0.15 }, hips: { y: -6 } } },
      {
        t: 1,
        parts: {
          torso: { rot: 1.5 },
          head: { rot: 0.2 },
          hips: { y: 28, x: -14 },
          legBack: { rot: -0.9 },
          legFront: { rot: -0.6 },
          armFront: { rot: -1.2 },
          armBack: { rot: -1 },
        },
      },
    ],
  },

  victory: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, armBack: { rot: 0 }, hips: { y: 0 } } },
      {
        t: 0.3,
        parts: {
          armFront: { rot: -2.6 },
          armBack: { rot: -2.4 },
          hips: { y: -22 },
          torso: { rot: -0.1 },
        },
      },
      { t: 0.55, parts: { hips: { y: 0 } } },
      { t: 0.8, parts: { hips: { y: -14 }, armFront: { rot: -2.8 }, armBack: { rot: -2.6 } } },
      {
        t: 1,
        parts: {
          hips: { y: 0 },
          armFront: { rot: -2.5 },
          armBack: { rot: -2.3 },
          torso: { rot: 0 },
        },
      },
    ],
  },
};
