/**
 * La tarjeta del enlace de recuperacion. Es lo unico que ata un peleon a quien
 * lo creo fuera de este navegador, y el servidor no lo vuelve a dar: perderlo
 * de un toque o de una recarga era demasiado facil.
 */
import { useRef, useState } from 'react';
import { Boton, Tarjeta } from './ui.js';
import type { EnlacePendiente } from './enlacesPendientes.js';

type Aviso = { texto: string; error: boolean } | null;

/** En movil abre el menu de compartir (WhatsApp, notas...). En escritorio casi nunca existe. */
const puedeCompartir = (): boolean => typeof navigator.share === 'function';

export function EnlaceRecuperacion({
  enlace,
  onGuardado,
}: {
  enlace: EnlacePendiente;
  onGuardado: () => void;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmando, setConfirmando] = useState(false);
  const texto = useRef<HTMLElement>(null);

  // Si el portapapeles falla (sin permiso, http), al menos queda seleccionado.
  const seleccionar = (): void => {
    const nodo = texto.current;
    const sel = window.getSelection();
    if (nodo === null || sel === null) return;
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    sel.removeAllRanges();
    sel.addRange(rango);
  };

  const copiar = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(enlace.url);
      setAviso({ texto: 'Copiado. Pégalo donde no se te pierda.', error: false });
    } catch {
      seleccionar();
      setAviso({
        texto: 'No se ha podido copiar. Está seleccionado: cópialo a mano.',
        error: true,
      });
    }
  };

  const compartir = async (): Promise<void> => {
    try {
      await navigator.share({
        title: `Enlace de ${enlace.nombre}`,
        text: `Con este enlace recupero a ${enlace.nombre} en Camorra:`,
        url: enlace.url,
      });
      setAviso({ texto: 'Enviado. Si lo tienes a mano, ya puedes cerrar esto.', error: false });
    } catch (e) {
      // Cerrar el menu de compartir no es un error: no se dice nada.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      await copiar();
    }
  };

  return (
    <Tarjeta hundida>
      <h2 className="enlace-titulo">Guarda este enlace</h2>
      <p className="apagado">
        Es la única forma de recuperar a <strong>{enlace.nombre}</strong> en otro navegador. No se
        vuelve a enseñar.
      </p>
      <code ref={texto} className="enlace-url">
        {enlace.url}
      </code>
      {/* Al confirmar solo quedan las dos respuestas: cuatro botones en 360 px no caben. */}
      <div className="fila enlace-acciones">
        {confirmando ? (
          <>
            <Boton onClick={onGuardado}>Sí, ya está guardado</Boton>
            <Boton tipo="principal" onClick={() => setConfirmando(false)}>
              Todavía no
            </Boton>
          </>
        ) : (
          <>
            {puedeCompartir() ? (
              <>
                <Boton tipo="principal" onClick={() => void compartir()}>
                  Enviármelo
                </Boton>
                <Boton onClick={() => void copiar()}>Copiar</Boton>
              </>
            ) : (
              <Boton tipo="principal" onClick={() => void copiar()}>
                Copiar
              </Boton>
            )}
            <Boton onClick={() => setConfirmando(true)}>Ya lo tengo</Boton>
          </>
        )}
      </div>
      {/* Un solo hueco anunciado: copiar, compartir y la confirmacion hablan aqui. */}
      <p
        className={aviso?.error === true || confirmando ? 'ayuda error' : 'ayuda apagado'}
        aria-live="polite"
      >
        {confirmando
          ? 'Si lo cierras sin guardarlo, no hay forma de volver a verlo.'
          : (aviso?.texto ?? '')}
      </p>
    </Tarjeta>
  );
}
