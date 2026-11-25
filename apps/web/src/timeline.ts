/**
 * Del guion (`fightScene.ts`) a una linea de tiempo de GSAP sobre el rig de Pixi.
 *
 * Todo lo que se anima se crea antes de reproducir: si se crearan objetos sobre
 * la marcha, saltar al final o repetir dejaria la escena a medias.
 */
import { gsap } from 'gsap';
import { Container } from 'pixi.js';
import type { PartName } from './art/parts.js';
import { animacion, type AnimName } from './art/poses.js';
import { pistaDeCaras, TIME_SCALE, type Move, type Pie, type Scene } from './fightScene.js';
import {
  changeWeapon,
  drawActor,
  drawEscenario,
  drawGround,
  ESCALA_ACTOR,
  makeAnnounce,
  makeFloater,
  makeImpacto,
  makeProjectile,
  makeRing,
  SIZE,
  SUELO,
  weaponOf,
  type ActorView,
} from './pixiScene.js';

const BLANCO = 0xffffff;

/**
 * Lo que necesita cada movimiento ademas de su actor. El mundo es lo que
 * tiembla; los carteles van en la capa de arriba, que no se mueve.
 */
interface Escena {
  mundo: Container;
  carteles: Container;
  menosMovimiento: boolean;
}

/**
 * Tinte del destello. Pixi multiplica el tinte, no lo suma: con el rojo del
 * numero (0xcc3333) el peleon entero se volvia una mancha granate y no se le
 * reconocia. Aclarado hacia el blanco, calienta el dibujo sin borrarlo.
 */
function aclarar(color: number, cuanto = 0.55): number {
  const canal = (desplazamiento: number): number => {
    const valor = (color >> desplazamiento) & 0xff;
    return Math.round(valor + (0xff - valor) * cuanto) << desplazamiento;
  };
  return canal(16) | canal(8) | canal(0);
}

/**
 * Con menos movimiento, cruzar el escenario es el desplazamiento mas grande de
 * la escena: se sustituye por un fundido corto que cambia de sitio a oscuras.
 */
function cortar(
  tl: gsap.core.Timeline,
  root: Container,
  x: number,
  at: number,
  duration: number,
): void {
  const fundido = Math.min(0.08, duration / 3);
  // Hasta 0 del todo: Pixi aplica la transparencia pieza a pieza, y a medias
  // se ven los brazos a traves del torso.
  tl.to(root, { alpha: 0, duration: fundido }, at);
  tl.set(root, { x }, at + fundido);
  tl.to(root, { alpha: 1, duration: fundido }, at + fundido);
}

/** Lo que dura el destello: un parpadeo, no un estado. */
const DESTELLO = 0.11;

/**
 * Temblor del mundo, amortiguado. La amplitud crece con el dano y tiene techo:
 * con un 30 en la cara, a pantalla completa, mas de 9 px marea.
 */
function temblor(tl: gsap.core.Timeline, mundo: Container, at: number, fuerza: number): void {
  const amplitud = Math.min(9, 2.5 + fuerza * 0.45);
  const pasos = [1, -0.7, 0.45, -0.2, 0];
  pasos.forEach((k, i) => {
    tl.to(
      mundo,
      { x: amplitud * k, y: amplitud * 0.35 * Math.abs(k), duration: 0.035, ease: 'none' },
      at + i * 0.035,
    );
  });
}

/** Medio cuerpo de cada uno. El rig mide unos 50 px de ancho, ya escalado. */
const MEDIO_CUERPO = 26 * ESCALA_ACTOR;

/**
 * Los actores se dibujan a ESCALA_ACTOR, asi que todo lo que se cuelga de ellos
 * (numeros, anillos, proyectiles) sube en la misma proporcion o se les queda por
 * la cintura. `y` va en negativo: hacia arriba.
 */
const arriba = (px: number): number => px * ESCALA_ACTOR;

/** Lo que tarda un numero de dano en subir y apagarse (COMBATE.md §5). */
const FLOTA = 0.6 * TIME_SCALE;

/**
 * A que distancia del rival se planta quien ataca. Con punos se acercan hasta
 * casi tocarse; con un chuzo se quedan a un par de cuerpos, que para eso tiene
 * alcance (COMBATE.md §1.5).
 */
function hueco(weaponId: string): number {
  const alcance = weaponOf(weaponId)?.reach ?? 1;
  return MEDIO_CUERPO * 2 + alcance * 12 * ESCALA_ACTOR;
}

