// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import { motorDePrueba, conCarnet, reunionCon } from './ayuda';

afterEach(cleanup);
const escribir = (etiqueta: string, valor: string) => fireEvent.input(screen.getByLabelText(etiqueta), { target: { value: valor } });

describe('Reunión', () => {
  it('desde el carnet abre una reunión con la persona atendida y agrega un acompañante nuevo', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    render(<App motor={m} inicio={{ p: 'carnet', id: pid }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva reunión con María' }));
    await screen.findByRole('heading', { name: 'Reunión en curso' });
    expect(screen.getByText('María Fernanda Ríos · Folio pendiente')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar presente' }));
    escribir('Buscar persona', 'Jorge Ríos');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a “Jorge Ríos”' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    escribir('Parentesco o relación (opcional)', 'hermano');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('Jorge Ríos (hermano)');
  });

  it('guarda un dato solo al salir del campo y solo si cambió (Review Focus 3)', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    const antes = m.cola.length;
    const tema = screen.getByLabelText('Tema');
    fireEvent.blur(tema);
    expect(m.cola.length).toBe(antes);
    fireEvent.input(tema, { target: { value: 'Seguimiento con colectivo' } });
    expect(m.cola.length).toBe(antes);
    fireEvent.blur(tema);
    expect(m.cola.length).toBe(antes + 1);
    expect(m.almacen.filas('reuniones')[0].tema).toBe('Seguimiento con colectivo');
  });

  it('agrega y quita peticiones en borrador, y propone el narrativo', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    escribir('Nueva petición', 'Fumigar el campamento');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar petición' }));
    await screen.findByText('1. Fumigar el campamento');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar petición 1' }));
    await waitFor(() => expect(screen.queryByText('1. Fumigar el campamento')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Proponer borrador' }));
    await waitFor(() => expect(String(m.almacen.filas('reuniones')[0].narrativo)).toMatch(/^El día 30 de septiembre de 2026/));
  });

  it('terminar muestra resumen, sella y lleva a Documentos', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(screen.getByText(/1 presente · 0 peticiones · 0 acuerdos · 0 fotos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sellar reunión' }));
    await screen.findByRole('heading', { name: 'Documentos' });
    expect(m.almacen.filas('reuniones')[0].estado).toBe('Sellada');
  });

  it('sin persona atendida no se puede sellar y lo explica', async () => {
    const m = await motorDePrueba();
    const op = m.crear('reunion', { fecha: '2026-09-30' });
    m.ejecutar(op);
    render(<App motor={m} inicio={{ p: 'reunion', id: op.id }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sellar reunión' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/atendida/);
  });
});
