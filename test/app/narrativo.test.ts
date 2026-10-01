import { describe, it, expect } from 'vitest';
import { borradorNarrativo, unirConY } from '../../app/src/estado/narrativo';
import { motorDePrueba, conCarnet } from './ayuda';

describe('narrativo', () => {
  it('une listas en español', () => {
    expect(unirConY([])).toBe('');
    expect(unirConY(['a'])).toBe('a');
    expect(unirConY(['a', 'b'])).toBe('a y b');
    expect(unirConY(['a', 'b', 'c'])).toBe('a, b y c');
  });

  it('arma el párrafo con datos, personas atendidas, acompañantes y gobierno', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m, 'María Fernanda Ríos');
    m.almacen.actualizar('personas', pid, { folio: 'CA-017' });
    const acomp = m.crear('persona', { nombre: 'Jorge Ríos', tipo: 'Acompañante' });
    const gob = m.crear('persona', { nombre: 'Lic. Luis Vega', tipo: 'Gobierno', institucion: 'fiscalia-mp', cargo: 'Agente del MP' });
    const r = m.crear('reunion', { fecha: '2026-09-30', hora: '17:00', modalidad: 'Presencial y virtual', sede: 'Centro de Atención, col. Doctores' });
    m.ejecutar(acomp, gob, r,
      m.crear('asistente', { reunion_id: r.id, persona_id: pid, papel: 'Atendida' }),
      m.crear('asistente', { reunion_id: r.id, persona_id: acomp.id, papel: 'Acompañante', parentesco_o_cargo: 'hermano' }),
      m.crear('asistente', { reunion_id: r.id, persona_id: gob.id, papel: 'Gobierno' }));
    expect(borradorNarrativo(m.almacen, r.id)).toBe(
      'El día 30 de septiembre de 2026, a las 17:00 horas, se llevó a cabo una reunión de manera presencial y virtual '
      + 'en Centro de Atención, col. Doctores, con la persona María Fernanda Ríos (CA-017). '
      + 'Asistieron también: Jorge Ríos (hermano). '
      + 'Por parte del gobierno: Lic. Luis Vega, Agente del MP, FISCALÍA › MP.');
  });

  it('con varias personas y folio provisional', async () => {
    const m = await motorDePrueba();
    const a = conCarnet(m, 'María Ríos');
    const b = conCarnet(m, 'Rosa Juárez');
    const r = m.crear('reunion', { fecha: '2026-09-30' });
    m.ejecutar(r,
      m.crear('asistente', { reunion_id: r.id, persona_id: a, papel: 'Atendida' }),
      m.crear('asistente', { reunion_id: r.id, persona_id: b, papel: 'Atendida' }));
    expect(borradorNarrativo(m.almacen, r.id)).toBe(
      'El día 30 de septiembre de 2026, se llevó a cabo una reunión, con las personas María Ríos y Rosa Juárez.');
  });

  it('sin reunión devuelve vacío', async () => {
    expect(borradorNarrativo((await motorDePrueba()).almacen, 'nada')).toBe('');
  });
});
