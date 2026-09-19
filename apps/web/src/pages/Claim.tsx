import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Pagina } from '../ui.js';
import { api } from '../api.js';

export function ClaimPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const claim = useMutation({
    mutationFn: () => api.claim(token),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await navigate(`/b/${data.brute.slug}`);
    },
  });

  const { mutate } = claim;
  useEffect(() => mutate(), [mutate]);

  if (claim.error)
    return (
      <Pagina>
        <h1>Ese enlace no vale</h1>
        <p className="apagado">O está mal copiado, o el peleón ya no existe.</p>
        <Link to="/">Volver</Link>
      </Pagina>
    );

  return (
    <Pagina>
      <p className="apagado">Recuperando tu peleón...</p>
    </Pagina>
  );
}
