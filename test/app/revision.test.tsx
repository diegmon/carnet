// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { render as montarPreact } from 'preact';
import { App } from '../../app/src/ui/App';
import { Motor } from '../../app/src/estado/motor';
import { arrancar } from '../../app/src/arranque';
import { persistenciaMemoria, Persistencia } from '../../app/src/estado/persistencia';
import { buscarPersonas } from '../../app/src/estado/consultas';
import { motorDePrueba, conCarnet, reunionCon, HOY } from './ayuda';

afterEach(() => { cleanup(); localStorage.clear(); });
const escribir = (etiqueta: string, valor: string) => fireEvent.input(screen.getByLabelText(etiqueta), { target: { value: valor } });

/** Persistencia que falla la(s) primera(s) N escrituras. */
function conFallas(n: number, base: Persistencia = persistenciaMemoria()): Persistencia & { fallos: number } {
  const p = { ...base, fallos: 0 };
  p.guardar = async (t, c) => { if (p.fallos < n) { p.fallos++; throw new Error('QuotaExceededError'); } return base.guardar(t, c); };
  return p;
}

describe('revisión: guardado en el teléfono', () => {
  it('una escritura fallida no detiene las siguientes y se avisa mientras falle', async () => {
    const base = persistenciaMemoria();
    const m = await motorDePrueba(true, base);
    const p = conFallas(1, base);
    const m2 = new Motor(m.almacen, m.cola, m.sesion, p, () => HOY);
    conCarnet(m2, 'Rosa Juárez');
    await m2.esperarGuardado();
    expect(m2.errorGuardado).toMatch(/No se pudo guardar/);
    conCarnet(m2, 'Alex Medina');
    await m2.esperarGuardado();
    expect(m2.errorGuardado).toBe('');
    const otra = await Motor.abrir(base, () => HOY);
    expect(otra.almacen.filas('personas').map(x => x.nombre)).toEqual(['Rosa Juárez', 'Alex Medina']);
    expect(otra.cola).toHaveLength(2);
  });

  it('la barra muestra el error de guardado en lugar de "Guardado"', async () => {
    const m = await motorDePrueba(true, conFallas(5));
    render(<App motor={m} />);
    conCarnet(m);
    await m.esperarGuardado();
    expect((await screen.findByRole('status')).textContent).toMatch(/No se pudo guardar/);
  });

  it('si la foto no se puede guardar, se avisa y no se crea el anexo', async () => {
    const base = persistenciaMemoria();
    const m = await motorDePrueba(true, { ...base, guardarFoto: async () => { throw new Error('QuotaExceededError'); } });
    const r = reunionCon(m, conCarnet(m));
    const e = await m.agregarFoto(r, new Blob(['x'], { type: 'image/jpeg' }), '');
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/foto/);
    expect(m.almacen.filas('anexos')).toHaveLength(0);
  });
});

describe('revisión: una sola pestaña escribe', () => {
  it('en solo lectura no captura y lo explica', async () => {
    const m = await motorDePrueba();
    m.soloLectura = true;
    const e = m.ejecutar(m.crear('colectivo', { nombre: 'Raíces' }));
    expect(e.ok).toBe(false);
    expect(e.motivo).toMatch(/otra pestaña/);
    expect(m.cola).toHaveLength(0);
    render(<App motor={m} />);
    expect(screen.getByRole('status').textContent).toMatch(/otra pestaña/);
  });

  it('en solo lectura y sin sesión no ofrece la bienvenida ni escribe', async () => {
    const m = await motorDePrueba(false);
    m.soloLectura = true;
    render(<App motor={m} />);
    expect(screen.queryByRole('button', { name: 'Empezar' })).toBeNull();
    expect(screen.getByText(/otra pestaña/)).toBeTruthy();
    await expect(m.configurarSesion({ correo: 'a@b.mx', nombre: 'A', cargo: '' })).rejects.toThrow(/otra pestaña/);
  });

  it('arrancar marca solo lectura si no obtiene la escritura, y avisa si el almacenamiento no abre', async () => {
    const raiz = document.createElement('div');
    document.body.appendChild(raiz);
    const m = await arrancar(raiz, persistenciaMemoria(), async () => false);
    expect(m?.soloLectura).toBe(true);
    montarPreact(null, raiz);
    raiz.remove();
    const raiz2 = document.createElement('div');
    const falla = { ...persistenciaMemoria(), cargar: async () => { throw new Error('blocked'); } };
    expect(await arrancar(raiz2, falla, async () => true)).toBeUndefined();
    expect(raiz2.textContent).toMatch(/No se pudo abrir el almacenamiento/);
  });
});

