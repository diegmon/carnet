// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import { motorDePrueba, conCarnet, reunionCon, USUARIA } from './ayuda';
import type { Motor } from '../../app/src/estado/motor';

afterEach(cleanup);
const escribir = (etiqueta: string, valor: string) => fireEvent.input(screen.getByLabelText(etiqueta), { target: { value: valor } });

function acuerdoSellado(m: Motor) {
  const pid = conCarnet(m);
  const r = reunionCon(m, pid);
  const ac = m.crear('acuerdo', { reunion_id: r, texto: 'Cita con la Fiscal', instituciones: 'fiscalia', persona_ids: pid, responsable: USUARIA.correo });
  m.ejecutar(ac, m.sellar(r));
  return { pid, r, ac: ac.id };
}

describe('Acuerdos', () => {
  it('crea un acuerdo con institución y fecha, con el carnet preseleccionado', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const r = reunionCon(m, pid);
    render(<App motor={m} inicio={{ p: 'nuevo-acuerdo', reunionId: r }} />);
    escribir('¿Qué se acordó?', 'Reunión con la Fiscal');
    escribir('Buscar institución', 'ministerio');
    fireEvent.click(screen.getByRole('button', { name: 'FISCALÍA › MP' }));
    escribir('Fecha acordada (opcional)', '2026-10-03');
    escribir('Hora (opcional)', '10:00');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(m.almacen.filas('acuerdos')).toHaveLength(1));
    expect(m.almacen.filas('acuerdos')[0]).toMatchObject({
      instituciones: 'fiscalia-mp', persona_ids: pid, fecha_acordada: '2026-10-03T10:00', responsable: USUARIA.correo,
    });
  });

  it('pide lo que falta antes de guardar', async () => {
    const m = await motorDePrueba();
    const r = reunionCon(m, conCarnet(m));
    render(<App motor={m} inicio={{ p: 'nuevo-acuerdo', reunionId: r }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/qué se acordó/);
    escribir('¿Qué se acordó?', 'Algo');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert').textContent).toMatch(/institución/);
  });

  it('cambiar a Bloqueado exige nota; anular exige nota aclaratoria', async () => {
    const m = await motorDePrueba();
    const { ac } = acuerdoSellado(m);
    render(<App motor={m} inicio={{ p: 'acuerdo', id: ac }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bloqueado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
    expect(screen.getByRole('alert').textContent).toMatch(/nota/);
    escribir('Nota', 'Sin respuesta al oficio');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
    await waitFor(() => expect(m.almacen.filas('acuerdos')[0].estado_vigente).toBe('Bloqueado'));
    expect(screen.getByText('Sin respuesta al oficio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Anular acuerdo' }));
    escribir('Nota aclaratoria', 'corto');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    expect(screen.getByRole('alert').textContent).toMatch(/mínimo 10/);
    escribir('Nota aclaratoria', 'Se registró en el carnet equivocado');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await screen.findByText(/ANULADO · Se registró en el carnet equivocado/);
  });

  it('el acuerdo correcto se agrega a la misma reunión como corrección y enlaza al anulado', async () => {
    const m = await motorDePrueba();
    const { ac, r } = acuerdoSellado(m);
    m.ejecutar(m.crear('anulacion', { entidad: 'acuerdo', registro_id: ac, nota_aclaratoria: 'Institución equivocada' }));
    render(<App motor={m} inicio={{ p: 'acuerdo', id: ac }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Capturar el acuerdo correcto' }));
    await screen.findByRole('heading', { name: 'Nuevo acuerdo' });
    escribir('¿Qué se acordó?', 'Cita con la Fiscal (Seguridad)');
    escribir('Buscar institución', 'seguridad');
    fireEvent.click(screen.getByRole('button', { name: 'SEGURIDAD' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(m.almacen.filas('acuerdos')).toHaveLength(2));
    const nuevo = m.almacen.filas('acuerdos')[1];
    expect(nuevo.sustituye_a).toBe(ac);
    expect(m.almacen.filas('anulaciones')[0].sustituido_por).toBe(nuevo.id);
    expect(nuevo).toMatchObject({ reunion_id: r, numero: '01-C' });
    expect(m.almacen.filas('reuniones')).toHaveLength(1);
  });
});
