// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import { motorDePrueba, conCarnet } from './ayuda';

afterEach(cleanup);
const escribir = (etiqueta: string, valor: string) => fireEvent.input(screen.getByLabelText(etiqueta), { target: { value: valor } });

describe('Carnets', () => {
  it('crea un carnet con folio pendiente y abre su ficha', async () => {
    const m = await motorDePrueba();
    render(<App motor={m} />);
    fireEvent.click(screen.getByRole('button', { name: 'Carnets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo carnet' }));
    escribir('Nombre completo', 'María Fernanda Ríos');
    escribir('Colectivo (opcional)', 'Colectivo Raíces');
    fireEvent.change(screen.getByLabelText('Zona'), { target: { value: 'Z1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('heading', { name: 'María Fernanda Ríos' });
    expect(screen.getByText('Folio pendiente')).toBeTruthy();
    expect(screen.getByText('Colectivo Raíces · Zona Norte')).toBeTruthy();
    expect(m.cola.map(o => o.entidad)).toEqual(['colectivo', 'persona']);
  });

  it('avisa de nombres parecidos y crea solo si se confirma', async () => {
    const m = await motorDePrueba();
    conCarnet(m, 'María Fernanda Ríos');
    render(<App motor={m} inicio={{ p: 'carnets' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo carnet' }));
    escribir('Nombre completo', 'Maria Fernanda Rios Calderón');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText(/nombres parecidos/)).toBeTruthy();
    expect(m.almacen.filas('personas')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(m.almacen.filas('personas')).toHaveLength(2));
  });

  it('editar datos guarda la versión anterior', async () => {
    const m = await motorDePrueba();
    const op = m.crear('persona', { nombre: 'Rosa Juárez', tipo: 'Atendida', contacto: '55 1111 2222' });
    m.ejecutar(op);
    render(<App motor={m} inicio={{ p: 'carnet', id: op.id }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
    escribir('Contacto (opcional)', '55 3333 4444');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText(/55 3333 4444/);
    expect(m.almacen.filas('personas_versiones')[0]).toMatchObject({ campo: 'contacto', valor_anterior: '55 1111 2222' });
  });

  it('anular un carnet exige nota aclaratoria y lo deja visible como ANULADO', async () => {
    const m = await motorDePrueba();
    const id = conCarnet(m, 'Rosa Juárez');
    render(<App motor={m} inicio={{ p: 'carnet', id }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anular este registro' }));
    escribir('Nota aclaratoria', 'corto');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    expect(screen.getByRole('alert').textContent).toMatch(/mínimo 10/);
    escribir('Nota aclaratoria', 'Registro duplicado de otra persona');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await screen.findByText('ANULADO');
    expect(m.almacen.filas('personas')[0].anulado).toBe(true);
  });
});
