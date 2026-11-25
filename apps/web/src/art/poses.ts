/**
 * Animaciones del rig, como tablas de keyframes (PLAN.md fase 5). Puro: datos,
 * ni Pixi ni GSAP. El renderer interpola entre frames y estira la animacion a
 * lo que dure el evento.
 *
 * Rotaciones en radianes. Una parte cuelga hacia abajo en reposo (rot 0), asi
 * que girar a negativo la lleva hacia delante y a positivo hacia atras.
 *
 * OJO: eso vale para lo que cuelga (brazos, piernas). El TORSO apunta hacia
 * ARRIBA, asi que en el se invierte: negativo lo lleva hacia delante y positivo
 * hacia atras. Seguir la regla de arriba al pie de la letra es lo que tumbaba
 * al muerto sobre sus propias piernas en vez de de espaldas.
 *
 * "Delante" es siempre hacia el rival: el cuerpo se voltea con `facing`, asi
 * que el +x local apunta al contrario en los dos bandos.
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
  /**
   * Curva con la que se LLEGA a este frame, en el vocabulario de GSAP
   * ('power4.in', 'expo.in'...). Es solo un nombre: este modulo sigue sin
   * saber de GSAP. Sin ella, 'power1.inOut'.
   */
  ease?: string;
  parts: Partial<Record<PartName, Pose>>;
}

export interface Animation {
  frames: Frame[];
  loop?: boolean;
  /**
   * Momento del impacto, de 0 a 1. La linea de tiempo estira la animacion para
   * que este frame caiga al final del turno de ataque, justo cuando el rival
   * acusa el golpe; lo que va despues (la recuperacion) pisa el turno siguiente.
   */
  contacto?: number;
  /**
   * Parte de la animacion que suena ANTES de su turno, de 0 a 1. Para gestos
   * que tienen que estar hechos cuando llega el golpe: una guardia que sube
   * despues del choque no para nada.
   */
  adelanto?: number;
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

  /**
   * Dos zancadas y los pies plantados. Empieza y acaba en reposo: si acabara a
   * media zancada, el peleon se quedaba con las piernas abiertas el resto de
   * la pelea, porque nada mas las devuelve a su sitio.
   */
  walk: {
    frames: [
      // Sin brazos: el primer frame se fija de golpe, y la retirada empieza
      // cuando el brazo del golpe aun esta volviendo. Fijarlo a 0 lo hacia
      // saltar; asi el braceo arranca desde donde este.
      { t: 0, parts: { legBack: { rot: 0 }, legFront: { rot: 0 }, hips: { y: 0 } } },
      {
        t: 0.22,
        ease: 'sine.out',
        parts: {
          legBack: { rot: 0.45 },
          legFront: { rot: -0.45 },
          armBack: { rot: -0.35 },
          armFront: { rot: 0.35 },
          hips: { y: -3 },
        },
      },
      {
        t: 0.55,
        ease: 'sine.inOut',
        parts: {
          legBack: { rot: -0.45 },
          legFront: { rot: 0.45 },
          armBack: { rot: 0.35 },
          armFront: { rot: -0.35 },
          hips: { y: -3 },
        },
      },
      {
        t: 1,
        ease: 'power2.out',
        parts: {
          legBack: { rot: 0 },
          legFront: { rot: 0 },
          armBack: { rot: 0 },
          armFront: { rot: 0 },
          hips: { y: 0 },
        },
      },
    ],
  },

  /*
   * Los cuatro ataques siguen el mismo compas: carga despacio, sale de golpe,
   * se CONGELA en el contacto (el hit-stop: dos frames iguales) y recupera sin
   * prisa. `contacto` marca el frame del impacto; la linea de tiempo estira la
   * animacion para que ese frame caiga justo cuando el rival acusa el golpe.
   */