/**
 * Envoltorio de `fromTo` que fuerza `immediateRender: false`. NO usar
 * `timeline.fromTo` directamente.
 *
 * Por defecto GSAP aplica los valores de inicio al CREAR el tween, no cuando le
 * toca sonar. Como la linea de tiempo se construye entera de golpe, sin esto los
 * numeros de dano, los anillos y los proyectiles aparecen visibles desde el
 * primer fotograma y se quedan ahi quietos hasta su turno.
 */
function fromTo(
  linea: gsap.core.Timeline,
  objetivo: object,
  desde: gsap.TweenVars,
  hasta: gsap.TweenVars,
  at: number,
): void {
  linea.fromTo(objetivo, desde, { ...hasta, immediateRender: false }, at);
}

/**
 * Toca una animacion del rig estirando sus keyframes a lo que dure el evento.
 * Las mascotas no tienen rig: se les hace un gesto equivalente de una pieza.
 */
function playAnimation(
  tl: gsap.core.Timeline,
  view: ActorView,
  anim: AnimName,
  at: number,
  duration: number,
  parada = false,
): void {
  if (view.rig === null) return playFallback(tl, view, anim, at, duration);

  const { frames, contacto, adelanto } = animacion(anim, parada);
  // Un gesto que tiene que estar hecho al llegar el golpe empieza antes de su turno.
  if (adelanto !== undefined) at -= duration * adelanto;
  // Con impacto, la animacion se estira para que el contacto caiga al final del
  // turno de ataque: ahi empieza el del golpe, y el rival lo acusa en el acto.
  // La recuperacion sigue sonando por encima del turno siguiente.
  if (contacto !== undefined) duration = duration / contacto;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame === undefined) continue;
    const previo = i === 0 ? undefined : frames[i - 1];
    const desde = at + (previo?.t ?? 0) * duration;
    const tramo = i === 0 ? 0 : (frame.t - (previo?.t ?? 0)) * duration;

    for (const [name, pose] of Object.entries(frame.parts)) {
      const node = view.rig.parts.get(name as PartName);
      const base = view.rig.base.get(name as PartName);
      if (node === undefined || base === undefined) continue;

      const destino: Record<string, number> = {};
      if (pose.rot !== undefined) destino['rotation'] = pose.rot;
      if (pose.x !== undefined) destino['x'] = base.x + pose.x;
      if (pose.y !== undefined) destino['y'] = base.y + pose.y;
      if (Object.keys(destino).length === 0) continue;

      // El primer frame se fija de golpe: es el punto de partida del gesto.
      if (tramo === 0) tl.set(node, destino, desde);
      else tl.to(node, { ...destino, duration: tramo, ease: frame.ease ?? 'power1.inOut' }, desde);
    }
  }
}

/** Gesto minimo para quien no tiene articulaciones. */
function playFallback(
  tl: gsap.core.Timeline,
  view: ActorView,
  anim: AnimName,
  at: number,
  duration: number,
): void {
  const { body, actor } = view;
  const mitad = duration / 2;

  if (anim === 'hit') {
    tl.to(body, { x: actor.facing * -10, duration: mitad, ease: 'power3.out' }, at);
    tl.to(body, { x: 0, duration: mitad, ease: 'elastic.out(1, 0.4)' }, at + mitad);
  } else if (anim === 'evade') {
    tl.to(body, { y: -16, duration: mitad, ease: 'power2.out' }, at);
    tl.to(body, { y: 0, duration: mitad, ease: 'power2.in' }, at + mitad);
  } else if (anim === 'death') {
    tl.to(body, { rotation: actor.facing * 1.4, duration, ease: 'power2.in' }, at);
  } else if (anim.startsWith('attack')) {
    tl.to(body, { x: actor.facing * 12, duration: mitad, ease: 'power2.in' }, at);
    tl.to(body, { x: 0, duration: mitad, ease: 'power1.out' }, at + mitad);
  } else {
    tl.to(body.scale, { y: ESCALA_ACTOR * 1.06, duration: mitad }, at);
    tl.to(body.scale, { y: ESCALA_ACTOR, duration: mitad }, at + mitad);
  }
}

