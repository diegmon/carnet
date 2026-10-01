import { describe, it, expect } from 'vitest';
import { Motor } from '../../app/src/estado/motor';
import { persistenciaMemoria } from '../../app/src/estado/persistencia';
import { motorDePrueba, conCarnet, HOY, USUARIA } from './ayuda';
import { AlmacenMemoria } from '../../src/receptor/almacen';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { sembrar } from '../../src/receptor/semillas';
import { cambiosDesde } from '../../src/receptor/cambios';
import type { Operacion, ResultadoOp } from '../../src/dominio/operaciones';

/** Un receptor en memoria para simular respuestas reales. */
function receptor() {
  const a = new AlmacenMemoria({
    usuarios: [{ correo: USUARIA.correo, nombre: 'Ana Torres', cargo: 'Enlace', activo: true }],
    config: [{ clave: 'ultimo_folio', valor: '16' }, { clave: 'ultimo_rev', valor: '0' }],
  });
  sembrar(a, () => '2026-10-01T00:00:00.000Z', '');
  return {
    a,
    responder(ops: Operacion[], cursor: number): { resultados: ResultadoOp[]; cambios: ReturnType<typeof cambiosDesde> } {
      const { resultados } = aplicarOperaciones(a, USUARIA.correo, ops, () => '2026-10-01T17:00:00.000Z');
      return { resultados, cambios: cambiosDesde(a, cursor) };
    },
  };
}

describe('Motor con sincronización', () => {
  it('aplica la respuesta: saca lo aplicado, guarda lo rechazado en problemas y trae el folio definitivo', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const mala: Operacion = { op_id: 'mala', tipo: 'actualizar', entidad: 'reunion', id: 'no-existe', ts: m.ts(), cambios: { tema: 'x' } };
    m.cola.push(mala);
    const r = receptor();
    const enviadas = [...m.cola];
    m.aplicarRespuesta(enviadas, r.responder(enviadas, m.cursor));
    expect(m.cola).toEqual([]);
    expect(m.problemas.map(p => p.op.op_id)).toEqual(['mala']);
    expect(m.problemas[0].motivo).toMatch(/no existe/);
    expect(m.almacen.filas('personas').find(p => p.id === pid)!.folio).toBe('CA-017');
    expect(m.cursor).toBeGreaterThan(0);
  });

  it('lo capturado mientras el lote viajaba se queda en la cola (Review Focus 1)', async () => {
    const m = await motorDePrueba();
    conCarnet(m, 'María');
    const enviadas = [...m.cola];
    const r = receptor();
    const respuesta = r.responder(enviadas, m.cursor);
    const nueva = m.crear('persona', { nombre: 'Rosa', tipo: 'Atendida' });
    m.ejecutar(nueva);
    m.aplicarRespuesta(enviadas, respuesta);
    expect(m.cola).toEqual([nueva]);
    expect(m.almacen.filas('personas').map(p => [p.nombre, p.folio])).toEqual([['María', 'CA-017'], ['Rosa', 'PROV-001']]);
  });

  it('base, cursor y problemas sobreviven a cerrar y reabrir', async () => {
    const p = persistenciaMemoria();
    const m = await motorDePrueba(true, p);
    conCarnet(m);
    const r = receptor();
    const enviadas = [...m.cola];
    m.aplicarRespuesta(enviadas, r.responder(enviadas, 0));
    m.problemas.push({ op: enviadas[0], motivo: 'prueba', fecha: m.ts() });
    m.descartarProblema('no-existe');
    m.fijarEstadoSync({ fase: 'al_dia' });
    await m.esperarGuardado();
    const otra = await Motor.abrir(p, () => HOY);
    expect(otra.cursor).toBe(m.cursor);
    expect(otra.base.personas).toHaveLength(1);
    expect(otra.almacen.filas('personas')[0].folio).toBe('CA-017');
  });

  it('marcarFotoSubida pone la liga en base y vista; descartarProblema lo quita', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const reu = m.crear('reunion', { fecha: '2026-09-30' });
    m.ejecutar(reu, m.crear('asistente', { reunion_id: reu.id, persona_id: pid, papel: 'Atendida' }));
    await m.agregarFoto(reu.id, new Blob(['x'], { type: 'image/jpeg' }), '');
    const r = receptor();
    const enviadas = [...m.cola];
    m.aplicarRespuesta(enviadas, r.responder(enviadas, 0));
    const anexo = String(m.almacen.filas('anexos')[0].id);
    m.marcarFotoSubida(anexo, 'https://drive.example/a.jpg');
    expect(m.almacen.filas('anexos')[0].drive_url).toBe('https://drive.example/a.jpg');
    expect(m.base.anexos![0].drive_url).toBe('https://drive.example/a.jpg');
    m.problemas.push({ op: enviadas[0], motivo: 'x', fecha: m.ts() });
    m.descartarProblema(enviadas[0].op_id);
    expect(m.problemas).toEqual([]);
  });
});
