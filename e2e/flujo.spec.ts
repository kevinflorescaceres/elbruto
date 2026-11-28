import { expect, test, type Page } from '@playwright/test';

/** Nombres nuevos en cada ejecucion, por si queda algo en la base. */
const nombre = (prefijo: string): string => `${prefijo} ${Math.random().toString(36).slice(2, 7)}`;

async function crearPeleon(
  page: Page,
  prefijo: string,
  sexo: 'Hombre' | 'Mujer' = 'Hombre',
): Promise<string> {
  const suyo = nombre(prefijo);
  await page.goto('/');
  await page.getByLabel('Nombre del peleón').fill(suyo);
  // Sin sexo elegido no se crea: ninguna opcion viene marcada de entrada.
  await expect(page.getByRole('button', { name: 'Crear' })).toBeDisabled();
  await expect(page.getByText('Elige si es hombre o mujer.')).toBeVisible();
  // La vista previa ensena las dos figuras hasta que se elige, y una despues.
  await expect(page.locator('.nombre-vista svg')).toHaveCount(2);
  await page.getByRole('radio', { name: sexo }).click();
  await expect(page.locator('.nombre-vista svg')).toHaveCount(1);
  await expect(page.getByRole('radio', { name: sexo })).toHaveAttribute('aria-checked', 'true');
  // Elegido el sexo, ya es un peleon concreto: la etiqueta concuerda.
  await expect(
    page.getByLabel(sexo === 'Mujer' ? 'Nombre de la peleona' : 'Nombre del peleón'),
  ).toHaveValue(suyo);
  await page.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText('Guarda este enlace')).toBeVisible();
  await expect(page.getByRole('heading', { name: `Aquí está ${suyo}` })).toBeVisible();
  // Sin guardar el enlace de recuperacion no se pelea: es lo unico irreparable.
  await expect(page.getByRole('button', { name: 'Buscar pelea' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Buscar pelea' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copiar', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Buscar pelea' })).toBeVisible();
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
  // Con portapapeles: copiar el enlace de recuperacion es lo que deja pelear.
  const permisos = { permissions: ['clipboard-read', 'clipboard-write'] };
  const mio = await browser.newContext(permisos);
  const suyo = await browser.newContext(permisos);
  const paginaMia = await mio.newPage();
  const paginaSuya = await suyo.newPage();

  await crearPeleon(paginaSuya, 'Rival', 'Mujer');
  const propio = await crearPeleon(paginaMia, 'Peleon');

  await paginaMia.getByRole('link', { name: 'Ver su ficha' }).click();
  // Primero la URL: la portada tambien tiene un titulo con el nombre ("Aqui esta
  // ..."), y sin esto el expect siguiente podia darse por bueno antes de navegar.
  await expect(paginaMia).toHaveURL(/\/b\//);
  await expect(paginaMia.getByRole('heading', { name: propio })).toBeVisible();
  await expect(paginaMia.getByRole('img', { name: 'Retrato del peleón' })).toBeVisible();

  // Perder da 1 XP y ganar 2: cinco peleas suben de nivel pase lo que pase.
  let peleas = 0;
  while ((await estadoFicha(paginaMia)) === 'pelear' && peleas < 5) {
    await paginaMia.getByRole('link', { name: 'Buscar pelea' }).click();

    const rivales = paginaMia.locator('.rejilla button');
    await expect(rivales.first()).toBeVisible();
    // Tocar elige; pelear es otro gesto, para que un scroll no lance una pelea.
    await rivales.first().click();
    await expect(paginaMia).toHaveURL(/\/arena$/);
    await paginaMia.getByRole('button', { name: /^Pelear contra / }).click();

    await expect(paginaMia).toHaveURL(/\/fight\//);
    await expect(paginaMia.locator('canvas')).toBeVisible();
    await paginaMia.getByRole('button', { name: 'Ir al final' }).click();
    // El pie se queda con la ultima accion; los turnos van en la tarjeta final.
    await expect(paginaMia.locator('.fin-turnos')).toHaveText(/^Tras \d+ turnos?\.$/);
    await expect(paginaMia.locator('.combate-pie')).not.toHaveText(/Se acabó/);
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
  await paginaMia.getByRole('button', { name: /^Quedarme con / }).click();

  await expect(paginaMia.getByRole('heading', { name: propio })).toBeVisible();
  await expect(paginaMia.getByText(/Nivel 2 ·/)).toBeVisible();
  expect(await estadoFicha(paginaMia)).toBe('pelear');

  // La repeticion es publica: se ve sin la cookie del dueno.
  await paginaMia
    .getByRole('link', { name: /Ganó|Perdió/ })
    .first()
    .click();
  await expect(paginaMia).toHaveURL(/\/fight\//);

  const anonimo = await browser.newContext();
  const paginaAnonima = await anonimo.newPage();
  await paginaAnonima.goto(paginaMia.url());
  await expect(paginaAnonima.locator('canvas')).toBeVisible();
  await expect(paginaAnonima.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
});

test('una luchadora se crea como mujer y su ficha lo dice', async ({ browser }) => {
  const contexto = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await contexto.newPage();
  const suya = await crearPeleon(page, 'Peleona', 'Mujer');

  await page.getByRole('link', { name: 'Ver su ficha' }).click();
  await expect(page).toHaveURL(/\/b\//);
  await expect(page.getByRole('heading', { name: suya })).toBeVisible();
  await expect(page.getByLabel('Retrato de la peleona').first()).toBeVisible();
});

test('el punto de novedades se apaga al verlas y no vuelve', async ({ page }) => {
  await page.goto('/');
  const enlace = page.getByRole('link', { name: /Novedades/ });
  await expect(enlace).toBeVisible();
  await expect(page.locator('.punto-novedad')).toHaveCount(1);

  await enlace.click();
  await expect(page.getByRole('heading', { name: 'Novedades' })).toBeVisible();
  await expect(page.locator('.punto-novedad')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: /Novedades/ })).toBeVisible();
  await expect(page.locator('.punto-novedad')).toHaveCount(0);
});
