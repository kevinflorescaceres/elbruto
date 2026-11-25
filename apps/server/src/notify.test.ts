import { afterEach, describe, expect, it, vi } from 'vitest';
import { avisarReporte } from './notify.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('avisarReporte', () => {
  it('sin NTFY_URL no llama a nadie', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await avisarReporte({ message: 'algo falla', page: '/' }, '');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('manda el texto en el cuerpo y enlaza a la pagina', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);

    await avisarReporte(
      { message: 'El combate se congela', page: '/fight/abc', contact: 'yo@ejemplo.cl' },
      'https://ntfy.sh/tema',
      'https://camorra.example',
    );

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://ntfy.sh/tema');
    expect(init.body).toContain('El combate se congela');
    expect(init.body).toContain('Contacto: yo@ejemplo.cl');
    expect(init.headers.Click).toBe('https://camorra.example/fight/abc');
  });

  it('un error de ntfy se propaga para que lo registre quien llama', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(
      avisarReporte({ message: 'x', page: '/' }, 'https://ntfy.sh/tema'),
    ).rejects.toThrow('500');
  });
});
