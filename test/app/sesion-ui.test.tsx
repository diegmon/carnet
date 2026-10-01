// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import type { Acceso } from '../../app/src/ui/Sesion';
import { motorDePrueba, conCarnet, tokenDePrueba, USUARIA } from './ayuda';

afterEach(cleanup);

/** Acceso falso: dibuja un botón que entrega un token de prueba. */
function accesoFalso(jwt = tokenDePrueba()): Acceso {
  return {
    mostrarBoton(contenedor, alRecibir) {
      const b = document.createElement('button');
      b.textContent = 'Continuar con Google';
      b.onclick = () => alRecibir(jwt);
      contenedor.appendChild(b);
    },
  };
}

describe('Sesión e interfaz de sincronización', () => {
  it('sin sesión muestra el botón de Google y al iniciar entra a Seguimiento', async () => {
    const m = await motorDePrueba(false);
    render(<App motor={m} acceso={accesoFalso()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }));
    await screen.findByRole('heading', { name: 'Seguimiento' });
    expect(m.sesion?.correo).toBe(USUARIA.correo);
  });

  it('sin configuración lo explica', async () => {
    const m = await motorDePrueba(false);
    render(<App motor={m} />);
    expect(screen.getByText(/no está configurada/)).toBeTruthy();
  });

  it('la barra refleja el estado de envío y ofrece enviar ahora', async () => {
    const m = await motorDePrueba();
    let pedidos = 0;
    m.alPedirSincronizacion = () => { pedidos++; };
    conCarnet(m);
    render(<App motor={m} acceso={accesoFalso()} />);
    m.fijarEstadoSync({ fase: 'sin_red' });
    await screen.findByText('Sin señal · 1 cambio guardado en este teléfono');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }));
    expect(pedidos).toBe(1);
    m.fijarEstadoSync({ fase: 'enviando' });
    await screen.findByText('Enviando…');
    m.cola = [];
    m.fijarEstadoSync({ fase: 'al_dia', ultimaVez: '2026-09-30T17:05:00-06:00' });
    await screen.findByText('Todo enviado · 17:05');
    m.fijarEstadoSync({ fase: 'error', mensaje: 'x' });
    await screen.findByText('No se pudo enviar; se reintentará sola');
  });

  it('si la sesión venció, pide iniciar sesión y luego reintenta (Review Focus 3)', async () => {
    const m = await motorDePrueba();
    let pedidos = 0;
    m.alPedirSincronizacion = () => { pedidos++; };
    render(<App motor={m} acceso={accesoFalso()} />);
    m.fijarEstadoSync({ fase: 'requiere_sesion' });
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión para enviar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }));
    await waitFor(() => expect(m.sesion?.token).toBeTruthy());
    expect(pedidos).toBe(1);
  });

  it('muestra los problemas con su motivo y permite descartarlos', async () => {
    const m = await motorDePrueba();
    m.problemas.push({ op: { op_id: 'o1', tipo: 'actualizar', entidad: 'reunion', id: 'r1', ts: m.ts(), cambios: { tema: 'x' } }, motivo: 'La reunión ya está sellada', fecha: m.ts() });
    render(<App motor={m} acceso={accesoFalso()} />);
    m.fijarEstadoSync({ fase: 'al_dia', ultimaVez: m.ts() });
    fireEvent.click(await screen.findByRole('button', { name: 'Problemas de sincronización (1)' }));
    expect(screen.getByText('La reunión ya está sellada')).toBeTruthy();
    expect(screen.getByText(/Cambio en una reunión/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(m.problemas).toEqual([]));
  });
});
