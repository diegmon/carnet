import { render } from 'preact';
import { App } from './ui/App';
import { Motor } from './estado/motor';
import type { Persistencia } from './estado/persistencia';
import type { ConfigApp } from './config';
import { clienteHttp, ClienteReceptor } from './estado/cliente';
import { Sincronizador } from './estado/sincronizador';
import { subirFotosPendientes } from './estado/fotos-envio';
import { tokenVigente } from './estado/sesion-google';
import type { Acceso } from './ui/Sesion';
import { accesoGoogle, accesoPrueba } from './acceso-google';
import { PERFIL } from '../../src/dominio/perfil';

type Reloj = Pick<typeof globalThis, 'setInterval' | 'clearInterval' | 'setTimeout' | 'clearTimeout'>;

/** Cuándo intentar enviar: al iniciar, al volver la señal, cada cierto tiempo y poco después de capturar. */
export function programarSincronizacion(
  sinc: () => void,
  opciones: {
    cadaMs?: number; ventana?: Pick<Window, 'addEventListener' | 'removeEventListener'>; reloj?: Reloj;
    documento?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  } = {},
): { cambioLocal(): void; detener(): void } {
  const reloj = opciones.reloj ?? globalThis;
  const ventana = opciones.ventana ?? window;
  const alVolver = () => sinc();
  ventana.addEventListener('online', alVolver);
  const documento = opciones.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const alMostrar = () => { if (documento?.visibilityState === 'visible') sinc(); };
  documento?.addEventListener('visibilitychange', alMostrar);
  const intervalo = reloj.setInterval(sinc, opciones.cadaMs ?? 120_000);
  let espera: ReturnType<typeof setTimeout> | undefined;
  sinc();
  return {
    cambioLocal() {
      if (espera !== undefined) reloj.clearTimeout(espera);
      espera = reloj.setTimeout(sinc, 5000);
    },
    detener() {
      ventana.removeEventListener('online', alVolver);
      documento?.removeEventListener('visibilitychange', alMostrar);
      reloj.clearInterval(intervalo);
      if (espera !== undefined) reloj.clearTimeout(espera);
    },
  };
}

/**
 * Abre el almacenamiento del teléfono y monta la app. Si otra pestaña o ventana ya tiene la
 * escritura, esta queda en solo lectura. Si el almacenamiento no abre, lo explica en pantalla.
 * Con configuración, conecta el inicio de sesión y la sincronización.
 */
export async function arrancar(
  raiz: HTMLElement, persistencia: Persistencia, tomarEscritura: () => Promise<boolean>,
  opciones: { config?: ConfigApp; cliente?: ClienteReceptor; acceso?: Acceso } = {},
): Promise<Motor | undefined> {
  let motor: Motor;
  try {
    motor = await Motor.abrir(persistencia);
  } catch {
    render(
      <div class="bienvenida">
        <p class="marca">{PERFIL.institucion}</p>
        <h1>Carnet de Atención</h1>
        <p class="aviso">No se pudo abrir el almacenamiento de este teléfono. Revisa que no estés en modo privado y que el navegador permita guardar datos, y vuelve a abrir Carnet de Atención.</p>
      </div>,
      raiz,
    );
    return undefined;
  }
  motor.soloLectura = !(await tomarEscritura());
  const { config } = opciones;
  // El acceso de prueba es una constante de compilación: sin VITE_ACCESO_PRUEBA=1, Vite lo elimina del build.
  const acceso = opciones.acceso
    ?? (config ? (import.meta.env.VITE_ACCESO_PRUEBA === '1' ? accesoPrueba() : accesoGoogle(config.clientId)) : undefined);
  if (config && !motor.soloLectura) {
    const cliente = opciones.cliente ?? clienteHttp(config.receptorUrl);
    const sinc = new Sincronizador(motor, cliente, {
      alTerminar: async () => {
        const token = tokenVigente(motor.sesion, motor.reloj());
        if (token) await subirFotosPendientes(motor, cliente, token);
      },
    });
    let renovando = false;
    const disparar = () => {
      if (!motor.sesion) return;
      void sinc.sincronizar().then(e => {
        const conSenal = typeof navigator === 'undefined' || navigator.onLine !== false;
        if (e.fase !== 'requiere_sesion' || !acceso?.renovar || renovando || !conSenal) return;
        // La sesión de Google dura una hora: se intenta renovar sola; si no, queda el botón manual.
        renovando = true;
        setTimeout(() => { renovando = false; }, 60_000);
        acceso.renovar(jwt => {
          motor.iniciarSesionGoogle(jwt).then(() => { renovando = false; disparar(); }, () => { renovando = false; });
        });
      });
    };
    motor.alPedirSincronizacion = disparar;
    const programa = programarSincronizacion(disparar);
    let colaPrevia = motor.cola.length;
    motor.suscribir(() => {
      if (motor.cola.length > colaPrevia) programa.cambioLocal();
      colaPrevia = motor.cola.length;
    });
  }
  render(<App motor={motor} acceso={acceso} />, raiz);
  return motor;
}

/** Una sola pestaña o ventana escribe a la vez: retiene un candado del navegador mientras la página viva. */
export function tomarEscrituraConCandado(): Promise<boolean> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks) return Promise.resolve(true);
  return new Promise(resolver => {
    locks.request('carnet-escritura', { ifAvailable: true }, candado => {
      resolver(!!candado);
      return candado ? new Promise<void>(() => { /* se retiene hasta cerrar la página */ }) : undefined;
    });
  });
}
