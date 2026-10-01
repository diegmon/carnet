import { describe, it, expect } from 'vitest';
import { isoLocal, hoyLocal, horaLocal, diasEntre, fechaLarga, fechaCorta, textoFechaAcordada } from '../../app/src/estado/fechas';
import { validarForma } from '../../src/dominio/operaciones';

describe('fechas locales (Review Focus 5)', () => {
  it('isoLocal lleva la zona del teléfono y el receptor la acepta', () => {
    const d = new Date(2026, 8, 30, 23, 30, 0);
    const iso = isoLocal(d);
    expect(iso).toMatch(/^2026-09-30T23:30:00[+-]\d{2}:\d{2}$/);
    expect(Date.parse(iso)).toBe(d.getTime());
    expect(() => validarForma({ op_id: 'o', tipo: 'sellar', entidad: 'reunion', id: 'r', ts: iso })).not.toThrow();
  });
  it('a las 23:30 hoy sigue siendo el día local', () => {
    const d = new Date(2026, 8, 30, 23, 30, 0);
    expect(hoyLocal(d)).toBe('2026-09-30');
    expect(horaLocal(d)).toBe('23:30');
  });
  it('cuenta días entre fechas, con o sin hora', () => {
    expect(diasEntre('2026-09-30', '2026-10-03T10:00')).toBe(3);
    expect(diasEntre('2026-09-30', '2026-09-28')).toBe(-2);
  });
  it('escribe fechas en español', () => {
    expect(fechaLarga('2026-09-30')).toBe('30 de septiembre de 2026');
    expect(fechaCorta('2026-10-03T10:00')).toBe('3 oct');
  });
  it('dice la fecha acordada sin presionar', () => {
    const hoy = '2026-09-30';
    expect(textoFechaAcordada('', hoy)).toBe('Sin fecha acordada');
    expect(textoFechaAcordada('2026-09-28', hoy)).toBe('Fecha acordada: hace 2 días');
    expect(textoFechaAcordada('2026-09-29', hoy)).toBe('Fecha acordada: ayer');
    expect(textoFechaAcordada('2026-09-30', hoy)).toBe('Fecha acordada: hoy');
    expect(textoFechaAcordada('2026-10-01', hoy)).toBe('Fecha acordada: mañana');
    expect(textoFechaAcordada('2026-10-03T10:00', hoy)).toBe('Fecha acordada: sábado 3 oct, 10:00');
    expect(textoFechaAcordada('2026-11-15', hoy)).toBe('Fecha acordada: 15 nov');
    for (const f of ['2026-09-01', '2026-09-28']) expect(textoFechaAcordada(f, hoy).toLowerCase()).not.toMatch(/vencid/);
  });
});
