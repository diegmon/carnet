import { useState } from 'preact/hooks';
import { useMotor, useNav } from './contexto';
import { Aviso, Campo, CampoDiferido, Encabezado, Seccion, Selector, useBorrador } from './comunes';
import { FormPersona } from './Carnets';
import { Anular } from './Anular';
import { Fotos } from './Fotos';
import { buscarPersonas, hijos, nombreInstitucion, porId, separar, textoFolio } from '../estado/consultas';
import { borradorNarrativo } from '../estado/narrativo';
import { fechaLarga } from '../estado/fechas';
import { MODALIDADES, PAPELES, verdadero, Fila } from '../../../src/dominio/tipos';
import type { Operacion } from '../../../src/dominio/operaciones';

export function Reunion({ id }: { id: string }) {
  const m = useMotor();
  const nav = useNav();
  const [error, setError] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [peticion, setPeticion] = useBorrador(`carnet:borrador:peticion:${id}`);
  const [terminando, setTerminando] = useState(false);
  const r = porId(m.almacen, 'reuniones', id);
  if (!r) return <p class="vacio">No se encontró la reunión.</p>;
  const borrador = r.estado === 'Borrador' && !verdadero(r.anulado);
  const h = hijos(m.almacen, id);
  const hacer = (...ops: Operacion[]) => {
    const res = m.ejecutar(...ops);
    setError(res.ok ? '' : res.motivo ?? 'No se pudo guardar');
    return res.ok;
  };
  const guardarDato = (campo: string) => (v: string) => hacer(m.actualizar('reunion', id, { [campo]: v }));
  const agregarPeticion = () => {
    if (!peticion.trim()) return;
    if (hacer(m.crear('peticion', { reunion_id: id, texto: peticion.trim() }))) setPeticion('');
  };
  const sellar = () => {
    if (hacer(m.sellar(id))) { setTerminando(false); nav.ir({ p: 'documentos' }); }
  };
  const persona = (a: Fila) => porId(m.almacen, 'personas', String(a.persona_id));
  const etiquetaPresente = (a: Fila) => {
    if (a.papel === 'Atendida') return `${a.nombre} · ${textoFolio(persona(a) ?? {})}`;
    if (a.papel === 'Gobierno') {
      const p = persona(a);
      const inst = p?.institucion ? nombreInstitucion(m.almacen, String(p.institucion)) : '';
      return [String(a.nombre), String(a.parentesco_o_cargo || p?.cargo || ''), inst].filter(Boolean).join(' · ');
    }
    return a.parentesco_o_cargo ? `${a.nombre} (${a.parentesco_o_cargo})` : String(a.nombre);
  };
  const darCarnet = (a: Fila) => hacer(
    m.actualizar('persona', String(a.persona_id), { tipo: 'Atendida' }),
    m.actualizar('asistente', String(a.id), { papel: 'Atendida' }),
  );
  const vivos = (xs: Fila[]) => xs.filter(x => !verdadero(x.anulado));

  return (
    <div class="pantalla">
      <Encabezado
        titulo={borrador ? 'Reunión en curso' : 'Reunión'}
        subtitulo={borrador ? 'Guardado en el teléfono' : `${verdadero(r.anulado) ? 'Anulada' : 'Sellada'} · ${fechaLarga(String(r.fecha))}`}
        accion={borrador && <button class="primario" onClick={() => setTerminando(true)}>Terminar</button>} />
      <div class="pila">
        <Aviso mensaje={error} />
        {terminando && (
          <div class="tarjeta">
            <p><strong>Antes de sellar</strong></p>
            <p>{vivos(h.asistentes).length} {vivos(h.asistentes).length === 1 ? 'presente' : 'presentes'} · {h.peticiones.length} peticiones · {h.acuerdos.length} acuerdos · {h.anexos.length} fotos</p>
            <p class="nota">Al sellar, la reunión ya no se puede modificar. Si algo queda mal, se anula con una nota aclaratoria.</p>
            <div class="acciones">
              <button class="secundario" onClick={() => setTerminando(false)}>Seguir capturando</button>
              <button class="primario" onClick={sellar}>Sellar reunión</button>
            </div>
          </div>
        )}

        <Seccion titulo="Datos">
          {borrador ? <>
            <CampoDiferido etiqueta="Fecha" tipo="date" valor={String(r.fecha ?? '')} alGuardar={guardarDato('fecha')} />
            <CampoDiferido etiqueta="Hora" tipo="time" valor={String(r.hora ?? '')} alGuardar={guardarDato('hora')} />
            <Selector etiqueta="Modalidad" valor={String(r.modalidad ?? '')}
              opciones={[['', 'Sin especificar'], ...MODALIDADES.map(x => [x, x] as [string, string])]} alCambiar={guardarDato('modalidad')} />
            <CampoDiferido etiqueta="Sede" valor={String(r.sede ?? '')} alGuardar={guardarDato('sede')} />
            <CampoDiferido etiqueta="Tema" valor={String(r.tema ?? '')} alGuardar={guardarDato('tema')} />
            <CampoDiferido etiqueta="Orden del día (opcional)" multilinea valor={String(r.orden_del_dia ?? '')} alGuardar={guardarDato('orden_del_dia')} />
          </> : <>
            <p>{fechaLarga(String(r.fecha))}{r.hora ? ` · ${r.hora}` : ''}{r.modalidad ? ` · ${r.modalidad}` : ''}</p>
            {r.sede && <p>{String(r.sede)}</p>}
            {r.tema && <p><strong>{String(r.tema)}</strong></p>}
          </>}
        </Seccion>

        <Seccion titulo={`Presentes · ${vivos(h.asistentes).length}`}
          accion={borrador && !agregando && <button class="secundario" onClick={() => setAgregando(true)}>+ Agregar presente</button>}>
          {agregando && <AgregarPresente reunionId={id} alTerminar={() => setAgregando(false)} />}
          {PAPELES.map(papel => {
            const del = h.asistentes.filter(a => a.papel === papel);
            if (!del.length) return null;
            return (
              <div key={papel}>
                <p class="sub">{papel === 'Atendida' ? 'Personas atendidas (con carnet)' : papel === 'Acompañante' ? 'Acompañantes y colectivo' : 'Gobierno'}</p>
                <div class="chips">
                  {del.map(a => (
                    <span key={String(a.id)} class={`chip ${papel === 'Atendida' ? 'atendida' : papel === 'Gobierno' ? 'gobierno' : ''}`}>
                      <span>{etiquetaPresente(a)}</span>
                      {verdadero(a.anulado) && <span class="anulado">ANULADO</span>}
                      {borrador && papel === 'Acompañante' && <button onClick={() => darCarnet(a)}>Dar carnet</button>}
                      {borrador && <button aria-label={`Quitar a ${a.nombre}`} onClick={() => hacer(m.quitar('asistente', String(a.id)))}>×</button>}
                      {!borrador && !verdadero(a.anulado) && !verdadero(r.anulado) && <Anular entidad="asistente" id={String(a.id)} etiqueta={`Anular a ${a.nombre}`} />}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </Seccion>

        <Seccion titulo={`Peticiones · ${h.peticiones.length}`}>
          {h.peticiones.map((p, i) => (
            <div key={String(p.id)}>
              <p>{`${p.numero ? Number(p.numero) : i + 1}. ${p.texto}`}{verdadero(p.anulado) && <span class="anulado"> ANULADA</span>}</p>
              {borrador && <button class="enlace" aria-label={`Quitar petición ${i + 1}`} onClick={() => hacer(m.quitar('peticion', String(p.id)))}>Quitar</button>}
              {!borrador && !verdadero(p.anulado) && <Anular entidad="peticion" id={String(p.id)} etiqueta="Anular petición" />}
            </div>
          ))}
          {borrador && <>
            <Campo etiqueta="Nueva petición" valor={peticion} alCambiar={setPeticion} multilinea />
            <button class="secundario" onClick={agregarPeticion}>Agregar petición</button>
          </>}
        </Seccion>

        <Seccion titulo={`Acuerdos · ${h.acuerdos.length}`}
          accion={borrador && <button class="primario" onClick={() => nav.ir({ p: 'nuevo-acuerdo', reunionId: id })}>+ Acuerdo</button>}>
          {h.acuerdos.map((a, i) => (
            <button key={String(a.id)} class="renglon" onClick={() => nav.ir({ p: 'acuerdo', id: String(a.id) })}>
              <strong>{`${a.numero || String(i + 1).padStart(2, '0')} · ${a.texto}`}</strong>
              <small>{separar(a.instituciones).map(k => nombreInstitucion(m.almacen, k)).join(', ')}{verdadero(a.anulado) ? ' · ANULADO' : ''}</small>
            </button>
          ))}
        </Seccion>

        <Fotos reunionId={id} borrador={borrador} />

        <Seccion titulo="Narrativo"
          accion={borrador && <button class="secundario" onClick={() => hacer(m.actualizar('reunion', id, { narrativo: borradorNarrativo(m.almacen, id) }))}>Proponer borrador</button>}>
          {borrador
            ? <CampoDiferido etiqueta="Narrativo" multilinea valor={String(r.narrativo ?? '')} alGuardar={guardarDato('narrativo')} />
            : <p>{String(r.narrativo || 'Sin narrativo.')}</p>}
        </Seccion>

        {!borrador && !verdadero(r.anulado) && <Anular entidad="reunion" id={id} etiqueta="Anular reunión" />}
      </div>
    </div>
  );
}

function AgregarPresente({ reunionId, alTerminar }: { reunionId: string; alTerminar(): void }) {
  const m = useMotor();
  const [q, setQ] = useState('');
  const [elegida, setElegida] = useState<Fila | null>(null);
  const [papel, setPapel] = useState('Acompañante');
  const [detalle, setDetalle] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const ya = new Set(hijos(m.almacen, reunionId).asistentes.map(a => String(a.persona_id)));
  const resultados = buscarPersonas(m.almacen, q).filter(p => !ya.has(String(p.id)));
  const elegir = (p: Fila) => {
    setElegida(p);
    setPapel(String(p.tipo));
    setDetalle(p.tipo === 'Gobierno' ? String(p.cargo ?? '') : '');
  };
  const agregar = () => {
    const datos: Fila = { reunion_id: reunionId, persona_id: String(elegida!.id), papel };
    if (detalle.trim()) datos.parentesco_o_cargo = detalle.trim();
    const r = m.ejecutar(m.crear('asistente', datos));
    if (!r.ok) { setError(r.motivo ?? 'No se pudo agregar'); return; }
    alTerminar();
  };
  if (creando) {
    return <FormPersona nombreInicial={q.trim()} alTerminar={id => {
      setCreando(false);
      const p = id ? porId(m.almacen, 'personas', id) : undefined;
      if (p) elegir(p);
    }} />;
  }
  if (elegida) {
    return (
      <div class="tarjeta formulario">
        <p><strong>{String(elegida.nombre)}</strong></p>
        <Selector etiqueta="Papel en la reunión" valor={papel} opciones={PAPELES.map(x => [x, x] as [string, string])} alCambiar={setPapel} />
        <Campo etiqueta={papel === 'Gobierno' ? 'Cargo' : 'Parentesco o relación (opcional)'} valor={detalle} alCambiar={setDetalle} />
        <Aviso mensaje={error} />
        <div class="acciones">
          <button class="secundario" onClick={() => setElegida(null)}>Atrás</button>
          <button class="primario" onClick={agregar}>Agregar</button>
        </div>
      </div>
    );
  }
  return (
    <div class="tarjeta formulario">
      <Campo etiqueta="Buscar persona" valor={q} alCambiar={setQ} />
      <ul class="lista">
        {resultados.map(p => (
          <li key={String(p.id)}>
            <button class="renglon" onClick={() => elegir(p)}>
              <strong>{String(p.nombre)}</strong>
              <small>{String(p.tipo)}{p.folio ? ` · ${textoFolio(p)}` : ''}{p.colectivo ? ` · ${p.colectivo}` : ''}</small>
            </button>
          </li>
        ))}
      </ul>
      {q.trim() && <button class="secundario" onClick={() => setCreando(true)}>{`Registrar a “${q.trim()}”`}</button>}
      <button class="enlace" onClick={alTerminar}>Cerrar</button>
    </div>
  );
}
