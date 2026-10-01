import { describe, it, expect } from 'vitest';
import {
  agruparSeguimiento, buscarPersonas, parecidas, fichaCarnet, nombreInstitucion, textoFolio,
  institucionesOrdenadas, hijos, anulacionesDelMes, carnets,
} from '../../app/src/estado/consultas';
import { motorDePrueba, conCarnet, reunionCon, USUARIA } from './ayuda';
import type { Motor } from '../../app/src/estado/motor';

function acuerdo(m: Motor, reunionId: string, personaId: string, texto: string, extra: Record<string, string> = {}) {
  const op = m.crear('acuerdo', { reunion_id: reunionId, texto, persona_ids: personaId, instituciones: 'fiscalia-mp', responsable: USUARIA.correo, ...extra });
  if (!m.ejecutar(op).ok) throw new Error('acuerdo');
  return op.id;
}

describe('búsqueda (Review Focus 2)', () => {
  it('encuentra sin acentos ni mayúsculas, por colectivo y por folio', async () => {
    const m = await motorDePrueba();
    m.ejecutar(m.crear('persona', { nombre: 'María Ríos', tipo: 'Atendida', colectivo: 'Colectivo Raíces' }));
    m.ejecutar(m.crear('persona', { nombre: 'Jorge Ríos', tipo: 'Acompañante' }));
    expect(buscarPersonas(m.almacen, 'maria rios').map(p => p.nombre)).toEqual(['María Ríos']);
    expect(buscarPersonas(m.almacen, 'RAICES').map(p => p.nombre)).toEqual(['María Ríos']);
    expect(buscarPersonas(m.almacen, '001').map(p => p.nombre)).toEqual(['María Ríos']);
    expect(buscarPersonas(m.almacen, 'rios').map(p => p.nombre)).toEqual(['Jorge Ríos', 'María Ríos']);
    expect(buscarPersonas(m.almacen, '   ')).toEqual([]);
  });
  it('detecta nombres parecidos', async () => {
    const m = await motorDePrueba();
    conCarnet(m, 'María Fernanda Ríos');
    expect(parecidas(m.almacen, 'Maria Fernanda Rios Calderón')).toHaveLength(1);
    expect(parecidas(m.almacen, 'Jorge Ríos')).toHaveLength(0);
  });
});

describe('textos', () => {
  it('folio y nombres de institución', async () => {
    const m = await motorDePrueba();
    const id = conCarnet(m);
    expect(textoFolio(m.almacen.filas('personas').find(p => p.id === id)!)).toBe('Folio pendiente');
    expect(textoFolio({ folio: 'CA-017' })).toBe('CA-017');
    expect(textoFolio({ folio: '' })).toBe('Sin carnet');
    expect(nombreInstitucion(m.almacen, 'fiscalia-mp')).toBe('FISCALÍA › MP');
    expect(nombreInstitucion(m.almacen, 'salud-clinica')).toBe('SALUD › Clínica Especializada');
    expect(nombreInstitucion(m.almacen, 'no-existe')).toBe('no-existe');
  });
});

describe('seguimiento', () => {
  async function escenario() {
    const m = await motorDePrueba();
    m.almacen.agregar('usuarios', { correo: 'luis.vega@ejemplo.mx', nombre: 'Luis Vega', cargo: '', activo: true });
    const pid = conCarnet(m);
    const r = reunionCon(m, pid);
    const a1 = acuerdo(m, r, pid, 'Reunión con la Fiscal', { fecha_acordada: '2026-09-28' });
    const a2 = acuerdo(m, r, pid, 'Difusión de volantes', { fecha_acordada: '2026-11-15' });
    const a3 = acuerdo(m, r, pid, 'Atención psicológica');
    const a4 = acuerdo(m, r, pid, 'Revisión de cámaras', { fecha_acordada: '2026-10-01' });
    const a5 = acuerdo(m, r, pid, 'Incorporación a programa', { fecha_acordada: '2026-09-29' });
    const a6 = acuerdo(m, r, pid, 'Mesa con colectivo', { responsable: 'luis.vega@ejemplo.mx', fecha_acordada: '2026-10-02' });
    m.ejecutar(m.sellar(r));
    m.ejecutar(m.crear('estado_acuerdo', { acuerdo_id: a4, estado: 'Bloqueado', nota: 'Sin respuesta al oficio' }));
    m.ejecutar(m.crear('estado_acuerdo', { acuerdo_id: a5, estado: 'Cumplido', nota: 'Alta confirmada' }));
    return { m, ids: { a1, a2, a3, a4, a5, a6 } };
  }
  it('agrupa lo mío: para mover, necesitan apoyo, más adelante y sin fecha; excluye cumplidos', async () => {
    const { m, ids } = await escenario();
    const g = agruparSeguimiento(m.almacen, '2026-09-30', { modo: 'mios', usuario: USUARIA.correo });
    expect(g.mover.map(x => x.id)).toEqual([ids.a1]);
    expect(g.apoyo.map(x => x.id)).toEqual([ids.a4]);
    expect(g.mas_adelante.map(x => x.id)).toEqual([ids.a2]);
    expect(g.sin_fecha.map(x => x.id)).toEqual([ids.a3]);
  });
  it('todo el equipo incluye lo de otras personas; por institución acepta áreas', async () => {
    const { m, ids } = await escenario();
    const equipo = agruparSeguimiento(m.almacen, '2026-09-30', { modo: 'equipo', usuario: USUARIA.correo });
    expect(equipo.mover.map(x => x.id)).toEqual([ids.a1, ids.a6]);
    const fgj = agruparSeguimiento(m.almacen, '2026-09-30', { modo: 'institucion', usuario: USUARIA.correo, institucion: 'fiscalia' });
    expect(fgj.mover).toHaveLength(2);
    const seguridad = agruparSeguimiento(m.almacen, '2026-09-30', { modo: 'institucion', usuario: USUARIA.correo, institucion: 'seguridad' });
    expect(seguridad.mover).toHaveLength(0);
  });
  it('los acuerdos de una reunión en borrador aún no entran a seguimiento', async () => {
    const m = await motorDePrueba();
    const pid = conCarnet(m);
    const r = reunionCon(m, pid);
    acuerdo(m, r, pid, 'En captura', { fecha_acordada: '2026-09-30' });
    expect(agruparSeguimiento(m.almacen, '2026-09-30', { modo: 'equipo', usuario: USUARIA.correo }).mover).toHaveLength(0);
  });
  it('la ficha del carnet cuenta acuerdos por estado y lista sus reuniones', async () => {
    const { m } = await escenario();
    const pid = String(carnets(m.almacen)[0].id);
    const f = fichaCarnet(m.almacen, pid)!;
    expect(f.acuerdos).toHaveLength(6);
    expect(f.conteo).toEqual({ 'Por iniciar': 4, 'En gestión': 0, Bloqueado: 1, Cumplido: 1 });
    expect(f.reuniones).toHaveLength(1);
    expect(hijos(m.almacen, String(f.reuniones[0].id)).acuerdos).toHaveLength(6);
  });
  it('ordena instituciones por uso y cuenta anulaciones del mes', async () => {
    const { m, ids } = await escenario();
    expect(institucionesOrdenadas(m.almacen)[0].id).toBe('fiscalia-mp');
    m.ejecutar(m.crear('anulacion', { entidad: 'acuerdo', registro_id: ids.a3, nota_aclaratoria: 'Duplicado de otro acuerdo' }));
    expect(anulacionesDelMes(m.almacen, '2026-09-30')).toHaveLength(1);
    expect(anulacionesDelMes(m.almacen, '2026-10-01')).toHaveLength(0);
  });
});
