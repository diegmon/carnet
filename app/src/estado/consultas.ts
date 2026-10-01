import type { Almacen } from '../../../src/receptor/almacen';
import type { NombreTabla } from '../../../src/dominio/esquema';
import { ESTADOS_ACUERDO, EstadoAcuerdo, esFolioProvisional, verdadero, Fila, Valor } from '../../../src/dominio/tipos';
import { normalizar } from '../../../src/dominio/texto';
import { diasEntre } from './fechas';

export function separar(v: Valor | undefined): string[] {
  if (v === undefined || v === '') return [];
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

export function porId(a: Almacen, t: NombreTabla, id: string): Fila | undefined {
  return a.filas(t).find(f => f.id === id);
}

const vivo = (f: Fila) => !verdadero(f.anulado) && !verdadero(f.quitado);
const porNombre = (x: Fila, y: Fila) => String(x.nombre).localeCompare(String(y.nombre), 'es');

export function textoFolio(p: Fila): string {
  const f = String(p.folio ?? '');
  if (!f) return 'Sin carnet';
  return esFolioProvisional(f) ? 'Folio pendiente' : f;
}

export function nombreInstitucion(a: Almacen, clave: string): string {
  const i = porId(a, 'instituciones', clave);
  if (!i) return clave;
  const corto = (x: Fila) => String(x.siglas || x.nombre);
  if (i.area_de) {
    const padre = porId(a, 'instituciones', String(i.area_de));
    return padre ? `${corto(padre)} › ${corto(i)}` : corto(i);
  }
  return corto(i);
}

export function institucionesOrdenadas(a: Almacen): Fila[] {
  return a.filas('instituciones').sort((x, y) =>
    (Number(y.usos || 0) - Number(x.usos || 0))
    || nombreInstitucion(a, String(x.id)).localeCompare(nombreInstitucion(a, String(y.id)), 'es'));
}

export function carnets(a: Almacen): Fila[] {
  return a.filas('personas').filter(p => p.tipo === 'Atendida' && !verdadero(p.anulado)).sort(porNombre);
}

export function buscarPersonas(a: Almacen, texto: string, limite = 20): Fila[] {
  const palabrasBuscadas = normalizar(texto).split(' ').filter(Boolean);
  if (!palabrasBuscadas.length) return [];
  return a.filas('personas')
    .filter(p => !verdadero(p.anulado))
    .filter(p => {
      const donde = normalizar([p.nombre, p.folio, p.colectivo].map(v => String(v ?? '')).join(' '));
      return palabrasBuscadas.every(w => donde.includes(w));
    })
    .sort(porNombre)
    .slice(0, limite);
}

const palabras = (s: string) => normalizar(s).split(' ').filter(w => w.length >= 3);

export function parecidas(a: Almacen, nombre: string): Fila[] {
  const buscadas = palabras(nombre);
  if (buscadas.length === 0) return [];
  return a.filas('personas').filter(p => {
    if (verdadero(p.anulado)) return false;
    if (normalizar(String(p.nombre)) === normalizar(nombre)) return true;
    const suyas = new Set(palabras(String(p.nombre)));
    return buscadas.filter(w => suyas.has(w)).length >= 2;
  });
}

export function personasDe(a: Almacen, ids: Valor | undefined): Fila[] {
  return separar(ids).map(id => porId(a, 'personas', id)).filter((p): p is Fila => !!p);
}

export type Filtro = { modo: 'mios' | 'equipo' | 'institucion'; usuario: string; institucion?: string };
export interface Grupos { mover: Fila[]; apoyo: Fila[]; mas_adelante: Fila[]; sin_fecha: Fila[] }

function coincideInstitucion(a: Almacen, acuerdo: Fila, clave: string): boolean {
  return separar(acuerdo.instituciones).some(k => k === clave || porId(a, 'instituciones', k)?.area_de === clave);
}

/** Acuerdos de reuniones selladas, no anulados y no cumplidos. */
function enCurso(a: Almacen): Fila[] {
  const selladas = new Set(a.filas('reuniones').filter(r => r.estado === 'Sellada' && !verdadero(r.anulado)).map(r => r.id));
  return a.filas('acuerdos').filter(ac => vivo(ac) && selladas.has(ac.reunion_id) && ac.estado_vigente !== 'Cumplido');
}

export function agruparSeguimiento(a: Almacen, hoy: string, filtro: Filtro): Grupos {
  const g: Grupos = { mover: [], apoyo: [], mas_adelante: [], sin_fecha: [] };
  for (const ac of enCurso(a)) {
    if (filtro.modo === 'mios' && ac.responsable !== filtro.usuario) continue;
    if (filtro.modo === 'institucion' && (!filtro.institucion || !coincideInstitucion(a, ac, filtro.institucion))) continue;
    if (ac.estado_vigente === 'Bloqueado') g.apoyo.push(ac);
    else if (!ac.fecha_acordada) g.sin_fecha.push(ac);
    else if (diasEntre(hoy, String(ac.fecha_acordada)) <= 7) g.mover.push(ac);
    else g.mas_adelante.push(ac);
  }
  const porFecha = (x: Fila, y: Fila) => String(x.fecha_acordada).localeCompare(String(y.fecha_acordada));
  g.mover.sort(porFecha);
  g.mas_adelante.sort(porFecha);
  g.sin_fecha.sort((x, y) => String(x.creado_en).localeCompare(String(y.creado_en)));
  return g;
}

export interface Ficha { persona: Fila; acuerdos: Fila[]; conteo: Record<EstadoAcuerdo, number>; reuniones: Fila[] }

export function fichaCarnet(a: Almacen, personaId: string): Ficha | undefined {
  const persona = porId(a, 'personas', personaId);
  if (!persona) return undefined;
  const acuerdos = a.filas('acuerdos').filter(ac => !verdadero(ac.quitado) && separar(ac.persona_ids).includes(personaId));
  const conteo = Object.fromEntries(ESTADOS_ACUERDO.map(e => [e, 0])) as Record<EstadoAcuerdo, number>;
  for (const ac of acuerdos) if (!verdadero(ac.anulado)) conteo[ac.estado_vigente as EstadoAcuerdo] += 1;
  const ids = new Set(a.filas('asistentes').filter(x => x.persona_id === personaId && vivo(x)).map(x => x.reunion_id));
  const reuniones = a.filas('reuniones').filter(r => ids.has(r.id)).sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  return { persona, acuerdos, conteo, reuniones };
}

export function hijos(a: Almacen, reunionId: string) {
  const de = (t: NombreTabla) => a.filas(t).filter(f => f.reunion_id === reunionId && !verdadero(f.quitado));
  return { asistentes: de('asistentes'), peticiones: de('peticiones'), acuerdos: de('acuerdos'), anexos: de('anexos') };
}

export function historial(a: Almacen, acuerdoId: string): Fila[] {
  return a.filas('historial_estados').filter(h => h.acuerdo_id === acuerdoId)
    .sort((x, y) => String(x.creado_en).localeCompare(String(y.creado_en)) || Number(x._rev) - Number(y._rev));
}

export function anulacionDe(a: Almacen, registroId: string): Fila | undefined {
  return a.filas('anulaciones').find(n => n.registro_id === registroId);
}

export function anulacionesDelMes(a: Almacen, hoy: string): Fila[] {
  return a.filas('anulaciones').filter(n => String(n.creado_en).slice(0, 7) === hoy.slice(0, 7));
}

export function nombreUsuario(a: Almacen, correo: string): string {
  const u = a.filas('usuarios').find(x => x.correo === correo);
  return u ? String(u.nombre) : correo;
}
