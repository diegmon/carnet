import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { almacenBase, reloj, USUARIO, crear, actualizar, quitar, sellar } from './ayuda';
import type { Operacion } from '../../src/dominio/operaciones';
import type { AlmacenMemoria } from '../../src/receptor/almacen';

const aplicar = (a: AlmacenMemoria, ...ops: Operacion[]) => aplicarOperaciones(a, USUARIO, ops, reloj());

function reunionConAtendida(a: AlmacenMemoria) {
  return aplicar(a,
    crear('persona', 'p1', { nombre: 'María Fernanda Ríos', tipo: 'Atendida' }),
    crear('persona', 'p2', { nombre: 'Jorge Ríos', tipo: 'Acompañante' }),
    crear('reunion', 'r1', { fecha: '2026-09-30', hora: '17:00', modalidad: 'Presencial y virtual', sede: 'Centro de Atención', tema: 'Seguimiento' }),
    crear('asistente', 'a1', { reunion_id: 'r1', persona_id: 'p1', papel: 'Atendida' }),
    crear('asistente', 'a2', { reunion_id: 'r1', persona_id: 'p2', papel: 'Acompañante', parentesco_o_cargo: 'hermano' }));
}

describe('reuniones', () => {
  it('se crea en Borrador y copia el nombre del asistente', () => {
    const a = almacenBase();
    expect(reunionConAtendida(a).resultados.every(r => r.estado === 'aplicada')).toBe(true);
    expect(a.filas('reuniones')[0]).toMatchObject({ estado: 'Borrador', modalidad: 'Presencial y virtual' });
    expect(a.filas('asistentes')[1]).toMatchObject({ nombre: 'Jorge Ríos', parentesco_o_cargo: 'hermano', quitado: false });
  });

  it('valida fecha, hora y modalidad', () => {
    const a = almacenBase();
    const r = aplicar(a,
      crear('reunion', 'r1', { fecha: '2026-02-30' }),
      crear('reunion', 'r2', { fecha: '2026-09-30', hora: '25:00' }),
      crear('reunion', 'r3', { fecha: '2026-09-30', modalidad: 'Híbrida' }),
      crear('reunion', 'r4', { hora: '10:00' }));
    expect(r.resultados.map(x => x.estado)).toEqual(['rechazada', 'rechazada', 'rechazada', 'rechazada']);
  });

  it('un asistente Atendida debe tener carnet', () => {
    const a = almacenBase();
    reunionConAtendida(a);
    const r = aplicar(a, crear('asistente', 'a3', { reunion_id: 'r1', persona_id: 'p2', papel: 'Atendida' }));
    expect(r.resultados[0].motivo).toMatch(/carnet/);
  });

  it('crea acuerdo con estado inicial, cuenta usos de institución y exige carnet, institución y responsable', () => {
    const a = almacenBase();
    reunionConAtendida(a);
    const r = aplicar(a,
      crear('acuerdo', 'ac1', { reunion_id: 'r1', texto: 'Reunión con la Fiscal', persona_ids: 'p1', instituciones: 'fiscalia-mp', responsable: USUARIO, fecha_acordada: '2026-10-03T10:00' }),
      crear('acuerdo', 'ac2', { reunion_id: 'r1', texto: 'Sin carnet', persona_ids: 'p2', instituciones: 'fiscalia', responsable: USUARIO }),
      crear('acuerdo', 'ac3', { reunion_id: 'r1', texto: 'Sin institución', persona_ids: 'p1', instituciones: '', responsable: USUARIO }),
      crear('acuerdo', 'ac4', { reunion_id: 'r1', texto: 'Responsable ajeno', persona_ids: 'p1', instituciones: 'fiscalia', responsable: 'nadie@ejemplo.mx' }));
    expect(r.resultados.map(x => x.estado)).toEqual(['aplicada', 'rechazada', 'rechazada', 'rechazada']);
    expect(a.filas('acuerdos')[0].estado_vigente).toBe('Por iniciar');
    expect(a.filas('historial_estados')[0]).toMatchObject({ id: 'ac1:inicial', acuerdo_id: 'ac1', estado: 'Por iniciar' });
    expect(a.filas('instituciones').find(i => i.id === 'fiscalia-mp')!.usos).toBe(1);
  });

  it('en Borrador se puede editar y quitar; al sellar se numera y calcula carnets', () => {
    const a = almacenBase();
    reunionConAtendida(a);
    aplicar(a,
      crear('peticion', 'pe1', { reunion_id: 'r1', texto: 'Primera' }),
      crear('peticion', 'pe2', { reunion_id: 'r1', texto: 'Se quitará' }),
      crear('peticion', 'pe3', { reunion_id: 'r1', texto: 'Tercera', persona_ids: 'p1' }),
      crear('acuerdo', 'ac1', { reunion_id: 'r1', texto: 'Uno', persona_ids: 'p1', instituciones: 'fiscalia', responsable: USUARIO }),
      actualizar('reunion', 'r1', { narrativo: 'El día 30…' }),
      actualizar('peticion', 'pe1', { texto: 'Primera corregida' }),
      quitar('peticion', 'pe2'));
    const s = aplicar(a, sellar('r1'));
    expect(s.resultados[0].estado).toBe('aplicada');
    const reunion = a.filas('reuniones')[0];
    expect(reunion).toMatchObject({ estado: 'Sellada', carnets: 'CA-001', narrativo: 'El día 30…' });
    expect(reunion.sellada_en).not.toBe('');
    const pets = a.filas('peticiones');
    expect(pets.map(p => [p.texto, p.numero, p.quitado])).toEqual([
      ['Primera corregida', '01', false], ['Se quitará', '', true], ['Tercera', '02', false]]);
    expect(pets[2].carnets).toBe('CA-001');
    expect(a.filas('acuerdos')[0]).toMatchObject({ numero: '01', carnets: 'CA-001' });
  });

  it('no se puede sellar sin persona atendida', () => {
    const a = almacenBase();
    aplicar(a, crear('reunion', 'r1', { fecha: '2026-09-30' }));
    expect(aplicar(a, sellar('r1')).resultados[0].motivo).toMatch(/atendida/);
  });

  it('una reunión sellada ya no acepta cambios ni hijos nuevos', () => {
    const a = almacenBase();
    reunionConAtendida(a);
    aplicar(a, sellar('r1'));
    const r = aplicar(a,
      actualizar('reunion', 'r1', { tema: 'otro' }),
      crear('peticion', 'pe9', { reunion_id: 'r1', texto: 'tarde' }),
      actualizar('asistente', 'a2', { parentesco_o_cargo: 'primo' }),
      quitar('asistente', 'a2'),
      sellar('r1'));
    expect(r.resultados.every(x => x.estado === 'rechazada' && /sellada/.test(x.motivo!))).toBe(true);
  });
});
