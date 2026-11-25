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
import { girar, type PartName } from './parts.js';

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
  /** El brazo que pega. Sin el, el de delante, que es el que lleva el arma. */
  brazo?: 'armFront' | 'armBack';
}

export type AnimName =
  | 'idle'
  | 'walk'
  | 'attackRapida'
  | 'attackPesada'
  | 'attackLarga'
  | 'attackArrojadiza'
  | 'attackCruzado'
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

/*
 * El brazo que no pega no cuelga muerto: sube a tapar la barbilla mientras el
 * otro carga y, al soltar el golpe, se recoge contra el pecho. Es el contrapeso
 * del giro del torso, y lo que hace que el golpe parezca de todo el cuerpo.
 *
 * Con el torso girado hacia delante (rot negativa), el brazo cuelga ya un poco
 * adelantado: por eso la recogida tiene MENOS rotacion que la guardia, no mas.
 * El puno se queda a la altura de la mandibula y a un lado: delante de la cara
 * tapaba la boca, y con ella el gesto de esfuerzo.
 */
const GUARDIA: Partial<Record<PartName, Pose>> = {
  armBack: { rot: -0.45, x: 0 },
  forearmBack: { rot: -1.75 },
};
const RECOGIDA: Partial<Record<PartName, Pose>> = {
  armBack: { rot: -0.15, x: 0 },
  forearmBack: { rot: -2.05 },
};
/** La misma guardia para el brazo de delante, cuando pega el de atras. */
const GUARDIA_DELANTE: Partial<Record<PartName, Pose>> = {
  armFront: { rot: -0.7 },
  forearmFront: { rot: -1.9 },
};
const RECOGIDA_DELANTE: Partial<Record<PartName, Pose>> = {
  armFront: { rot: -0.15 },
  forearmFront: { rot: -2.4 },
};
/** Cuanto avanza el hombro de atras al cruzar, en unidades del rig. */
const HOMBRO_ADELANTE = 30;
const BRAZO_ATRAS_SUELTO: Partial<Record<PartName, Pose>> = {
  armBack: { rot: 0, x: 0, y: 0 },
  forearmBack: { rot: 0 },
};

/**
 * Pone el brazo libre en guardia durante un ataque del brazo de delante: sube
 * con la carga, se recoge en el contacto y el sosten, y baja en la vuelta. El
 * primer frame no lo toca, para que arranque desde donde este.
 */
