import { useState } from 'preact/hooks';
import { useMotor, useNav } from './contexto';
import { Aviso, Campo, CampoDiferido, Encabezado, Insignia, Seccion, Selector, useBorrador } from './comunes';
import { Anular } from './Anular';
import {
  anulacionDe, hijos, historial, institucionesOrdenadas, nombreInstitucion, nombreUsuario, personasDe, porId, separar, textoFolio,
} from '../estado/consultas';
import { fechaLarga, textoFechaAcordada } from '../estado/fechas';
import { ESTADOS_ACUERDO, ESTADOS_CON_NOTA, EstadoAcuerdo, verdadero, Fila } from '../../../src/dominio/tipos';
import { normalizar } from '../../../src/dominio/texto';

export function NuevoAcuerdo({ reunionId, sustituyeA }: { reunionId: string; sustituyeA?: string }) {
  const m = useMotor();
  const nav = useNav();
  const atendidas = hijos(m.almacen, reunionId).asistentes.filter(a => a.papel === 'Atendida' && !verdadero(a.anulado));
  const [texto, setTexto] = useBorrador(`carnet:borrador:acuerdo:${reunionId}:${sustituyeA ?? ''}`);
  const [insts, setInsts] = useState<string[]>([]);
  const [elegidos, setElegidos] = useState<string[]>(atendidas.length === 1 ? [String(atendidas[0].persona_id)] : []);
  const [responsable, setResponsable] = useState(m.sesion!.correo);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState('');
  const todas = institucionesOrdenadas(m.almacen);
  const sugeridas = buscar.trim()
    ? todas.filter(i => normalizar(`${nombreInstitucion(m.almacen, String(i.id))} ${i.nombre}`).includes(normalizar(buscar))).slice(0, 8)
    : todas.slice(0, 6);
  const alternar = (lista: string[], fijar: (x: string[]) => void, v: string) =>
    fijar(lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);
  const usuarios = m.almacen.filas('usuarios').filter(u => verdadero(u.activo));

  const guardar = () => {
    if (!texto.trim()) { setError('Escribe qué se acordó'); return; }
    if (!insts.length) { setError('Elige al menos una institución'); return; }
    if (!elegidos.length) { setError('Elige a qué carnet corresponde'); return; }
    const datos: Fila = {
      reunion_id: reunionId, texto: texto.trim(), instituciones: insts.join(','), persona_ids: elegidos.join(','), responsable,
    };
    if (fecha) datos.fecha_acordada = hora ? `${fecha}T${hora}` : fecha;
    if (sustituyeA) datos.sustituye_a = sustituyeA;
    const r = m.ejecutar(m.crear('acuerdo', datos));
    if (!r.ok) { setError(r.motivo ?? 'No se pudo guardar'); return; }
    setTexto('');
    nav.atras();
  };

  return (
    <div class="pantalla">
      <Encabezado titulo="Nuevo acuerdo" accion={<button class="primario" onClick={guardar}>Guardar</button>} />
      <div class="pila">
        {sustituyeA && <p class="nota">Corrección: este acuerdo sustituye a uno anulado de la misma reunión.</p>}
        <Campo etiqueta="¿Qué se acordó?" valor={texto} alCambiar={setTexto} multilinea />
        <Seccion titulo="Institución">
          {insts.length > 0 && <p>{insts.map(k => nombreInstitucion(m.almacen, k)).join(', ')}</p>}
          <Campo etiqueta="Buscar institución" valor={buscar} alCambiar={setBuscar} />
          <div class="opciones">
            {sugeridas.map(i => {
              const k = String(i.id);
              return <button key={k} class="opcion" aria-pressed={insts.includes(k)} onClick={() => alternar(insts, setInsts, k)}>{nombreInstitucion(m.almacen, k)}</button>;
            })}
          </div>
        </Seccion>
        <Seccion titulo="¿Para qué carnet?">
          {atendidas.length === 0 && <p class="nota">Primero agrega a la persona atendida en Presentes.</p>}
          <div class="opciones">
            {atendidas.map(a => {
              const pid = String(a.persona_id);
              const p = porId(m.almacen, 'personas', pid) ?? {};
              return <button key={pid} class="opcion" aria-pressed={elegidos.includes(pid)} onClick={() => alternar(elegidos, setElegidos, pid)}>{`${a.nombre} · ${textoFolio(p)}`}</button>;
            })}
          </div>
        </Seccion>
        <Selector etiqueta="Lo lleva" valor={responsable}
          opciones={usuarios.map(u => [String(u.correo), String(u.nombre)] as [string, string])} alCambiar={setResponsable} />
        <Campo etiqueta="Fecha acordada (opcional)" tipo="date" valor={fecha} alCambiar={setFecha} />
        <Campo etiqueta="Hora (opcional)" tipo="time" valor={hora} alCambiar={setHora} />
        <Aviso mensaje={error} />
      </div>
    </div>
  );
}