  // Rapida: poco recorrido, mucha punta. Es una punalada, no un mandoble.
  attackRapida: {
    contacto: 0.45,
    frames: [
      {
        t: 0,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
      {
        t: 0.32,
        ease: 'power2.out',
        parts: {
          armFront: { rot: 0.7 },
          forearmFront: { rot: 0.9 },
          torso: { rot: 0.16 },
          hips: { x: -3 },
        },
      },
      {
        t: 0.45,
        ease: 'power4.in',
        parts: {
          armFront: { rot: -1.75 },
          forearmFront: { rot: -0.15 },
          torso: { rot: -0.24 },
          hips: { x: 9 },
        },
      },
      {
        t: 0.55,
        ease: 'none',
        parts: {
          armFront: { rot: -1.7 },
          forearmFront: { rot: -0.15 },
          torso: { rot: -0.22 },
          hips: { x: 9 },
        },
      },
      {
        t: 1,
        ease: 'power2.inOut',
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  // Pesada: se carga por encima de la cabeza, se sostiene arriba y cae con todo el cuerpo.
  attackPesada: {
    contacto: 0.55,
    frames: [
      {
        t: 0,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          head: { rot: 0 },
          hips: { x: 0, y: 0 },
        },
      },
      {
        t: 0.36,
        ease: 'power2.out',
        parts: {
          armFront: { rot: 2.0 },
          forearmFront: { rot: 1.05 },
          torso: { rot: 0.32 },
          head: { rot: 0.15 },
          hips: { x: -6, y: -3 },
        },
      },
      {
        t: 0.44,
        ease: 'sine.inOut',
        parts: { armFront: { rot: 2.1 }, forearmFront: { rot: 1.1 }, torso: { rot: 0.35 } },
      },
      {
        t: 0.55,
        ease: 'expo.in',
        parts: {
          armFront: { rot: -1.5 },
          forearmFront: { rot: -0.3 },
          torso: { rot: -0.4 },
          head: { rot: -0.18 },
          hips: { x: 11, y: 3 },
        },
      },
      {
        t: 0.65,
        ease: 'none',
        parts: { armFront: { rot: -1.45 }, torso: { rot: -0.38 }, hips: { x: 11, y: 3 } },
      },
      {
        t: 1,
        ease: 'power2.inOut',
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          head: { rot: 0 },
          hips: { x: 0, y: 0 },
        },
      },
    ],
  },

  // Larga: estocada recta, el cuerpo entero va detras del arma.
  attackLarga: {
    contacto: 0.48,
    frames: [
      {
        t: 0,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          legFront: { rot: 0 },
          hips: { x: 0 },
        },
      },
      {
        t: 0.32,
        ease: 'power2.out',
        parts: {
          armFront: { rot: -0.9 },
          forearmFront: { rot: 0.6 },
          torso: { rot: 0.1 },
          hips: { x: -6 },
        },
      },
      {
        t: 0.48,
        ease: 'power4.in',
        parts: {
          armFront: { rot: -1.6 },
          forearmFront: { rot: -0.1 },
          torso: { rot: -0.14 },
          legFront: { rot: -0.55 },
          hips: { x: 14 },
        },
      },
      {
        t: 0.58,
        ease: 'none',
        parts: { armFront: { rot: -1.55 }, torso: { rot: -0.13 }, hips: { x: 14 } },
      },
      {
        t: 1,
        ease: 'power2.inOut',
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
    contacto: 0.48,
    frames: [
      {
        t: 0,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
      {
        t: 0.34,
        ease: 'power2.out',
        parts: {
          armFront: { rot: 1.45 },
          forearmFront: { rot: 0.85 },
          torso: { rot: 0.22 },
          hips: { x: -4 },
        },
      },
      {
        t: 0.48,
        ease: 'power4.in',
        parts: {
          armFront: { rot: -1.35 },
          forearmFront: { rot: -0.4 },
          torso: { rot: -0.24 },
          hips: { x: 7 },
        },
      },
      {
        t: 0.58,
        ease: 'none',
        parts: { armFront: { rot: -1.3 }, torso: { rot: -0.22 }, hips: { x: 7 } },
      },
      {
        t: 1,
        ease: 'power2.inOut',
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  /** El golpe llega de una vez (el latigazo, en el primer 12%) y se recupera despacio. */
  hit: {
    frames: [
      {
        t: 0,
        parts: {
          torso: { rot: 0 },
          head: { rot: 0 },
          hips: { x: 0 },
          armFront: { rot: 0 },
          armBack: { rot: 0 },
        },
      },
      {
        t: 0.12,
        ease: 'power4.out',
        parts: {
          torso: { rot: 0.3 },
          head: { rot: 0.28 },
          hips: { x: -15 },
          armFront: { rot: 0.65 },
          armBack: { rot: 0.5 },
        },
      },
      {
        t: 0.42,
        ease: 'sine.out',
        parts: { torso: { rot: 0.24 }, head: { rot: 0.18 }, hips: { x: -17 } },
      },
      {
        // Suave en las dos puntas: con 'power2.out' arrancaba de golpe y se
        // enderezaba contra el puno, que aun no se habia retirado.
        t: 1,
        ease: 'sine.inOut',
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

  /** Salto atras rapido y caida con peso. */
  evade: {
    frames: [
      {
        t: 0,
        parts: {
          hips: { x: 0, y: 0 },
          torso: { rot: 0 },
          legBack: { rot: 0 },
          legFront: { rot: 0 },
        },
      },
      {
        t: 0.35,
        ease: 'power3.out',
        parts: {
          // Hacia atras de verdad: con 18 el puno seguia tocandole el hombro.
          hips: { x: -40, y: -14 },
          torso: { rot: 0.2 },
          legBack: { rot: 0.7 },
          legFront: { rot: -0.5 },
        },
      },
      {
        t: 0.5,
        ease: 'power2.in',
        parts: {
          // Cae agachado: el peso se ve en la flexion, no en el tiempo.
          hips: { x: -34, y: 4 },
          torso: { rot: -0.08 },
          legBack: { rot: 0.35 },
          legFront: { rot: -0.3 },
        },
      },
      {
        // La vuelta a su sitio, sin prisa: en un 30% del turno se deslizaba
        // 45 px con los pies quietos.
        t: 1,
        ease: 'sine.inOut',
        parts: {
          hips: { x: 0, y: 0 },
          torso: { rot: 0 },
          legBack: { rot: 0 },
          legFront: { rot: 0 },
        },
      },
    ],
  },

  /**
   * La guardia sube antes de que llegue el golpe y aguanta el choque. Con
   * `adelanto` 0.3, el frame 0.3 cae justo en el contacto: los brazos ya estan
   * arriba y el empujon llega con la chispa.
   */
  block: {
    adelanto: 0.3,
    frames: [
      {
        t: 0,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
      {
        t: 0.22,
        ease: 'power3.out',
        parts: {
          armFront: { rot: -1.9 },
          forearmFront: { rot: 1.6 },
          torso: { rot: 0.08 },
          hips: { x: -2 },
        },
      },
      {
        t: 0.3,
        ease: 'none',
        parts: { armFront: { rot: -1.9 }, torso: { rot: 0.08 }, hips: { x: -2 } },
      },
      {
        t: 0.42,
        ease: 'power4.out',
        parts: { torso: { rot: 0.22 }, hips: { x: -10 } },
      },
      {
        t: 1,
        ease: 'power2.inOut',
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
      {
        t: 0,
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
      {
        t: 0.38,
        ease: 'power2.out',
        parts: {
          armFront: { rot: 2.2 },
          forearmFront: { rot: 1.1 },
          torso: { rot: 0.32 },
          hips: { x: -7 },
        },
      },
      {
        t: 0.52,
        ease: 'power4.in',
        parts: {
          armFront: { rot: -2 },
          forearmFront: { rot: -0.5 },
          torso: { rot: -0.3 },
          hips: { x: 8 },
        },
      },
      {
        t: 1,
        ease: 'power2.inOut',
        parts: {
          armFront: { rot: 0 },
          forearmFront: { rot: 0 },
          torso: { rot: 0 },
          hips: { x: 0 },
        },
      },
    ],
  },

  /**
   * Cae de espaldas. El torso en reposo apunta ARRIBA, asi que girarlo en
   * negativo lo tumba hacia atras (lejos del rival) y en positivo lo doblaba
   * hacia delante sobre si mismo, que era lo que se veia.
   *
   * Tumbado, cada miembro busca su angulo en el MUNDO, no en su padre:
   * - piernas (cuelgan de la cadera, sin girar): -1.5 las deja apuntando al frente.
   * - brazos (cuelgan del torso, ya girado -1.5): casi a 0, pegados al
   *   costado. Cualquier giro hacia el suelo los clava en el.
   *
   * La caida acelera (gravedad) y rebota una vez contra el suelo.
   */
  death: {
    frames: [
      { t: 0, parts: { torso: { rot: 0 }, hips: { y: 0, x: 0 } } },
      // Acusa el golpe y trastabilla hacia atras antes de irse al suelo.
      {
        t: 0.3,
        ease: 'power2.out',
        parts: {
          torso: { rot: -0.35 },
          head: { rot: 0.2 },
          hips: { y: -4, x: -10 },
          armFront: { rot: 0.5 },
          armBack: { rot: 0.4 },
        },
      },
      {
        t: 0.78,
        ease: 'power3.in',
        parts: {
          // Tumbado del todo (-pi/2) y con la cadera a la altura del medio
          // torso, para que la espalda apoye en el suelo y no se hunda en el.
          torso: { rot: -1.57 },
          head: { rot: 0.08 },
          hips: { y: 17, x: -24 },
          legBack: { rot: -1.4 },
          legFront: { rot: -1.55 },
          // Pegados al costado. Con el torso tumbado (-1.5), un brazo a +1.1
          // apuntaba hacia abajo y el puno atravesaba el suelo.
          armFront: { rot: 0.25 },
          armBack: { rot: 0.15 },
        },
      },
      {
        t: 0.88,
        ease: 'power2.out',
        parts: { hips: { y: 13 }, torso: { rot: -1.48 }, head: { rot: 0.0 } },
      },
      {
        t: 1,
        ease: 'power2.in',
        parts: { hips: { y: 17 }, torso: { rot: -1.57 }, head: { rot: 0.08 } },
      },
    ],
  },

  /**
   * Los dos brazos arriba en V. El de atras sube hacia ATRAS (rot positiva): si
   * subia hacia delante como el otro, quedaba entero detras del torso y la
   * cabeza, y solo se veia un brazo.
   */
  victory: {
    frames: [
      { t: 0, parts: { armFront: { rot: 0 }, armBack: { rot: 0 }, hips: { y: 0 } } },
      {
        t: 0.3,
        parts: {
          armFront: { rot: -2.6 },
          armBack: { rot: 2.4 },
          hips: { y: -22 },
          torso: { rot: -0.1 },
        },
      },
      { t: 0.55, parts: { hips: { y: 0 } } },
      { t: 0.8, parts: { hips: { y: -14 }, armFront: { rot: -2.8 }, armBack: { rot: 2.6 } } },
      {
        t: 1,
        parts: {
          hips: { y: 0 },
          armFront: { rot: -2.5 },
          armBack: { rot: 2.3 },
          torso: { rot: 0 },
        },
      },
    ],
  },
};

/*
 * El mismo ataque cuando el rival lo PARA. El brazo sale igual (el que ataca no
 * sabe que le van a parar), pero apunta mas bajo, a la guardia y no a la cara,
 * y en el contacto no se congela: rebota hacia atras, como contra algo duro.
 * El rebote ocupa el sitio del hit-stop; la recuperacion parte de ahi.
 */
const BAJADA = 0.4;
const REBOTE: Partial<Record<PartName, Pose>> = {
  armFront: { rot: 0.5 },
  forearmFront: { rot: 0.45 },
  torso: { rot: 0.1 },
  hips: { x: -6 },
};

function desplazar(parts: Frame['parts'], delta: Frame['parts']): Frame['parts'] {
  const out: Frame['parts'] = {};
  for (const [name, pose] of Object.entries(parts) as [PartName, Pose][]) {
    const d = delta[name] ?? {};
    out[name] = {
      ...pose,
      ...(pose.rot !== undefined && { rot: pose.rot + (d.rot ?? 0) }),
      ...(pose.x !== undefined && { x: pose.x + (d.x ?? 0) }),
      ...(pose.y !== undefined && { y: pose.y + (d.y ?? 0) }),
    };
  }
  return out;
}

function contraLaGuardia(anim: Animation): Animation {
  const i = anim.frames.findIndex((f) => f.t === anim.contacto);
  const golpe = anim.frames[i];
  const sosten = anim.frames[i + 1];
  if (golpe === undefined || sosten === undefined) return anim;
  const contacto = desplazar(golpe.parts, { armFront: { rot: BAJADA } });
  const frames = [...anim.frames];
  frames[i] = { ...golpe, parts: contacto };
  frames[i + 1] = { ...sosten, ease: 'power3.out', parts: desplazar(contacto, REBOTE) };
  return { ...anim, frames };
}

/** La animacion que toca, segun si el golpe entra o lo paran. */
export function animacion(anim: AnimName, parada = false): Animation {
  const base = ANIMATIONS[anim];
  return parada && base.contacto !== undefined ? PARADAS[anim] : base;
}

const PARADAS = Object.fromEntries(
  (Object.keys(ANIMATIONS) as AnimName[]).map((n) => [n, contraLaGuardia(ANIMATIONS[n])]),
) as Record<AnimName, Animation>;
