import { useState } from 'preact/hooks';
import { useMotor, useNav } from './contexto';
import { Campo, Selector, TarjetaAcuerdo } from './comunes';
import {
  agruparSeguimiento, anulacionesDelMes, buscarPersonas, Filtro, institucionesOrdenadas, nombreInstitucion, textoFolio,
} from '../estado/consultas';
import { horaLocal } from '../estado/fechas';
import type { Fila } from '../../../src/dominio/tipos';
import { PERFIL } from '../../../src/dominio/perfil';

function Grupo({ titulo, filas, hoy }: { titulo: string; filas: Fila[]; hoy: string }) {
  if (!filas.length) return null;
  return (
    <>
      <p class="grupo-titulo">{titulo}</p>
      <div class="pila">{filas.map(a => <TarjetaAcuerdo key={String(a.id)} acuerdo={a} hoy={hoy} />)}</div>
    </>
  );
}

export function Seguimiento() {
  const m = useMotor();
  const nav = useNav();
  const [modo, setModo] = useState<Filtro['modo']>('mios');
  const [institucion, setInstitucion] = useState('');
  const [q, setQ] = useState('');
  const hoy = m.hoy();
  const g = agruparSeguimiento(m.almacen, hoy, { modo, usuario: m.sesion!.correo, institucion });
  const total = g.mover.length + g.apoyo.length + g.mas_adelante.length + g.sin_fecha.length;
  const resultados = buscarPersonas(m.almacen, q);
  const anulaciones = anulacionesDelMes(m.almacen, hoy).length;
  const raices = institucionesOrdenadas(m.almacen).filter(i => !i.area_de);

  const nuevaReunion = () => {
    const op = m.crear('reunion', { fecha: hoy, hora: horaLocal(m.reloj()) });
    if (m.ejecutar(op).ok) nav.ir({ p: 'reunion', id: op.id });
  };
  const filtro = (valor: Filtro['modo'], texto: string) =>
    <button aria-pressed={modo === valor} onClick={() => setModo(valor)}>{texto}</button>;

  return (
    <div class="pantalla">
      <header class="portada">
        <p class="marca">{PERFIL.institucion}</p>
        <h1>Carnet de Atención</h1>
      </header>
      <div class="pila">
        <Campo etiqueta="Buscar persona o folio" valor={q} alCambiar={setQ} />
        {q.trim() && (
          <ul class="lista">
            {resultados.map(p => (
              <li key={String(p.id)}>
                <button class="renglon" onClick={() => nav.ir({ p: 'carnet', id: String(p.id) })}>
                  <strong>{String(p.nombre)}</strong>
                  <small>{textoFolio(p)}{p.colectivo ? ` · ${p.colectivo}` : ''}</small>
                </button>
              </li>
            ))}
            {!resultados.length && <li class="vacio">Sin resultados</li>}
          </ul>
        )}
        <button class="primario grande" onClick={nuevaReunion}>Nueva reunión</button>
      </div>
      <div class="fila-titulo" style="padding: 0 16px">
        <h2 class="titulo-pantalla" style="margin: 8px 0 0">Seguimiento</h2>
        <span class="sub">{total} {total === 1 ? 'acuerdo' : 'acuerdos'} en curso</span>
      </div>
      <div class="filtros">
        {filtro('mios', 'Míos')}
        {filtro('equipo', 'Todo el equipo')}
        {filtro('institucion', 'Por institución')}
      </div>
      {modo === 'institucion' && (
        <div class="pila">
          <Selector etiqueta="Institución" valor={institucion}
            opciones={[['', 'Elegir…'], ...raices.map(i => [String(i.id), nombreInstitucion(m.almacen, String(i.id))] as [string, string])]}
            alCambiar={setInstitucion} />
        </div>
      )}
      <Grupo titulo="PARA MOVER ESTA SEMANA" filas={g.mover} hoy={hoy} />
      <Grupo titulo="NECESITAN APOYO" filas={g.apoyo} hoy={hoy} />
      <Grupo titulo="MÁS ADELANTE" filas={g.mas_adelante} hoy={hoy} />
      <Grupo titulo="SIN FECHA ACORDADA" filas={g.sin_fecha} hoy={hoy} />
      {total === 0 && <p class="vacio">No hay acuerdos en curso{modo === 'mios' ? ' a tu cargo' : ''}.</p>}
      {anulaciones > 0 && (
        <div class="pila">
          <button class="enlace" onClick={() => nav.ir({ p: 'anulaciones' })}>
            {anulaciones} {anulaciones === 1 ? 'anulación' : 'anulaciones'} este mes
          </button>
        </div>
      )}
    </div>
  );
}
