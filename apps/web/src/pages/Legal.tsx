import { Link } from 'react-router';

/** Textos exigidos por plan.md §11 antes de publicar. */
export function LegalPage() {
  return (
    <main>
      <p className="apagado">
        <Link to="/">← Volver</Link>
      </p>

      <h1>Condiciones y privacidad</h1>

      <h2>Qué es esto</h2>
      <p>
        Un juego de peleas automáticas. Escribes un nombre, se genera un peleón y se enfrenta solo a
        los de otra gente. No se compra ni se vende nada.
      </p>

      <h2>Qué guardamos</h2>
      <p>
        No hay registro ni contraseñas, y no pedimos tu correo. Al entrar se crea una cookie con un
        identificador aleatorio que sirve para reconocer cuáles son tus peleones. Es la única cookie
        que ponemos: no hay analítica ni publicidad ni seguimiento entre sitios. En el servidor solo
        se guarda un resumen criptográfico de ese identificador, nunca el valor en claro.
      </p>
      <p>
        Además guardamos lo que creas: el nombre de tus peleones, sus estadísticas y sus combates.
        Los perfiles y los combates son <strong>públicos</strong>: cualquiera con el enlace puede
        verlos.
      </p>
      <p>
        Si borras la cookie y no guardaste el enlace de recuperación, pierdes el acceso a tus
        peleones. No hay forma de recuperarlos: no sabemos quién eres.
      </p>

      <h2>Nombres</h2>
      <p>
        El nombre lo eliges tú. No uses nombres de personas reales, marcas registradas ni personajes
        ajenos, ni nada insultante. Podemos renombrar o borrar cualquier peleón que incumpla esto,
        sin aviso previo.
      </p>
      <p>
        Desde la ficha de cualquier peleón hay un enlace para denunciarlo. También puedes
        escribirnos directamente.
      </p>

      <h2>Retiradas y contacto</h2>
      <p>
        Si eres titular de un derecho y un contenido de aquí lo vulnera, o quieres que borremos un
        peleón, escríbenos y lo atendemos:
      </p>
      <p>
        {/* TODO: poner una dirección real antes de desplegar (plan.md §11). */}
        <strong>CORREO_DE_CONTACTO_PENDIENTE</strong>
      </p>

      <h2>Sin garantías</h2>
      <p>
        El servicio se ofrece tal cual. Puede caerse, cambiar o cerrar en cualquier momento, y los
        datos podrían perderse. Es un proyecto pequeño, no un servicio con soporte.
      </p>

      <h2>Inspiración</h2>
      <p>
        Las mecánicas se inspiran en los juegos de combate automático por turnos. Todo el contenido
        —nombres, textos y dibujos— es original de este proyecto y no procede de ningún otro juego.
      </p>
    </main>
  );
}
