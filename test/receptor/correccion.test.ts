import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { almacenBase, reloj, USUARIO, crear, sellar } from './ayuda';
import type { Operacion } from '../../src/dominio/operaciones';
import type { AlmacenMemoria } from '../../src/receptor/almacen';

const aplicar = (a: AlmacenMemoria, ...ops: Operacion[]) => aplicarOperaciones(a, USUARIO, ops, reloj());
const datosAcuerdo = (reunion: string, extra: Record<string, string> = {}) =>
  ({ reunion_id: reunion, texto: 'Cita con la Fiscal', persona_ids: 'p1', instituciones: 'fiscalia', responsable: USUARIO, ...extra });

function selladaConAcuerdo(a: AlmacenMemoria, reunion = 'r1', acuerdo = 'ac1') {
  aplicar(a,
    crear('reunion', reunion, { fecha: '2026-09-30' }),
    crear('asistente', `${reunion}-a`, { reunion_id: reunion, persona_id: 'p1', papel: 'Atendida' }),
    crear('acuerdo', acuerdo, datosAcuerdo(reunion)),
    sellar(reunion));
}

describe('corrección de un acuerdo en la misma reunión sellada', () => {
  it('agrega el acuerdo correcto como NN-C, enlazado al anulado', () => {
    const a = almacenBase();
    aplicar(a, crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }));
    selladaConAcuerdo(a);
    aplicar(a, crear('anulacion', 'n1', { entidad: 'acuerdo', registro_id: 'ac1', nota_aclaratoria: 'Institución equivocada' }));
    const r = aplicar(a, crear('acuerdo', 'ac2', datosAcuerdo('r1', { instituciones: 'fiscalia-mp', sustituye_a: 'ac1' })));
    expect(r.resultados[0].estado).toBe('aplicada');
    expect(a.filas('acuerdos').find(x => x.id === 'ac2')).toMatchObject({
      numero: '01-C', carnets: 'CA-001', estado_vigente: 'Por iniciar', reunion_id: 'r1',
    });
    expect(a.filas('anulaciones')[0].sustituido_por).toBe('ac2');
    expect(a.filas('reuniones')).toHaveLength(1);
  });

  it('sin sustituye_a, o si el anulado no es de esa reunión, o si no está anulado, se rechaza', () => {
    const a = almacenBase();
    aplicar(a, crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }));
    selladaConAcuerdo(a, 'r1', 'ac1');
    selladaConAcuerdo(a, 'r2', 'ac9');
    aplicar(a, crear('anulacion', 'n9', { entidad: 'acuerdo', registro_id: 'ac9', nota_aclaratoria: 'Institución equivocada' }));
    const r = aplicar(a,
      crear('acuerdo', 'x1', datosAcuerdo('r1')),
      crear('acuerdo', 'x2', datosAcuerdo('r1', { sustituye_a: 'ac9' })),
      crear('acuerdo', 'x3', datosAcuerdo('r1', { sustituye_a: 'ac1' })),
      crear('peticion', 'x4', { reunion_id: 'r1', texto: 'Algo más' }));
    expect(r.resultados.map(x => x.estado)).toEqual(['rechazada', 'rechazada', 'rechazada', 'rechazada']);
    expect(r.resultados[0].motivo).toMatch(/sellada/);
    expect(r.resultados[1].motivo).toMatch(/sellada/);
    expect(r.resultados[2].motivo).toMatch(/anulado/);
  });
});

describe('revisión: la excepción de corrección no se puede abusar', () => {
  function base() {
    const a = almacenBase();
    aplicar(a, crear('persona', 'p1', { nombre: 'María', tipo: 'Atendida' }));
    selladaConAcuerdo(a);
    aplicar(a, crear('anulacion', 'n1', { entidad: 'acuerdo', registro_id: 'ac1', nota_aclaratoria: 'Institución equivocada' }));
    return a;
  }
  it('un acuerdo anulado solo admite una corrección', () => {
    const a = base();
    expect(aplicar(a, crear('acuerdo', 'c1', datosAcuerdo('r1', { sustituye_a: 'ac1' }))).resultados[0].estado).toBe('aplicada');
    const r = aplicar(a, crear('acuerdo', 'c2', datosAcuerdo('r1', { sustituye_a: 'ac1' })));
    expect(r.resultados[0].motivo).toMatch(/ya tiene/);
    expect(a.filas('anulaciones')[0].sustituido_por).toBe('c1');
  });
  it('no se corrige dentro de una reunión anulada', () => {
    const a = base();
    aplicar(a, crear('anulacion', 'n2', { entidad: 'reunion', registro_id: 'r1', nota_aclaratoria: 'Reunión capturada por error' }));
    const r = aplicar(a, crear('acuerdo', 'c1', datosAcuerdo('r1', { sustituye_a: 'ac1' })));
    expect(r.resultados[0].motivo).toMatch(/anulada/);
  });
});
