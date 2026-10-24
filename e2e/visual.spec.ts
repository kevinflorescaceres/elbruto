import { expect, test } from '@playwright/test';

/**
 * Capturas base de las paginas que no dependen de datos. Detectan cambios visuales
 * que nadie pidio; no dicen si algo se ve bien, eso lo decide una persona.
 *
 * Solo una tarea de diseño las actualiza (`pnpm e2e --update-snapshots`), y el diff de
 * los PNG en ese commit es lo que se revisa. Se tomaron en la maquina de desarrollo
 * (fuentes, renderizado): en CI no se comparan.
 */
test.skip(!!process.env['CI'], 'Las capturas base son de la maquina de desarrollo');

const paginas = [
  // Sin cookie: la lista propia sale vacia, y no depende de la base.
  { nombre: 'portada', ruta: '/', listo: 'Todavía no tienes ninguno.' },
  { nombre: 'legal', ruta: '/legal', listo: 'Condiciones y privacidad' },
];

for (const { nombre, ruta, listo } of paginas) {
  for (const ancho of [360, 1280]) {
    test(`${nombre} a ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto(ruta);
      await expect(page.getByText(listo).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`${nombre}-${ancho}.png`, { fullPage: true });
    });
  }
}
