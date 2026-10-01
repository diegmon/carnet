import type { Acceso } from './ui/Sesion';

interface GoogleId {
  accounts: { id: {
    initialize(o: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void;
    renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    prompt(): void;
  } };
}

let carga: Promise<GoogleId> | undefined;
function cargarGoogle(): Promise<GoogleId> {
  carga ??= new Promise((resolver, rechazar) => {
    const w = window as unknown as { google?: GoogleId };
    if (w.google) return resolver(w.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (w.google ? resolver(w.google) : rechazar(new Error('Google no respondió')));
    s.onerror = () => { carga = undefined; rechazar(new Error('Sin señal para iniciar sesión')); };
    document.head.appendChild(s);
  });
  return carga;
}

/** Botón oficial "Continuar con Google". El token (credential) lo verifica el receptor. */
export function accesoGoogle(clientId: string): Acceso {
  let alRecibir: (jwt: string) => void = () => undefined;
  return {
    mostrarBoton(contenedor, recibir) {
      alRecibir = recibir;
      cargarGoogle().then(g => {
        g.accounts.id.initialize({ client_id: clientId, callback: r => alRecibir(r.credential), auto_select: true });
        g.accounts.id.renderButton(contenedor, { theme: 'outline', size: 'large', text: 'continue_with', locale: 'es-419', width: 280 });
      }, e => {
        contenedor.textContent = (e as Error).message;
      });
    },
    renovar(recibir) {
      alRecibir = recibir;
      cargarGoogle().then(g => {
        g.accounts.id.initialize({ client_id: clientId, callback: r => alRecibir(r.credential), auto_select: true });
        g.accounts.id.prompt();
      }, () => undefined);
    },
  };
}

/** Solo para pruebas locales (VITE_ACCESO_PRUEBA=1): crea un token SIN firma; el receptor real lo rechaza. */
export function accesoPrueba(): Acceso {
  return {
    mostrarBoton(contenedor, recibir) {
      const correo = document.createElement('input');
      correo.placeholder = 'correo de prueba';
      correo.setAttribute('aria-label', 'Correo de prueba');
      const b = document.createElement('button');
      b.textContent = 'Entrar como prueba';
      b.onclick = () => {
        const b64 = (o: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        recibir(`${b64({ alg: 'none' })}.${b64({ email: correo.value, name: correo.value, exp: Math.floor(Date.now() / 1000) + 3600, email_verified: true })}.prueba`);
      };
      contenedor.append(correo, b);
    },
  };
}
