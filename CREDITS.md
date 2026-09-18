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

Ninguna. La interfaz usa la tipografía del sistema (`system-ui`), que no requiere
licencia. **Si se añade una fuente web, hay que anotarla aquí con su licencia
verificada** (por ejemplo SIL Open Font License) antes de publicarla.

## Arte

Las rutas SVG de `apps/web/src/art/parts.ts` y las animaciones de `poses.ts` están
dibujadas y escritas para este proyecto. Estilo cartoon de trazo grueso y color
plano, con una paleta propia.