function addMove(
  tl: gsap.core.Timeline,
  views: Map<string, ActorView>,
  escena: Escena,
  move: Move,
  at: number,
  duration: number,
): void {
  // El cartel no es de nadie: se pinta en medio de la pantalla.
  if (move.kind === 'announce') {
    const label = makeAnnounce(move.text, move.grande);
    label.alpha = 0;
    escena.carteles.addChild(label);
    if (!escena.menosMovimiento) {
      fromTo(
        tl,
        label.scale,
        { x: 0.6, y: 0.6 },
        { x: 1, y: 1, duration: duration * 0.45, ease: 'back.out(2)' },
        at,
      );
    }
    fromTo(tl, label, { alpha: 0 }, { alpha: 1, duration: duration * 0.25 }, at);
    // El de cierre se queda: es quien gano, y `Ir al final` aterriza justo aqui.
    if (!move.queda) tl.to(label, { alpha: 0, duration: duration * 0.3 }, at + duration * 0.7);
    return;
  }

  const view = views.get(move.kind === 'projectile' ? move.from : move.id);
  if (view === undefined) return;
  const { root, body } = view;
  const { mundo, menosMovimiento } = escena;
  const homeX = view.actor.home.x * SIZE.width;
  const homeY = view.actor.home.y * SIZE.height;
  const mitad = duration / 2;

  switch (move.kind) {
    case 'appear':
      fromTo(tl, root, { alpha: 0, y: homeY - arriba(40) }, { alpha: 1, y: homeY, duration }, at);
      break;

    case 'approach':
    case 'lunge': {
      const target = views.get(move.toward);
      if (target === undefined) return;
      const targetX = target.actor.home.x * SIZE.width;
      const hacia = targetX > homeX ? 1 : -1;
      const contacto = targetX - hacia * hueco(move.weapon);

      // Los dos se plantan y SE QUEDAN. La vuelta la hace el movimiento
      // `retreat`, al cerrar el turno: si volviera aqui, los impactos
      // encadenados de un combo saldrian desde lejos (COMBATE.md §5).
      if (menosMovimiento) {
        // La embestida sale de la distancia de golpe: apenas hay trayecto, y un
        // segundo fundido seguido del primero solo parpadea.
        if (move.kind === 'lunge') tl.set(root, { x: contacto }, at);
        else cortar(tl, root, contacto, at, duration);
        break;
      }
      const ease = move.kind === 'approach' ? 'power2.out' : 'power2.in';
      tl.to(root, { x: contacto, duration, ease }, at);
      break;
    }

    case 'pose':
      // Andar sin desplazarse (ver `cortar`) seria andar en el sitio.
      if (menosMovimiento && move.anim === 'walk') break;
      playAnimation(tl, view, move.anim, at, duration, move.parada);
      break;

    case 'flash':
      // `set` en vez de tween: interpolar un color como entero da colores falsos.
      tl.set(body, { tint: aclarar(move.color) }, at);
      tl.set(body, { tint: BLANCO }, at + Math.min(DESTELLO, duration * 0.6));
      break;

    case 'impact': {
      // La chispa sale del lado que mira al rival, a la altura del pecho: ahi
      // llega el golpe, sea punetazo, estocada o proyectil.
      const chispa = makeImpacto(move.parada);
      // La parada choca con el antebrazo de la guardia, algo por debajo: el
      // ataque parado apunta ahi (ver `animacion` en poses.ts).
      const alto = view.rig === null ? arriba(22) : arriba(move.parada ? 64 : 72);
      chispa.x = homeX + view.actor.facing * MEDIO_CUERPO * 0.7;
      chispa.y = homeY - alto;
      chispa.rotation = (move.fuerza % 5) * 0.3;
      chispa.alpha = 0;
      mundo.addChild(chispa);
      // Aparece de golpe con el contacto y se apaga sola. El `set` es lo que la
      // enciende: el `fromTo` del apagado no la pinta hasta que le toca.
      tl.set(chispa, { alpha: 1 }, at);
      // Se apaga mientras el golpe sigue congelado: si dura mas que el contacto,
      // queda flotando en el aire cuando el puno ya se ha ido.
      tl.to(chispa, { alpha: 0, duration: 0.11, ease: 'power1.in' }, at + 0.04);
      if (!menosMovimiento) {
        fromTo(
          tl,
          chispa.scale,
          { x: 0.35, y: 0.35 },
          { x: 1.15, y: 1.15, duration: 0.2, ease: 'power3.out' },
          at,
        );
        if (!move.parada) temblor(tl, mundo, at, move.fuerza);
      }
      break;
    }

    case 'pulse':
      tl.to(body.scale, { y: ESCALA_ACTOR * 1.05, duration: mitad }, at);
      tl.to(body.scale, { y: ESCALA_ACTOR, duration: mitad }, at + mitad);
      break;

    case 'hp': {
      const parte = Math.max(0, move.hp / view.actor.maxHp);
      // El peleon lleva su barra en el marcador de HTML; el bicho, una propia
      // de Pixi encima. Se animan igual, pero no por la misma propiedad.
      if (view.hpFill !== null) {
        tl.to(view.hpFill.scale, { x: parte, duration, ease: 'power1.out' }, at);
      } else if (view.hpDom !== null) {
        tl.to(view.hpDom, { scaleX: parte, duration, ease: 'power1.out' }, at);
      }
      break;
    }

    case 'float': {
      const label = makeFloater(move.text, move.color);
      const y0 = homeY - arriba(view.rig === null ? 60 : 135);
      label.x = homeX;
      label.y = y0;
      label.alpha = 0;
      mundo.addChild(label);
      // Los numeros viven 600 ms propios (COMBATE.md §5), no lo que dure su
      // hueco: en un combo el hueco es corto y se irian antes de poder leerlos.
      // Salta con el golpe y luego se va: el pico lo hace legible, la subida
      // lo saca de en medio antes del siguiente.
      tl.set(label, { alpha: 1 }, at);
      tl.to(label, { alpha: 0, duration: FLOTA * 0.4, ease: 'power1.in' }, at + FLOTA * 0.6);
      if (!menosMovimiento) {
        fromTo(
          tl,
          label.scale,
          { x: 0.4, y: 0.4 },
          { x: 1, y: 1, duration: 0.16, ease: 'back.out(3)' },
          at,
        );
        fromTo(
          tl,
          label,
          { y: y0 },
          { y: y0 - arriba(45), duration: FLOTA, ease: 'power2.out' },
          at,
        );
      }
      break;
    }

    case 'weapon':
      // Cambiar la forma no se puede interpolar: se hace de golpe y se marca con un salto.
      tl.call(() => changeWeapon(view, move.weapon), undefined, at);
      fromTo(
        tl,
        body.scale,
        { y: ESCALA_ACTOR * 0.94 },
        { y: ESCALA_ACTOR, duration, ease: 'back.out(2)' },
        at,
      );
      break;

    case 'projectile': {
      const target = views.get(move.to);
      if (target === undefined) return;
      const bala = makeProjectile();
      bala.alpha = 0;
      mundo.addChild(bala);
      fromTo(
        tl,
        bala,
        { alpha: 1, x: homeX, y: homeY - arriba(70) },
        {
          x: target.actor.home.x * SIZE.width,
          y: target.actor.home.y * SIZE.height - arriba(70),
          rotation: 8,
          duration,
          ease: 'none',
        },
        at,
      );
      tl.set(bala, { alpha: 0 }, at + duration);
      break;
    }

    case 'toss': {
      const perdida = makeProjectile();
      perdida.alpha = 0;
      mundo.addChild(perdida);
      tl.call(() => changeWeapon(view, 'punos'), undefined, at);
      fromTo(
        tl,
        perdida,
        { alpha: 1, x: homeX, y: homeY - arriba(70) },
        {
          x: homeX - view.actor.facing * 80,
          y: homeY - 5,
          rotation: 12,
          duration,
          ease: 'power1.in',
        },
        at,
      );
      break;
    }

    case 'ring': {
      const anillo = makeRing(move.color);
      anillo.x = homeX;
      anillo.y = homeY - arriba(60);
      anillo.alpha = 0;
      mundo.addChild(anillo);
      fromTo(tl, anillo, { alpha: 0.9 }, { alpha: 0, duration, ease: 'power1.out' }, at);
      fromTo(tl, anillo.scale, { x: 0.3, y: 0.3 }, { x: 1.7, y: 1.7, duration }, at);
      break;
    }

    case 'retreat':
      if (menosMovimiento) cortar(tl, root, homeX, at, duration);
      else tl.to(root, { x: homeX, duration, ease: 'power1.out' }, at);
      break;

    // Las caras van por su propia pista (ver `ponerCaras`): un gesto suelto no
    // sabe si el siguiente lo corta.
    case 'face':
      break;

    case 'fall':
      // 0.4 lo dejaba en una mancha sobre el suelo: se ve que esta fuera de
      // combate, pero se sigue reconociendo a quien perdio.
      tl.to(root, { alpha: 0.75, duration }, at);
      // El cuerpo llega al suelo al 78% de la muerte (ver `poses.ts`): ahi tiembla.
      if (!menosMovimiento && view.rig !== null) temblor(tl, mundo, at + duration * 0.78, 10);
      break;
  }
}

