// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { App } from '../../app/src/ui/App';
import { motorDePrueba, conCarnet, reunionCon, USUARIA } from './ayuda';
import type { Motor } from '../../app/src/estado/motor';

afterEach(cleanup);

function escenario(m: Motor) {
  m.almacen.agregar('usuarios', { correo: 'luis.vega@ejemplo.mx', nombre: 'Luis Vega', cargo: '', activo: true });
  const pid = conCarnet(m);
  const r = reunionCon(m, pid);
  const ac = (texto: string, extra: Record<string, string> = {}) => {
    const op = m.crear('acuerdo', { reunion_id: r, texto, persona_ids: pid, instituciones: 'fiscalia-mp', responsable: USUARIA.correo, ...extra });
    m.ejecutar(op);
    return op.id;
  };
  ac('Reunión con la Fiscal', { fecha_acordada: '2026-09-28' });
  ac('Difusión de volantes', { fecha_acordada: '2026-11-15', instituciones: 'busqueda' });
  ac('Atención psicológica', { instituciones: 'salud-clinica' });
  const bloq = ac('Revisión de cámaras', { instituciones: 'monitoreo' });
  ac('Mesa con colectivo', { responsable: 'luis.vega@ejemplo.mx', fecha_acordada: '2026-10-02' });
  m.ejecutar(m.sellar(r));
  m.ejecutar(m.crear('estado_acuerdo', { acuerdo_id: bloq, estado: 'Bloqueado', nota: 'Sin respuesta al oficio' }));
}

describe('Seguimiento', () => {
  it('agrupa mis acuerdos con lenguaje que acompaña', async () => {
    const m = await motorDePrueba();
    escenario(m);
    render(<App motor={m} />);
    expect(screen.getByText('4 acuerdos en curso')).toBeTruthy();
    expect(screen.getByText('PARA MOVER ESTA SEMANA')).toBeTruthy();
    expect(screen.getByText('NECESITAN APOYO')).toBeTruthy();
    expect(screen.getByText('MÁS ADELANTE')).toBeTruthy();
    expect(screen.getByText('SIN FECHA ACORDADA')).toBeTruthy();
    expect(screen.getByText(/Fecha acordada: hace 2 días/)).toBeTruthy();
    expect(screen.getByText(/“Sin respuesta al oficio”/)).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/pendientes|vencid/);
  });

  it('filtra por todo el equipo y por institución', async () => {
    const m = await motorDePrueba();
    escenario(m);
    render(<App motor={m} />);
    fireEvent.click(screen.getByRole('button', { name: 'Todo el equipo' }));
    expect(screen.getByText('5 acuerdos en curso')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Por institución' }));
    fireEvent.change(screen.getByLabelText('Institución'), { target: { value: 'salud' } });
    expect(screen.getByText('1 acuerdo en curso')).toBeTruthy();
    expect(screen.getByText('Atención psicológica')).toBeTruthy();
  });

  it('busca personas, abre un acuerdo y crea una reunión nueva', async () => {
    const m = await motorDePrueba();
    escenario(m);
    render(<App motor={m} />);
    fireEvent.input(screen.getByLabelText('Buscar persona o folio'), { target: { value: 'maria' } });
    expect(screen.getByText('María Fernanda Ríos')).toBeTruthy();
    fireEvent.input(screen.getByLabelText('Buscar persona o folio'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Reunión con la Fiscal'));
    await screen.findByText('Historial');
    fireEvent.click(screen.getByRole('button', { name: 'Seguimiento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva reunión' }));
    await screen.findByRole('heading', { name: 'Reunión en curso' });
  });

  it('muestra el contador de anulaciones del mes', async () => {
    const m = await motorDePrueba();
    escenario(m);
    const ac = m.almacen.filas('acuerdos')[2];
    m.ejecutar(m.crear('anulacion', { entidad: 'acuerdo', registro_id: String(ac.id), nota_aclaratoria: 'Duplicado de otro acuerdo' }));
    render(<App motor={m} />);
    fireEvent.click(screen.getByRole('button', { name: '1 anulación este mes' }));
    await screen.findByText('Duplicado de otro acuerdo');
  });
});
