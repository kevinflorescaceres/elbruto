# Créditos y licencias

Todo el contenido de este proyecto —nombres de armas, mañas y bichos, textos de
interfaz y arte vectorial— está creado desde cero para él. No procede de ningún
otro juego.

## Dependencias de terceros

| Recurso                                                                                        | Licencia                                                  | Uso                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| [GSAP](https://gsap.com)                                                                       | [Standard "no charge"](https://gsap.com/standard-license) | Línea de tiempo de la animación del combate |
| [PixiJS](https://pixijs.com)                                                                   | MIT                                                       | Render del combate en canvas/WebGL          |
| [React](https://react.dev) · [React Router](https://reactrouter.com)                           | MIT                                                       | Interfaz y rutas                            |
| [TanStack Query](https://tanstack.com/query)                                                   | MIT                                                       | Caché de peticiones                         |
| [Fastify](https://fastify.dev) y sus plugins                                                   | MIT                                                       | Servidor HTTP                               |
| [Prisma](https://prisma.io)                                                                    | Apache 2.0                                                | Acceso a la base de datos                   |
| [Zod](https://zod.dev)                                                                         | MIT                                                       | Validación de esquemas                      |
| [Vite](https://vite.dev) · [Vitest](https://vitest.dev) · [Playwright](https://playwright.dev) | MIT · MIT · Apache 2.0                                    | Construcción y pruebas                      |

**La licencia de GSAP merece atención.** La _standard license_ permite uso gratuito
en sitios y aplicaciones web, incluidas las comerciales, pero **no** en productos
donde se cobre por el acceso al propio software (suscripción o venta del juego).
Si algún día este proyecto se monetiza así, hay que revisarla y comprar la
licencia de negocio, o sustituir GSAP.

## Tipografías

| Fuente                                                           | Licencia                  | Uso                                                 | Pesos cargados |
| ---------------------------------------------------------------- | ------------------------- | --------------------------------------------------- | -------------- |
| [Alegreya](https://fonts.google.com/specimen/Alegreya)           | SIL Open Font License 1.1 | Títulos, cifras, botones y los carteles del combate | 700, 800       |
| [Alegreya Sans](https://fonts.google.com/specimen/Alegreya+Sans) | SIL Open Font License 1.1 | Texto corrido                                       | 400, 500, 700  |

Ambas son de Juan Pablo del Peral (Huerta Tipográfica). La OFL permite uso web,
comercial incluido, sin coste ni atribución obligatoria en la propia página; esta
tabla la documenta igualmente. Se sirven desde Google Fonts y **solo se cargan
esos cinco pesos**: añadir más engorda la descarga de una pantalla que ya carga
360 kB de PixiJS.

**Si se añade otra fuente, se anota aquí con su licencia verificada antes de
publicarla.**

## Arte

Las rutas SVG de `apps/web/src/art/parts.ts` y las animaciones de `poses.ts` están
dibujadas y escritas para este proyecto. Estilo cartoon de trazo grueso y color
plano, con una paleta propia.
