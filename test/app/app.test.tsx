// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import { motorDePrueba } from './ayuda';

afterEach(cleanup);

describe('App', () => {
  it('la primera vez pide nombre y correo, y luego muestra Seguimiento', async () => {
    const m = await motorDePrueba(false);
    render(<App motor={m} />);
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/nombre/);
    fireEvent.input(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Torres' } });
    fireEvent.input(screen.getByLabelText('Tu correo de Google'), { target: { value: 'Ana.Torres@ejemplo.mx' } });
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await screen.findByRole('heading', { name: 'Seguimiento' });
    expect(m.sesion?.correo).toBe('ana.torres@ejemplo.mx');
    expect(screen.getByText('Todo guardado en este teléfono')).toBeTruthy();
  });

  it('las pestañas cambian de pantalla y la barra cuenta lo guardado sin enviar', async () => {
    const m = await motorDePrueba();
    render(<App motor={m} />);
    fireEvent.click(screen.getByRole('button', { name: 'Carnets' }));
    expect(screen.getByRole('heading', { name: 'Carnets' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Documentos' }));
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeTruthy();
    m.ejecutar(m.crear('colectivo', { nombre: 'Colectivo Raíces' }));
    await screen.findByText('Guardado en este teléfono · 1 cambio por enviar');
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/pendientes|vencid/);
  });
});
