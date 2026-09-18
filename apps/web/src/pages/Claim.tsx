import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
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
      <main>
        <h1>Ese enlace no vale</h1>
        <p className="apagado">O esta mal copiado, o el peleon ya no existe.</p>
        <Link to="/">Volver</Link>
      </main>
    );

  return <main className="apagado">Recuperando tu peleon...</main>;
}
