import { expect, test, type Page } from '@playwright/test';

/** Nombres nuevos en cada ejecucion, por si queda algo en la base. */
const nombre = (prefijo: string): string => `${prefijo} ${Math.random().toString(36).slice(2, 7)}`;

async function crearPeleon(page: Page, prefijo: string): Promise<string> {
  const suyo = nombre(prefijo);
  await page.goto('/');
  await page.getByLabel('Nombre del peleon').fill(suyo);
  await page.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText('Guarda este enlace')).toBeVisible();
  await expect(page.getByRole('button', { name: suyo })).toBeVisible();
  return suyo;
}

/** Espera a que la ficha termine de cargar y dice que se puede hacer ahora. */
async function estadoFicha(page: Page): Promise<'pelear' | 'mejorar'> {
  await expect(page.getByRole('link', { name: /Buscar pelea|Elegir mejora/ })).toBeVisible();
  return (await page.getByRole('link', { name: 'Elegir mejora' }).isVisible())
    ? 'mejorar'
    : 'pelear';
}

test('el ciclo completo se juega en el navegador', async ({ browser }) => {
  // Dos navegadores: peleones del mismo dueno no pueden enfrentarse.
  const mio = await browser.newContext();
  const suyo = await browser.newContext();
  const paginaMia = await mio.newPage();
  const paginaSuya = await suyo.newPage();

  await crearPeleon(paginaSuya, 'Rival');
  const propio = await crearPeleon(paginaMia, 'Peleon');

  await paginaMia.getByRole('button', { name: propio }).click();
  await expect(paginaMia.getByRole('heading', { name: propio })).toBeVisible();
  await expect(paginaMia.getByRole('img', { name: 'Retrato del peleon' })).toBeVisible();

  // Perder da 1 XP y ganar 2: cinco peleas suben de nivel pase lo que pase.
  let peleas = 0;
  while ((await estadoFicha(paginaMia)) === 'pelear' && peleas < 5) {
    await paginaMia.getByRole('link', { name: 'Buscar pelea' }).click();

    const rivales = paginaMia.locator('.rejilla button');
    await expect(rivales.first()).toBeVisible();
    await rivales.first().click();

    await expect(paginaMia).toHaveURL(/\/fight\//);
    await expect(paginaMia.locator('canvas')).toBeVisible();
    await paginaMia.getByRole('button', { name: 'Ir al final' }).click();
    // El pie de escena del player: "Gana" vive en el log de texto, que va plegado.
    await expect(paginaMia.getByText(/Se acabo en \d+ turnos/)).toBeVisible();
    peleas += 1;

    await paginaMia
      .getByRole('link', { name: new RegExp(propio) })
      .first()
      .click();
    await expect(paginaMia.getByRole('heading', { name: propio })).toBeVisible();
  }

  expect(peleas).toBeGreaterThan(0);
  expect(await estadoFicha(paginaMia)).toBe('mejorar');

  await paginaMia.getByRole('link', { name: 'Elegir mejora' }).click();
  await expect(paginaMia.getByRole('heading', { name: /^Nivel 2$/ })).toBeVisible();

  const opciones = paginaMia.locator('.rejilla button');
  await expect(opciones).toHaveCount(2);
  await opciones.first().click();

  await expect(paginaMia.getByRole('heading', { name: propio })).toBeVisible();
  await expect(paginaMia.getByText(/Nivel 2 ·/)).toBeVisible();
  expect(await estadoFicha(paginaMia)).toBe('pelear');

  // La repeticion es publica: se ve sin la cookie del dueno.
  await paginaMia
    .getByRole('link', { name: /Gano|Perdio/ })
    .first()
    .click();
  await expect(paginaMia).toHaveURL(/\/fight\//);

  const anonimo = await browser.newContext();
  const paginaAnonima = await anonimo.newPage();
  await paginaAnonima.goto(paginaMia.url());
  await expect(paginaAnonima.locator('canvas')).toBeVisible();
  await expect(paginaAnonima.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
});