describe('revisión: campos', () => {
  it('salir sin cambio real (espacios) no crea operación; un guardado rechazado restaura el valor', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    m.ejecutar(m.actualizar('reunion', r, { sede: 'Centro de Atención' }));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    const antes = m.cola.length;
    const sede = screen.getByLabelText('Sede') as HTMLInputElement;
    fireEvent.input(sede, { target: { value: 'Centro de Atención ' } });
    fireEvent.blur(sede);
    expect(m.cola.length).toBe(antes);
    const fecha = screen.getByLabelText('Fecha') as HTMLInputElement;
    fireEvent.input(fecha, { target: { value: '' } });
    fireEvent.blur(fecha);
    expect(screen.getByRole('alert').textContent).toMatch(/fecha/);
    await waitFor(() => expect(fecha.value).toBe('2026-09-30'));
    fireEvent.blur(fecha);
    expect(m.cola.length).toBe(antes);
  });

  it('al ocultar la app se guarda lo que se estaba escribiendo', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    escribir('Narrativo', 'El día 30 de septiembre…');
    window.dispatchEvent(new Event('pagehide'));
    await waitFor(() => expect(m.almacen.filas('reuniones')[0].narrativo).toBe('El día 30 de septiembre…'));
  });

  it('el texto de un acuerdo o petición sin guardar se conserva si se sale de la pantalla', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'nuevo-acuerdo', reunionId: r }} />);
    escribir('¿Qué se acordó?', 'Cita con la Fiscal');
    cleanup();
    render(<App motor={m} inicio={{ p: 'nuevo-acuerdo', reunionId: r }} />);
    expect((screen.getByLabelText('¿Qué se acordó?') as HTMLTextAreaElement).value).toBe('Cita con la Fiscal');
    cleanup();
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    escribir('Nueva petición', 'Fumigar');
    cleanup();
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    expect((screen.getByLabelText('Nueva petición') as HTMLTextAreaElement).value).toBe('Fumigar');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar petición' }));
    await screen.findByText('1. Fumigar');
    expect((screen.getByLabelText('Nueva petición') as HTMLTextAreaElement).value).toBe('');
  });

  it('en una reunión sellada se puede anular a un asistente', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const r = reunionCon(m, pid);
    const j = m.crear('persona', { nombre: 'Jorge Ríos', tipo: 'Acompañante' });
    m.ejecutar(j, m.crear('asistente', { reunion_id: r, persona_id: j.id, papel: 'Acompañante' }), m.sellar(r));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anular a Jorge Ríos' }));
    escribir('Nota aclaratoria', 'No estuvo presente en la reunión');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() => expect(m.almacen.filas('asistentes').find(a => a.persona_id === j.id)!.anulado).toBe(true));
  });
});

describe('revisión: búsqueda y zona horaria', () => {
  it('encuentra por palabras sueltas de un nombre largo', async () => {
    const m = await motorDePrueba();
    conCarnet(m, 'María Fernanda Ríos Calderón');
    expect(buscarPersonas(m.almacen, 'maria rios').map(p => p.nombre)).toEqual(['María Fernanda Ríos Calderón']);
    expect(buscarPersonas(m.almacen, 'fernanda raices')).toEqual([]);
  });
  it('las pruebas corren en una zona horaria fija, no UTC (Review Focus 5 no pasa por casualidad)', () => {
    expect(new Date(2026, 8, 30, 23, 30).toISOString().slice(0, 10)).toBe('2026-10-01');
  });
});


describe('nombre del proyecto', () => {
  it('la app se presenta como "Carnet de Atención" y nunca como "CARNET"', async () => {
    const m = await motorDePrueba(false);
    render(<App motor={m} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Carnet de Atención');
    expect(document.body.textContent).not.toMatch(/CARNET/);
    cleanup();
    const m2 = await motorDePrueba();
    render(<App motor={m2} />);
    expect(document.body.textContent).not.toMatch(/CARNET/);
  });
});

describe('marca del perfil', () => {
  it('la portada muestra la institución del perfil y aplica sus colores', async () => {
    const { aplicarColores } = await import('../../app/src/ui/marca');
    const { PERFIL } = await import('../../src/dominio/perfil');
    const m = await motorDePrueba();
    render(<App motor={m} />);
    expect(screen.getByText('MI INSTITUCIÓN')).toBeTruthy();
    aplicarColores(PERFIL.colores, document);
    expect(document.documentElement.style.getPropertyValue('--primario')).toBe(PERFIL.colores.primario);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(PERFIL.colores.primario);
  });
});
