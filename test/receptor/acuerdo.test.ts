import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { almacenBase, reloj, USUARIO, OTRO, crear, actualizar, sellar } from './ayuda';
import type { Operacion } from '../../src/dominio/operaciones';
import type { AlmacenMemoria } from '../../src/receptor/almacen';

const aplicar = (a: AlmacenMemoria, ...ops: Operacion[]) => aplicarOperaciones(a, USUARIO, ops, reloj());

function conAcuerdoSellado(a: AlmacenMemoria) {
  aplicar(a,
    crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }),
    crear('reunion', 'r1', { fecha: '2026-09-30' }),
    crear('asistente', 'a1', { reunion_id: 'r1', persona_id: 'p1', papel: 'Atendida' }),
    crear('acuerdo', 'ac1', { reunion_id: 'r1', texto: 'Cita con la Fiscal', persona_ids: 'p1', instituciones: 'fiscalia', responsable: USUARIO }),
    sellar('r1'));
}

describe('estados de acuerdo', () => {
  it('agrega renglones al historial y actualiza el vigente', () => {
    const a = almacenBase();
    conAcuerdoSellado(a);
    const r = aplicar(a,
      crear('estado_acuerdo', 'e1', { acuerdo_id: 'ac1', estado: 'En gestión', nota: 'Oficio enviado' }, '2026-10-01T10:00:00-06:00'),
      crear('estado_acuerdo', 'e2', { acuerdo_id: 'ac1', estado: 'Cumplido', nota: 'Reunión realizada' }, '2026-10-03T12:00:00-06:00'));
    expect(r.resultados.map(x => x.estado)).toEqual(['aplicada', 'aplicada']);
    expect(a.filas('historial_estados').map(h => h.estado)).toEqual(['Por iniciar', 'En gestión', 'Cumplido']);
    expect(a.filas('acuerdos')[0].estado_vigente).toBe('Cumplido');
  });

  it('Bloqueado y Cumplido exigen nota; estado debe ser válido', () => {
    const a = almacenBase();
    conAcuerdoSellado(a);
    const r = aplicar(a,
      crear('estado_acuerdo', 'e1', { acuerdo_id: 'ac1', estado: 'Bloqueado' }),
      crear('estado_acuerdo', 'e2', { acuerdo_id: 'ac1', estado: 'Cumplido', nota: '' }),
      crear('estado_acuerdo', 'e3', { acuerdo_id: 'ac1', estado: 'Vencido', nota: 'x' }),
      crear('estado_acuerdo', 'e4', { acuerdo_id: 'nada', estado: 'En gestión' }));
    expect(r.resultados.map(x => x.estado)).toEqual(['rechazada', 'rechazada', 'rechazada', 'rechazada']);
    expect(r.resultados[0].motivo).toMatch(/nota/);
  });

  it('cambios que llegan fuera de orden: gana la captura más reciente (Review Focus 4)', () => {
    const a = almacenBase();
    conAcuerdoSellado(a);
    aplicar(a, crear('estado_acuerdo', 'e-tarde', { acuerdo_id: 'ac1', estado: 'Cumplido', nota: 'Hecho' }, '2026-10-05T09:00:00-06:00'));
    aplicarOperaciones(a, OTRO, [crear('estado_acuerdo', 'e-temprano', { acuerdo_id: 'ac1', estado: 'En gestión', nota: '' }, '2026-10-02T09:00:00-06:00')], reloj());
    expect(a.filas('acuerdos')[0].estado_vigente).toBe('Cumplido');
    expect(a.filas('historial_estados')).toHaveLength(3);
  });
});

describe('anulaciones', () => {
  it('anula con nota aclaratoria, marca el registro y bloquea cambios posteriores', () => {
    const a = almacenBase();
    conAcuerdoSellado(a);
    const r = aplicar(a,
      crear('anulacion', 'n0', { entidad: 'acuerdo', registro_id: 'ac1', nota_aclaratoria: 'corto' }),
      crear('anulacion', 'n1', { entidad: 'acuerdo', registro_id: 'ac1', nota_aclaratoria: 'Se registró en el carnet equivocado' }),
      crear('anulacion', 'n2', { entidad: 'acuerdo', registro_id: 'ac1', nota_aclaratoria: 'Segunda anulación del mismo' }),
      crear('estado_acuerdo', 'e1', { acuerdo_id: 'ac1', estado: 'En gestión' }),
      crear('anulacion', 'n3', { entidad: 'usuario', registro_id: 'x', nota_aclaratoria: 'No se puede anular esto' }));
    expect(r.resultados.map(x => x.estado)).toEqual(['rechazada', 'aplicada', 'rechazada', 'rechazada', 'rechazada']);
    expect(r.resultados[0].motivo).toMatch(/10 caracteres/);
    expect(a.filas('acuerdos')[0].anulado).toBe(true);
    expect(a.filas('anulaciones')[0]).toMatchObject({ entidad: 'acuerdo', registro_id: 'ac1', creado_por: USUARIO });
  });

  it('una persona anulada ya no se actualiza', () => {
    const a = almacenBase();
    conAcuerdoSellado(a);
    aplicar(a, crear('anulacion', 'n1', { entidad: 'persona', registro_id: 'p1', nota_aclaratoria: 'Registro duplicado de otra persona' }));
    expect(aplicar(a, actualizar('persona', 'p1', { contacto: '55' })).resultados[0].motivo).toMatch(/anulada/);
  });

  it('una reunión sustituta enlaza la anulación', () => {
    const a = almacenBase();
    conAcuerdoSellado(a);
    aplicar(a,
      crear('anulacion', 'n1', { entidad: 'reunion', registro_id: 'r1', nota_aclaratoria: 'Fecha equivocada en toda la reunión' }),
      crear('reunion', 'r2', { fecha: '2026-09-29', sustituye_a: 'r1' }));
    expect(a.filas('anulaciones')[0].sustituido_por).toBe('r2');
    expect(aplicar(a, crear('reunion', 'r3', { fecha: '2026-09-29', sustituye_a: 'r2' })).resultados[0].motivo).toMatch(/anulado/);
  });
});
