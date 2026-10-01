import { useEffect, useRef, useState } from 'preact/hooks';
import { useMotor } from './contexto';
import { Aviso } from './comunes';
import { PERFIL } from '../../../src/dominio/perfil';

export interface Acceso { mostrarBoton(contenedor: HTMLElement, alRecibir: (jwt: string) => void): void }

function BotonGoogle({ acceso, alIniciar }: { acceso: Acceso; alIniciar(jwt: string): Promise<void> }) {
  const lugar = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!lugar.current) return;
    lugar.current.innerHTML = '';
    acceso.mostrarBoton(lugar.current, jwt => {
      alIniciar(jwt).then(() => setError(''), e => setError((e as Error).message || 'No se pudo iniciar sesión'));
    });
  }, [acceso]);
  return <><div ref={lugar} class="boton-google" /><Aviso mensaje={error} /></>;
}

export function IniciarSesion({ acceso }: { acceso?: Acceso }) {
  const m = useMotor();
  return (
    <div class="bienvenida">
      <p class="marca">{PERFIL.institucion}</p>
      <h1>Carnet de Atención</h1>
      {acceso ? <>
        <p>Inicia sesión con tu cuenta de Google autorizada. Necesitas señal solo esta vez; después puedes capturar sin conexión.</p>
        <BotonGoogle acceso={acceso} alIniciar={jwt => m.iniciarSesionGoogle(jwt)} />
      </> : <p class="aviso">Esta copia de Carnet de Atención no está configurada para enviar datos. Pide la liga oficial a la cuenta dueña.</p>}
    </div>
  );
}

export function PanelReautenticar({ acceso, alCerrar }: { acceso: Acceso; alCerrar(): void }) {
  const m = useMotor();
  return (
    <div class="tarjeta formulario">
      <p>Tu sesión venció. Inicia sesión de nuevo para enviar lo capturado; nada se ha perdido.</p>
      <BotonGoogle acceso={acceso} alIniciar={async jwt => {
        await m.iniciarSesionGoogle(jwt);
        alCerrar();
        m.alPedirSincronizacion?.();
      }} />
      <button class="enlace" onClick={alCerrar}>Ahora no</button>
    </div>
  );
}
