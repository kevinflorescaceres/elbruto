import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from './pages/Home.js';
import { BrutePage } from './pages/Brute.js';
import { ArenaPage } from './pages/Arena.js';
import { LevelUpPage } from './pages/LevelUp.js';
import { FightPage } from './pages/Fight.js';
import { ClaimPage } from './pages/Claim.js';
import { LegalPage } from './pages/Legal.js';
import { RankingPage } from './pages/Ranking.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import './styles.css';

// Un 403 o un 404 no se arreglan repitiendo la peticion.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function NotFound() {
  return (
    <main>
      <h1>Por aqui no hay nada</h1>
      <a href="/">Volver al principio</a>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/b/:slug" element={<BrutePage />} />
            <Route path="/b/:slug/arena" element={<ArenaPage />} />
            <Route path="/b/:slug/level-up" element={<LevelUpPage />} />
            <Route path="/fight/:id" element={<FightPage />} />
            <Route path="/claim/:token" element={<ClaimPage />} />
            <Route path="/reclutar/:slug" element={<Home />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
