// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import { motorDePrueba, conCarnet, reunionCon } from './ayuda';

afterEach(cleanup);

describe('Fotos', () => {
  it('agrega una foto con pie, la guarda en el teléfono y se puede quitar en borrador', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'reunion', id: r }} />);
    fireEvent.input(screen.getByLabelText('Pie de foto (opcional)'), { target: { value: 'Campamento' } });
    const archivo = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Tomar o elegir foto'), { target: { files: [archivo] } });
    await waitFor(() => expect(m.almacen.filas('anexos')).toHaveLength(1));
    const anexo = m.almacen.filas('anexos')[0];
    expect(anexo.descripcion).toBe('Campamento');
    expect(await m.persistencia.leerFoto(String(anexo.id))).toBeTruthy();
    await screen.findByText('Fotos · 1');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto 1' }));
    await screen.findByText('Fotos · 0');
  });
});

describe('Documentos y anulaciones', () => {
  it('lista reuniones selladas y anulaciones del mes', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const r = reunionCon(m, pid);
    m.ejecutar(m.actualizar('reunion', r, { tema: 'Seguimiento con colectivo' }), m.sellar(r));
    m.ejecutar(m.crear('anulacion', { entidad: 'reunion', registro_id: r, nota_aclaratoria: 'Fecha equivocada en la reunión' }));
    render(<App motor={m} inicio={{ p: 'documentos' }} />);
    expect(screen.getByText('Seguimiento con colectivo')).toBeTruthy();
    expect(screen.getByText(/Pronto podrás generar/)).toBeTruthy();
    cleanup();
    render(<App motor={m} inicio={{ p: 'anulaciones' }} />);
    expect(screen.getByText('Fecha equivocada en la reunión')).toBeTruthy();
  });
});