/**
 * Cada cambio de cara apaga la que hubiera y enciende la nueva. Con `set`, no
 * con llamadas: GSAP guarda lo que habia y al repetir o saltar hacia atras lo
 * deja como estaba. Con menos movimiento no parpadean, que es un bucle de
 * adorno; los gestos se quedan, porque cuentan lo que pasa.
 *
 * Van en una linea de tiempo aparte, hija de la principal, porque dependen de
 * la velocidad (ver `pistaDeCaras`): al cambiarla se tira y se monta otra.
 */
function lineaDeCaras(
  views: Map<string, ActorView>,
  scene: Scene,
  menosMovimiento: boolean,
  velocidad: number,
): gsap.core.Timeline {
  const linea = gsap.timeline();
  const pistas = pistaDeCaras(scene, { parpadeo: !menosMovimiento, escala: velocidad });
  for (const [id, cambios] of pistas) {
    const caras = views.get(id)?.rig?.caras;
    if (caras === undefined) continue;
    // Se parte de la neutral: es lo que los `set` apuntan como estado de antes.
    for (const [nombre, cara] of caras) cara.alpha = nombre === 'neutral' ? 1 : 0;
    let actual = caras.get('neutral');
    for (const { at, cara } of cambios) {
      const nueva = caras.get(cara);
      if (nueva === undefined || nueva === actual) continue;
      if (actual !== undefined) linea.set(actual, { alpha: 0 }, at);
      linea.set(nueva, { alpha: 1 }, at);
      actual = nueva;
    }
  }
  return linea;
}

