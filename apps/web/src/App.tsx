import { useEffect, useState } from 'react';
import { healthSchema, type Health } from '@rufianes/shared';

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealth(healthSchema.parse(data)))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Rufianes</h1>
      {error && <p>Servidor no disponible: {error}</p>}
      {health && <p>Servidor OK — motor v{health.engineVersion}</p>}
      {!health && !error && <p>Conectando…</p>}
    </main>
  );
}
