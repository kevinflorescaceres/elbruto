import { describe, expect, it } from 'vitest';
import {
  anadirPendiente,
  leerPendientes,
  marcarGuardado,
  quitarPendiente,
  sinGuardar,
} from './enlacesPendientes.js';

function memoria() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
}

const ana = { slug: 'ana', nombre: 'Ana', url: 'https://x/claim/1' };
const leo = { slug: 'leo', nombre: 'Leo', url: 'https://x/claim/2' };

describe('enlaces pendientes', () => {
  it('copiarlo deja pelear a ese y solo a ese, sin quitarlo de la lista', () => {
    const almacen = memoria();
    anadirPendiente(ana, almacen);
    anadirPendiente(leo, almacen);
    expect(sinGuardar('ana', leerPendientes(almacen))).toBe(true);

    const lista = marcarGuardado('ana', almacen);
    expect(sinGuardar('ana', lista)).toBe(false);
    expect(sinGuardar('leo', lista)).toBe(true);
    // Sigue en la lista hasta que el jugador cierre la tarjeta.
    expect(leerPendientes(almacen).map((e) => e.slug)).toEqual(['leo', 'ana']);
    // Un peleon sin enlace pendiente (creado en otro navegador) no se bloquea.
    expect(sinGuardar('otro', lista)).toBe(false);
  });

  it('guarda varios, el ultimo primero, y no pierde el anterior al crear otro', () => {
    const m = memoria();
    anadirPendiente(ana, m);
    expect(anadirPendiente(leo, m)).toEqual([leo, ana]);
    expect(leerPendientes(m)).toEqual([leo, ana]);
  });

  it('quita solo el que se da por guardado', () => {
    const m = memoria();
    anadirPendiente(ana, m);
    anadirPendiente(leo, m);
    expect(quitarPendiente('ana', m)).toEqual([leo]);
    expect(quitarPendiente('leo', m)).toEqual([]);
    expect(m.getItem('camorra:enlaces-pendientes')).toBeNull();
  });

  it('no revienta con datos corruptos ni sin almacen', () => {
    const m = memoria();
    m.setItem('camorra:enlaces-pendientes', '{no es json');
    expect(leerPendientes(m)).toEqual([]);
    m.setItem('camorra:enlaces-pendientes', JSON.stringify([ana, { slug: 1 }]));
    expect(leerPendientes(m)).toEqual([ana]);
    expect(leerPendientes(null)).toEqual([]);
    expect(anadirPendiente(ana, null)).toEqual([ana]);
  });

  it('sobrevive a un almacen que lanza', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(leerPendientes(roto)).toEqual([]);
    expect(anadirPendiente(ana, roto)).toEqual([ana]);
  });
});