/** Como rehacer las caras de cada linea de tiempo a otra velocidad. */
const rehacerCaras = new WeakMap<gsap.core.Timeline, (velocidad: number) => void>();

/**
 * Cambia la velocidad del combate. Usar esto y no `timeScale` a pelo: las
 * caras tienen que rehacerse para seguir durando lo mismo en tiempo real.
 */
export function ajustarVelocidad(tl: gsap.core.Timeline, velocidad: number): void {
  tl.timeScale(velocidad);
  rehacerCaras.get(tl)?.(velocidad);
}

/** Las barras del marcador, que vive en el DOM y no en el lienzo. */
export interface Marcador {
  A: HTMLElement | null;
  B: HTMLElement | null;
}

export function buildTimeline(
  stage: Container,
  scene: Scene,
  onPie: (pie: Pie) => void,
  marcador: Marcador,
  opciones: { menosMovimiento?: boolean } = {},
): gsap.core.Timeline {
  // El mundo tiembla con los golpes; los carteles, encima y quietos.
  const mundo = new Container();
  const carteles = new Container();
  stage.addChild(mundo, carteles);
  const escena: Escena = { mundo, carteles, menosMovimiento: opciones.menosMovimiento ?? false };

  // El fondo se pasa del lienzo por todos los lados, o el temblor destapa una
  // franja del color de la pagina. Se agranda desde la linea del suelo, que
  // es el unico punto que no puede moverse: ahi apoyan los pies.
  const fondo = new Container();
  fondo.addChild(drawEscenario(scene.escenario), drawGround());
  fondo.pivot.set(SIZE.width / 2, SUELO);
  fondo.position.set(SIZE.width / 2, SUELO);
  fondo.scale.set(1.03);
  mundo.addChild(fondo);

  const views = new Map<string, ActorView>();
  for (const actor of scene.actors) {
    const view = drawActor(actor);
    if (actor.id === 'A' || actor.id === 'B') view.hpDom = marcador[actor.id];
    view.root.alpha = 0;
    mundo.addChild(view.root);
    views.set(actor.id, view);
  }

  const timeline = gsap.timeline();
  for (const beat of scene.beats) {
    const pie = beat.pie;
    // Al saltar al final, GSAP dispara las llamadas que cruza, y cada pie va
    // entero: basta el ultimo para que el pie siga al dia. Al repetir no las
    // dispara: de eso se encarga el reproductor.
    if (pie !== null) timeline.call(() => onPie(pie), undefined, beat.at);
    for (const move of beat.moves) addMove(timeline, views, escena, move, beat.at, beat.duration);
  }
  let caras = lineaDeCaras(views, scene, escena.menosMovimiento, 1);
  timeline.add(caras, 0);
  let velocidadDeCaras = 1;
  rehacerCaras.set(timeline, (velocidad) => {
    if (velocidad === velocidadDeCaras) return;
    velocidadDeCaras = velocidad;
    timeline.remove(caras);
    caras.kill();
    caras = lineaDeCaras(views, scene, escena.menosMovimiento, velocidad);
    timeline.add(caras, 0);
    // Pausada o acabada, la principal no vuelve a pintar sola: se lleva la
    // nueva al punto donde va, o el ganador perderia la risa al cambiar.
    caras.totalTime(Math.min(timeline.time(), caras.duration()));
  });

  return timeline;
}
