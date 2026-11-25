/**
 * El enlace de recuperacion. Antes reclamaba nada mas abrirse: quien lo abria en
 * otro navegador (otro movil, el navegador de dentro de WhatsApp al comprobar
 * que se habia guardado) se llevaba el peleon alli sin saberlo, y desaparecia de
 * donde se jugaba. Ahora ensena cual es y mover es un gesto aparte.
 */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Boton, Pagina, Tarjeta } from '../ui.js';
import { api, ApiError } from '../api.js';
import { armaVisible, Fighter } from '../art/Fighter.js';

export function ClaimPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const vista = useQuery({
    queryKey: ['claim', token],
    queryFn: () => api.claimPreview(token),
    retry: false,
  });

  const claim = useMutation({
    mutationFn: () => api.claim(token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await navigate(`/b/${data.brute.slug}`, { replace: true });
    },
  });

  // Ya es de este navegador: no hay nada que preguntar.
  const yaTuyo = vista.data?.tuyo === true ? vista.data.brute.slug : null;
  useEffect(() => {
    if (yaTuyo !== null) void navigate(`/b/${yaTuyo}`, { replace: true });
  }, [yaTuyo, navigate]);

  if (vista.error instanceof ApiError && vista.error.status === 404)
    return (
      <Pagina cabecera={{ titulo: 'Ese enlace no vale' }}>
        <p className="apagado">O está mal copiado, o el peleón ya no existe.</p>
        <Link to="/">Volver</Link>
      </Pagina>
    );

  if (vista.error)
    return (
      <Pagina cabecera={{ titulo: 'Recuperar peleón' }}>
        <p className="apagado">No se ha podido contactar con el servidor.</p>
        <Boton onClick={() => void vista.refetch()}>Reintentar</Boton>
      </Pagina>
    );

  if (vista.data === undefined || yaTuyo !== null)
    return (
      <Pagina cabecera={{ titulo: 'Recuperar peleón' }}>
        <p className="apagado">Buscando tu peleón…</p>
      </Pagina>
    );

  const b = vista.data.brute;
  return (
    <Pagina cabecera={{ titulo: 'Recuperar peleón' }}>
      <Tarjeta>
        <div className="recuperar">
          <Fighter
            appearance={b.appearance}
            slug={b.slug}
            weapon={armaVisible(b.weapons)}
            height={120}
          />
          <div>
            <h2>¿Traer a {b.name} a este navegador?</h2>
            <p className="apagado">
              Nivel {b.level}. Pasará a jugarse desde aquí y dejará de estar en el navegador donde
              lo tengas ahora.
            </p>
          </div>
        </div>
        <div className="fila">
          <Boton tipo="principal" onClick={() => claim.mutate()} disabled={claim.isPending}>
            Traerlo aquí
          </Boton>
          <Link to={`/b/${b.slug}`}>No, solo quería verlo</Link>
        </div>
        {claim.error && (
          <p className="ayuda error" role="alert">
            {claim.error.message}
          </p>
        )}
      </Tarjeta>
    </Pagina>
  );
}
