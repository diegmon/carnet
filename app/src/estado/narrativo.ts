import type { Almacen } from '../../../src/receptor/almacen';
import { esFolioProvisional, verdadero, Fila } from '../../../src/dominio/tipos';
import { hijos, nombreInstitucion, porId } from './consultas';
import { fechaLarga } from './fechas';

export function unirConY(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

/** Propuesta del párrafo de la Tarjeta. La persona la revisa y edita antes de sellar. */
export function borradorNarrativo(a: Almacen, reunionId: string): string {
  const r = porId(a, 'reuniones', reunionId);
  if (!r) return '';
  const presentes = hijos(a, reunionId).asistentes.filter(x => !verdadero(x.anulado));
  const persona = (x: Fila) => porId(a, 'personas', String(x.persona_id));
  const conFolio = (x: Fila) => {
    const folio = String(persona(x)?.folio ?? '');
    return folio && !esFolioProvisional(folio) ? `${x.nombre} (${folio})` : String(x.nombre);
  };
  const atendidas = presentes.filter(x => x.papel === 'Atendida').map(conFolio);
  const acompanantes = presentes.filter(x => x.papel === 'Acompañante')
    .map(x => (x.parentesco_o_cargo ? `${x.nombre} (${x.parentesco_o_cargo})` : String(x.nombre)));
  const gobierno = presentes.filter(x => x.papel === 'Gobierno').map(x => {
    const p = persona(x);
    const cargo = x.parentesco_o_cargo || p?.cargo || '';
    const inst = p?.institucion ? nombreInstitucion(a, String(p.institucion)) : '';
    return [String(x.nombre), String(cargo), inst].filter(Boolean).join(', ');
  });

  let s = `El día ${fechaLarga(String(r.fecha))}`;
  if (r.hora) s += `, a las ${r.hora} horas`;
  s += ', se llevó a cabo una reunión';
  if (r.modalidad) s += ` de manera ${String(r.modalidad).toLowerCase()}`;
  if (r.sede) s += ` en ${r.sede}`;
  if (atendidas.length) s += `, con ${atendidas.length === 1 ? 'la persona' : 'las personas'} ${unirConY(atendidas)}`;
  const partes = [`${s}.`];
  if (acompanantes.length) partes.push(`Asistieron también: ${unirConY(acompanantes)}.`);
  if (gobierno.length) partes.push(`Por parte del gobierno: ${unirConY(gobierno)}.`);
  return partes.join(' ');
}
