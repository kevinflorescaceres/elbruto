/**
 * El boton de la beta, en la barra de madera de cada pantalla: contar un fallo
 * sin buscar donde y sin quitarle sitio al juego. El reporte se guarda en la BD y avisa por ntfy; la
 * pagina y el tamano de pantalla van solos, para no pedirselos al jugador.
 */
import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { api } from './api.js';

export function ReportarProblema() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const { pathname, search } = useLocation();
  const [mensaje, setMensaje] = useState('');
  const [contacto, setContacto] = useState('');

  const enviar = useMutation({
    mutationFn: () =>
      api.feedback({
        message: mensaje,
        page: pathname + search,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...(contacto.trim() === '' ? {} : { contact: contacto }),
      }),
    onSuccess: () => {
      setMensaje('');
      setContacto('');
    },
  });

  const abrir = () => {
    enviar.reset();
    dialogo.current?.showModal();
  };
  const cerrar = () => dialogo.current?.close();

  return (
    <>
      <button type="button" className="boton reportar" onClick={abrir}>
        <span aria-hidden="true">⚑ </span>
        Reportar<span className="solo-ancho"> un problema</span>
      </button>

      <dialog ref={dialogo} className="reporte" aria-labelledby="reporte-titulo">
        <h2 id="reporte-titulo">Reportar un problema</h2>
        {enviar.isSuccess ? (
          <>
            <p>Recibido. Gracias por ayudar a pulir el juego.</p>
            <div className="reporte-acciones">
              <button type="button" className="boton principal" onClick={cerrar} autoFocus>
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar.mutate();
            }}
          >
            <label htmlFor="reporte-mensaje">Qué ha pasado</label>
            <textarea
              id="reporte-mensaje"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Qué hacías, qué esperabas y qué ocurrió en cambio"
              required
              autoFocus
            />
            <label htmlFor="reporte-contacto">
              Correo o usuario para responderte <span className="apagado">(opcional)</span>
            </label>
            <input
              id="reporte-contacto"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              maxLength={200}
              autoComplete="email"
            />
            <p className="apagado reporte-nota">
              Se envía también la página en la que estás y el tamaño de tu pantalla.
            </p>
            {enviar.isError && (
              <p className="reporte-error" role="alert">
                {enviar.error.message}
              </p>
            )}
            <div className="reporte-acciones">
              <button type="button" className="boton" onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="submit"
                className="boton principal"
                disabled={mensaje.trim().length < 5 || enviar.isPending}
              >
                {enviar.isPending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
