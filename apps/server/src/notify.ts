/**
 * Aviso al movil de cada reporte de la beta, por ntfy (https://ntfy.sh).
 *
 * NTFY_URL es la URL entera del tema (`https://ntfy.sh/<tema>`). Va como secreto:
 * en ntfy.sh cualquiera que sepa el tema lee los mensajes. Sin la variable no
 * se avisa y ya: el reporte esta guardado en la BD igual.
 */

export interface Aviso {
  message: string;
  page: string;
  contact?: string | undefined;
}

export async function avisarReporte(
  aviso: Aviso,
  url = process.env.NTFY_URL,
  base = process.env.PUBLIC_URL,
): Promise<void> {
  if (url === undefined || url === '') return;

  const lineas = [aviso.message, '', `Pagina: ${aviso.page}`];
  if (aviso.contact !== undefined && aviso.contact !== '')
    lineas.push(`Contacto: ${aviso.contact}`);

  // Las cabeceras solo admiten latin-1: el texto del jugador va en el cuerpo.
  const headers: Record<string, string> = { Title: 'Camorra: reporte de la beta', Tags: 'bug' };
  if (base !== undefined && base !== '') headers.Click = new URL(aviso.page, base).toString();

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: lineas.join('\n'),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`ntfy respondio ${res.status}`);
}