export function DetalleAcuerdo({ id }: { id: string }) {
  const m = useMotor();
  const nav = useNav();
  const [nuevo, setNuevo] = useState<EstadoAcuerdo | ''>('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const ac = porId(m.almacen, 'acuerdos', id);
  if (!ac) return <p class="vacio">No se encontró el acuerdo.</p>;
  const reunion = porId(m.almacen, 'reuniones', String(ac.reunion_id));
  const borrador = reunion?.estado === 'Borrador';
  const anulado = verdadero(ac.anulado);
  const anulacion = anulacionDe(m.almacen, id);
  const hist = historial(m.almacen, id);

  const guardarEstado = () => {
    if (!nuevo) return;
    if (ESTADOS_CON_NOTA.includes(nuevo) && !nota.trim()) { setError(`Para marcar ${nuevo} escribe una nota breve`); return; }
    const d: Fila = { acuerdo_id: id, estado: nuevo };
    if (nota.trim()) d.nota = nota.trim();
    const r = m.ejecutar(m.crear('estado_acuerdo', d));
    if (!r.ok) { setError(r.motivo ?? 'No se pudo guardar'); return; }
    setNuevo(''); setNota(''); setError('');
  };
  // La corrección se agrega a la misma reunión (excepción permitida por el receptor).
  const corregir = () => nav.ir({ p: 'nuevo-acuerdo', reunionId: String(ac.reunion_id), sustituyeA: id });

  return (
    <div class="pantalla">
      <Encabezado titulo={`Acuerdo ${ac.numero || ''}`.trim()} subtitulo={reunion ? fechaLarga(String(reunion.fecha)) : ''} />
      <div class="pila">
        {anulado && <p class="aviso">{`ANULADO · ${anulacion?.nota_aclaratoria ?? ''}`}</p>}
        <div class="tarjeta">
          {borrador
            ? <CampoDiferido etiqueta="Texto del acuerdo" multilinea valor={String(ac.texto)} alGuardar={v => {
                const r = m.ejecutar(m.actualizar('acuerdo', id, { texto: v }));
                setError(r.ok ? '' : r.motivo ?? '');
              }} />
            : <p><strong>{String(ac.texto)}</strong></p>}
          <p>{separar(ac.instituciones).map(k => nombreInstitucion(m.almacen, k)).join(', ')}</p>
          <p class="sub">{personasDe(m.almacen, ac.persona_ids).map(p => `${p.nombre} · ${textoFolio(p)}`).join(', ')}</p>
          <p class="sub">Lo lleva: {nombreUsuario(m.almacen, String(ac.responsable))} · {textoFechaAcordada(String(ac.fecha_acordada ?? ''), m.hoy())}</p>
          {borrador && <button class="enlace peligro" onClick={() => { if (m.ejecutar(m.quitar('acuerdo', id)).ok) nav.atras(); }}>Quitar acuerdo</button>}
        </div>

        <Seccion titulo="Historial">
          <ul class="historial">
            {hist.map(h => (
              <li key={String(h.id)}>
                <span><Insignia estado={String(h.estado)} /> {fechaLarga(String(h.creado_en))} · {nombreUsuario(m.almacen, String(h.creado_por))}</span>
                {h.nota && <span>{String(h.nota)}</span>}
              </li>
            ))}
          </ul>
        </Seccion>

        {!borrador && !anulado && (
          <Seccion titulo="Cambiar estado">
            <div class="opciones">
              {ESTADOS_ACUERDO.filter(e => e !== ac.estado_vigente).map(e => (
                <button key={e} class="opcion" aria-pressed={nuevo === e} onClick={() => setNuevo(e)}>{e}</button>
              ))}
            </div>
            <Campo etiqueta="Nota" valor={nota} alCambiar={setNota} multilinea />
            <button class="primario" onClick={guardarEstado}>Guardar estado</button>
          </Seccion>
        )}
        <Aviso mensaje={error} />
        {!borrador && !anulado && <Anular entidad="acuerdo" id={id} etiqueta="Anular acuerdo" />}
        {anulado && !anulacion?.sustituido_por && !verdadero(reunion?.anulado) && <button class="secundario" onClick={corregir}>Capturar el acuerdo correcto</button>}
      </div>
    </div>
  );
}