function conGuardia(anim: Animation): Animation {
  const i = anim.frames.findIndex((f) => f.t === anim.contacto);
  const frames = anim.frames.map((frame, j): Frame => {
    if (j === 0) return frame;
    const extra = j === anim.frames.length - 1 ? BRAZO_ATRAS_SUELTO : j < i ? GUARDIA : RECOGIDA;
    return { ...frame, parts: { ...frame.parts, ...extra } };
  });
  return { ...anim, frames };
}

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
  attackRapida: conGuardia({
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
        t: 0.6,
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
  }),

  // Pesada: se carga por encima de la cabeza, se sostiene arriba y cae con todo el cuerpo.
  attackPesada: conGuardia({
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
        t: 0.7,
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
  }),

  // Larga: estocada recta, el cuerpo entero va detras del arma.
  attackLarga: conGuardia({
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
        t: 0.63,
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
  }),

  attackArrojadiza: conGuardia({
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
        t: 0.63,
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
  }),

  /**
   * El "dos" del uno-dos a punos: pega el brazo de atras, que sale del hombro
   * lejano y por eso necesita mas giro de torso y mas cadera para llegar. El
   * de delante, que acaba de pegar, vuelve a la guardia mientras tanto. Solo
   * suena encadenado, asi que no tiene frame de partida: arranca desde donde
   * haya dejado los brazos el golpe anterior.
   */
  // El hombro de atras se adelanta en el giro: en plano, el brazo sale de
  // detras del torso y el puno no llegaba ni a asomar por el otro lado.
  attackCruzado: {
    contacto: 0.45,
    brazo: 'armBack',
    frames: [
      { t: 0, parts: {} },
      {
        t: 0.3,
        ease: 'power2.out',
        parts: {
          armBack: { rot: 0.35, x: -3 },
          forearmBack: { rot: -1.7 },
          torso: { rot: 0.14 },
          hips: { x: -2 },
          ...GUARDIA_DELANTE,
        },
      },
      {
        t: 0.45,
        ease: 'power4.in',
        parts: {
          armBack: { rot: -1.3, x: HOMBRO_ADELANTE },
          forearmBack: { rot: -0.05 },
          torso: { rot: -0.45 },
          hips: { x: 26 },
          ...RECOGIDA_DELANTE,
          armFront: { ...RECOGIDA_DELANTE.armFront, x: -6 },
        },
      },
      {
        t: 0.6,
        ease: 'none',
        parts: {
          armBack: { rot: -1.26, x: HOMBRO_ADELANTE },
          forearmBack: { rot: -0.05 },
          torso: { rot: -0.43 },
          hips: { x: 26 },
          ...RECOGIDA_DELANTE,
          armFront: { ...RECOGIDA_DELANTE.armFront, x: -6 },
        },
      },
      {
        t: 1,
        ease: 'power2.inOut',
        parts: {
          armBack: { rot: 0, x: 0 },
          forearmBack: { rot: 0 },
          armFront: { rot: 0, x: 0 },
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
          // El otro brazo tambien sube, a tapar la cara por si el golpe pasa.
          ...GUARDIA,
        },
      },
      {
        t: 0.3,
        ease: 'none',
        parts: { armFront: { rot: -1.9 }, torso: { rot: 0.08 }, hips: { x: -2 }, ...GUARDIA },
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
          ...BRAZO_ATRAS_SUELTO,
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

/** El rebote contra la guardia, del brazo que pega. */
function rebote(brazo: 'armFront' | 'armBack'): Partial<Record<PartName, Pose>> {
  const antebrazo = brazo === 'armFront' ? 'forearmFront' : 'forearmBack';
  return {
    [brazo]: { rot: 0.5 },
    [antebrazo]: { rot: 0.45 },
    torso: { rot: 0.1 },
    hips: { x: -6 },
  };
}

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
  const brazo = anim.brazo ?? 'armFront';
  const contacto = desplazar(golpe.parts, { [brazo]: { rot: BAJADA } });
  const frames = [...anim.frames];
  frames[i] = { ...golpe, parts: contacto };
  frames[i + 1] = { ...sosten, ease: 'power3.out', parts: desplazar(contacto, rebote(brazo)) };
  return { ...anim, frames };
}

/**
 * Cuanto se carga un golpe que encadena con el anterior. El brazo viene de
 * estar estirado: volver a cargar entero se leia como dos ataques sueltos, no
 * como un combo. Con poco mas de la mitad, el segundo sale casi del rebote.
 */
const CARGA_ENCADENADA = 0.55;
/** El ultimo del combo es el remate: casi se carga entero. */
const CARGA_REMATE = 0.9;
/**
 * Lo que se aguanta el golpe anterior antes de cargar el siguiente. Va a la
 * par del sosten de cada ataque (del contacto al frame siguiente, un 15%), o
 * la carga nueva se comeria el final del hit-stop.
 */
const RESPIRO = 0.16;

/**
 * El mismo ataque cuando sigue a otro del mismo turno. Sin frame de partida:
 * el primero fijaba los brazos en reposo de golpe, y entre impacto e impacto
 * el brazo saltaba de estirado a colgando. La carga se acorta, y la guardia
 * (lo que no estaba en el frame de partida) no se toca: no baja entre golpes.
 */
function encadenado(anim: Animation, fuerza: number): Animation {
  const [partida, carga, ...resto] = anim.frames;
  if (partida === undefined || carga === undefined || anim.contacto === undefined) return anim;
  const recortar = new Set(Object.keys(partida.parts));
  const parts: Frame['parts'] = {};
  for (const [name, pose] of Object.entries(carga.parts) as [PartName, Pose][]) {
    if (!recortar.has(name)) {
      parts[name] = pose;
      continue;
    }
    parts[name] = {
      ...(pose.rot !== undefined && { rot: pose.rot * fuerza }),
      ...(pose.x !== undefined && { x: pose.x * fuerza }),
      ...(pose.y !== undefined && { y: pose.y * fuerza }),
    };
  }
  // El frame vacio de en medio deja sonar el hit-stop del golpe anterior: la
  // carga empieza alli y no en el instante del contacto, que lo borraba.
  return {
    ...anim,
    frames: [{ t: 0, parts: {} }, { t: RESPIRO, parts: {} }, { ...carga, parts }, ...resto],
  };
}

/** Hasta donde se estira el sosten del remate, en fraccion de la animacion. */
const SOSTEN_REMATE = 0.25;

/**
 * El ultimo golpe del combo. Tres iguales seguidos sonaban a metronomo: el
 * remate entra mas alto (a la mandibula), con mas cadera y mas giro, y se
 * queda clavado el doble de tiempo antes de volver.
 */
function remate(anim: Animation): Animation {
  const i = anim.frames.findIndex((f) => f.t === anim.contacto);
  const golpe = anim.frames[i];
  const sosten = anim.frames[i + 1];
  if (golpe === undefined || sosten === undefined || anim.contacto === undefined) return anim;
  const brazo = anim.brazo ?? 'armFront';
  const mas: Frame['parts'] = { [brazo]: { rot: -0.15 }, torso: { rot: -0.08 }, hips: { x: 5 } };
  const frames = [...anim.frames];
  const clavado = desplazar(golpe.parts, mas);
  frames[i] = { ...golpe, parts: clavado };
  // Congelado del todo: el sosten normal se deja ir un poco, el remate no.
  frames[i + 1] = {
    ...sosten,
    t: Math.max(sosten.t, anim.contacto + SOSTEN_REMATE),
    parts: clavado,
  };
  return { ...anim, frames };
}

/** Donde agarra la mano de atras, en unidades a lo largo del arma desde el puno. */
const AGARRE: Partial<Record<AnimName, number>> = { attackPesada: 9, attackLarga: 13 };

/**
 * Las armas pesadas y largas se cogen a dos manos. El rig tiene el torso de
 * frente y los hombros a los lados, y desde el hombro de atras la mano no
 * llega al mango: el brazo de atras COPIA la pose del de delante y se corre
 * entero hasta que su puno cae sobre el arma, un poco mas alla del otro. Queda
 * casi tapado por el brazo de delante, que se pinta encima, y lo que asoma es
 * el segundo puno en el mango, que es lo que dice "a dos manos".
 *
 * Las medidas van en el sistema del torso, con los hombros de cada complexion:
 * por eso se calcula por peleon y no va en la tabla de animaciones.
 */
function aDosManos(
  anim: Animation,
  agarre: number,
  hombros: { delante: { x: number; y: number }; atras: { x: number; y: number } },
): Animation {
  // La mano del arma esta girada -0.35 (ver `pixiRig`): el mango sale asi.
  const [gx, gy] = girar(agarre, 0, -0.35);
  let actual = { rot: 0, antebrazo: 0, x: 0, y: 0 };
  const ultimo = anim.frames.length - 1;
  const frames = anim.frames.map((frame, j): Frame => {
    const brazo = frame.parts.armFront;
    const antebrazo = frame.parts.forearmFront;
    actual = {
      rot: brazo?.rot ?? actual.rot,
      antebrazo: antebrazo?.rot ?? actual.antebrazo,
      x: brazo?.x ?? actual.x,
      y: brazo?.y ?? actual.y,
    };
    if (j === 0) return frame;
    // Al volver al reposo suelta el mango: cada brazo a su sitio.
    if (j === ultimo) return { ...frame, parts: { ...frame.parts, ...BRAZO_ATRAS_SUELTO } };
    if (brazo === undefined && antebrazo === undefined) return frame;
    const [dx, dy] = girar(gx, gy, actual.rot + actual.antebrazo);
    return {
      ...frame,
      parts: {
        ...frame.parts,
        armBack: {
          rot: actual.rot,
          x: hombros.delante.x + actual.x - hombros.atras.x + dx,
          y: hombros.delante.y + actual.y - hombros.atras.y + dy,
        },
        forearmBack: { rot: actual.antebrazo },
      },
    };
  });
  return { ...anim, frames };
}

export interface Variante {
  /** El rival lo para: apunta a la guardia y rebota. */
  parada?: boolean;
  /** Sigue a otro golpe del mismo turno: arranca de donde este el brazo. */
  encadena?: boolean;
  /** El ultimo golpe del combo. Solo cuenta si encadena. */
  remata?: boolean;
  /** Hombros del peleon, en el sistema del torso: para coger el arma a dos manos. */
  hombros?: { delante: { x: number; y: number }; atras: { x: number; y: number } };
}

const variantes = new Map<string, Animation>();

/**
 * La animacion que toca: segun si el golpe entra o lo paran, si abre el turno,
 * encadena con el anterior o lo remata, y con que manos se coge el arma.
 */
export function animacion(anim: AnimName, variante: Variante = {}): Animation {
  const base = ANIMATIONS[anim];
  if (base.contacto === undefined) return base;
  const { parada = false, encadena = false, hombros } = variante;
  const remata = encadena && variante.remata === true;
  const agarre = hombros === undefined ? undefined : AGARRE[anim];
  if (!parada && !encadena && agarre === undefined) return base;
  const manos = agarre === undefined || hombros === undefined ? '' : JSON.stringify(hombros);
  const clave = `${anim}:${parada}:${encadena}:${remata}:${manos}`;
  let hecha = variantes.get(clave);
  if (hecha === undefined) {
    let paso = encadena ? encadenado(base, remata ? CARGA_REMATE : CARGA_ENCADENADA) : base;
    if (remata) paso = remate(paso);
    if (parada) paso = contraLaGuardia(paso);
    if (agarre !== undefined && hombros !== undefined) paso = aDosManos(paso, agarre, hombros);
    hecha = paso;
    variantes.set(clave, hecha);
  }
  return hecha;
}
