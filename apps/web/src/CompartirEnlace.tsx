/**
 * Compartir un enlace es como crece el juego (combates y reclutamientos). En el
 * movil va al menu de compartir y en escritorio copia; las dos dicen que ha
 * pasado. Antes se copiaba en silencio y no se sabia si habia funcionado.
 */
import { useState, type ReactNode } from 'react';
import { Boton } from './ui.js';

/** En movil abre el menu de compartir (WhatsApp, notas...). En escritorio casi nunca existe. */
const puedeCompartir = (): boolean => typeof navigator.share === 'function';

export function CompartirEnlace({
  url,
  titulo,
  texto,
  dondeCopiar,
  children,
}: {
  url: string;
  /** Lo que ve quien lo recibe en el menu de compartir. */
  titulo: string;
  texto?: string;
  /** Donde esta el enlace a la vista, para cuando no se puede copiar. */
  dondeCopiar: string;
  /** Lo que va en la fila entre el boton y el aviso. */
  children?: ReactNode;
}) {
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  const copiar = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setAviso({ texto: 'Enlace copiado.', error: false });
    } catch {
      setAviso({ texto: `No se ha podido copiar. Cópialo ${dondeCopiar}.`, error: true });
    }
  };

  const compartir = async (): Promise<void> => {
    try {
      await navigator.share({ title: titulo, text: texto, url });
    } catch (e) {
      // Cerrar el menu de compartir no es un error: no se dice nada.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      await copiar();
    }
  };

  return (
    <>
      {puedeCompartir() ? (
        <Boton onClick={() => void compartir()}>Compartir</Boton>
      ) : (
        <Boton onClick={() => void copiar()}>Copiar enlace</Boton>
      )}
      {/* El aviso va al final de la fila: delante empujaria lo de al lado. */}
      {children}
      <span className={aviso?.error === true ? 'error' : 'apagado'} aria-live="polite">
        {aviso?.texto ?? ''}
      </span>
    </>
  );
}
