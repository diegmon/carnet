import { useState } from 'preact/hooks';
import { useMotor, useNav } from './contexto';
import { Aviso, Campo, Encabezado, Selector, TarjetaAcuerdo } from './comunes';
import { Anular } from './Anular';
import {
  buscarPersonas, carnets, fichaCarnet, institucionesOrdenadas, nombreInstitucion, parecidas, textoFolio,
} from '../estado/consultas';
import { fechaLarga, horaLocal } from '../estado/fechas';
import { PERFIL } from '../../../src/dominio/perfil';
import { ESTADOS_ACUERDO, TIPOS_PERSONA, TipoPersona, verdadero, Fila } from '../../../src/dominio/tipos';
import { normalizar } from '../../../src/dominio/texto';
import type { Operacion } from '../../../src/dominio/operaciones';

const OPCIONES_ZONA: [string, string][] = [['', 'Sin especificar'], ...PERFIL.zonas.map(z => [z.clave, z.nombre] as [string, string])];

function nombreAlcaldia(v: unknown): string {
  return PERFIL.zonas.find(z => z.clave === v)?.nombre ?? String(v ?? '');
}

export function Carnets() {
  const m = useMotor();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const lista = q ? buscarPersonas(m.almacen, q).filter(p => p.tipo === 'Atendida') : carnets(m.almacen);
  return (
    <div class="pantalla">
      <Encabezado titulo="Carnets" atras={false}
        accion={<button class="secundario" onClick={() => setNuevo(true)}>Nuevo carnet</button>} />
      <div class="pila">
        {nuevo && <FormPersona tipoFijo="Atendida" alTerminar={id => { setNuevo(false); if (id) nav.ir({ p: 'carnet', id }); }} />}
        <Campo etiqueta="Buscar carnet" valor={q} alCambiar={setQ} />
        <ul class="lista">
          {lista.map(p => (
            <li key={String(p.id)}>
              <button class="renglon" onClick={() => nav.ir({ p: 'carnet', id: String(p.id) })}>
                <strong>{String(p.nombre)}</strong>
                <small>{textoFolio(p)}{p.colectivo ? ` · ${p.colectivo}` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
        {!lista.length && <p class="vacio">{q ? 'Sin resultados.' : 'Aún no hay carnets.'}</p>}
      </div>
    </div>
  );
}

export function FormPersona({ tipoFijo, nombreInicial = '', alTerminar }:
  { tipoFijo?: TipoPersona; nombreInicial?: string; alTerminar(id?: string): void }) {
  const m = useMotor();
  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState<TipoPersona>(tipoFijo ?? 'Acompañante');
  const [colectivo, setColectivo] = useState('');
  const [contacto, setContacto] = useState('');
  const [alcaldia, setAlcaldia] = useState('');
  const [cargo, setCargo] = useState('');
  const [institucion, setInstitucion] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');
  const similares = nombre.trim() ? parecidas(m.almacen, nombre) : [];
  const colectivos = m.almacen.filas('colectivos').map(c => String(c.nombre));

  const guardar = () => {
    if (!nombre.trim()) { setError('Falta el nombre'); return; }
    if (similares.length && !confirmar) { setConfirmar(true); return; }
    const ops: Operacion[] = [];
    const col = colectivo.trim();
    if (col && !colectivos.some(c => normalizar(c) === normalizar(col))) ops.push(m.crear('colectivo', { nombre: col }));
    const datos: Fila = { nombre: nombre.trim(), tipo };
    if (tipo !== 'Gobierno') {
      if (col) datos.colectivo = col;
      if (contacto.trim()) datos.contacto = contacto.trim();
      if (alcaldia) datos.alcaldia_zona = alcaldia;
    } else {
      if (cargo.trim()) datos.cargo = cargo.trim();
      if (institucion) datos.institucion = institucion;
    }
    const op = m.crear('persona', datos);
    ops.push(op);
    const r = m.ejecutar(...ops);
    if (!r.ok) { setError(r.motivo ?? 'No se pudo guardar'); return; }
    alTerminar(op.id);
  };

  return (
    <div class="tarjeta formulario">
      <Campo etiqueta="Nombre completo" valor={nombre} alCambiar={v => { setNombre(v); setConfirmar(false); }} />
      {!tipoFijo && <Selector etiqueta="Tipo" valor={tipo} opciones={TIPOS_PERSONA.map(t => [t, t] as [string, string])} alCambiar={v => setTipo(v as TipoPersona)} />}
      {tipo !== 'Gobierno' && <>
        <Campo etiqueta="Colectivo (opcional)" valor={colectivo} alCambiar={setColectivo} sugerencias={colectivos} />
        <Campo etiqueta="Contacto (opcional)" valor={contacto} alCambiar={setContacto} tipo="tel" />
        <Selector etiqueta={PERFIL.etiquetaZona} valor={alcaldia} opciones={OPCIONES_ZONA} alCambiar={setAlcaldia} />
      </>}
      {tipo === 'Gobierno' && <>
        <Campo etiqueta="Cargo" valor={cargo} alCambiar={setCargo} />
        <Selector etiqueta="Institución" valor={institucion}
          opciones={[['', 'Elegir…'], ...institucionesOrdenadas(m.almacen).map(i => [String(i.id), nombreInstitucion(m.almacen, String(i.id))] as [string, string])]}
          alCambiar={setInstitucion} />
      </>}
      {confirmar && <p class="nota">Hay nombres parecidos: {similares.map(p => String(p.nombre)).join(', ')}. Si es otra persona, toca Guardar de nuevo.</p>}
      <Aviso mensaje={error} />
      <div class="acciones">
        <button class="secundario" onClick={() => alTerminar()}>Cancelar</button>
        <button class="primario" onClick={guardar}>Guardar</button>
      </div>
    </div>
  );
}

export function EditarPersona({ persona, alTerminar }: { persona: Fila; alTerminar(): void }) {
  const m = useMotor();
  const [nombre, setNombre] = useState(String(persona.nombre ?? ''));
  const [contacto, setContacto] = useState(String(persona.contacto ?? ''));
  const [colectivo, setColectivo] = useState(String(persona.colectivo ?? ''));
  const [alcaldia, setAlcaldia] = useState(String(persona.alcaldia_zona ?? ''));
  const [cargo, setCargo] = useState(String(persona.cargo ?? ''));
  const [error, setError] = useState('');
  const guardar = () => {
    const nuevos: Fila = { nombre: nombre.trim(), contacto: contacto.trim(), colectivo: colectivo.trim(), alcaldia_zona: alcaldia };
    if (persona.tipo === 'Gobierno') nuevos.cargo = cargo.trim();
    const cambios: Fila = {};
    for (const [k, v] of Object.entries(nuevos)) if (String(persona[k] ?? '') !== v) cambios[k] = v;
    if (!Object.keys(cambios).length) { alTerminar(); return; }
    const r = m.ejecutar(m.actualizar('persona', String(persona.id), cambios));
    if (!r.ok) { setError(r.motivo ?? 'No se pudo guardar'); return; }
    alTerminar();
  };
  return (
    <div class="tarjeta formulario">
      <Campo etiqueta="Nombre completo" valor={nombre} alCambiar={setNombre} />
      <Campo etiqueta="Contacto (opcional)" valor={contacto} alCambiar={setContacto} tipo="tel" />
      <Campo etiqueta="Colectivo (opcional)" valor={colectivo} alCambiar={setColectivo} />
      <Selector etiqueta={PERFIL.etiquetaZona} valor={alcaldia} opciones={OPCIONES_ZONA} alCambiar={setAlcaldia} />
      {persona.tipo === 'Gobierno' && <Campo etiqueta="Cargo" valor={cargo} alCambiar={setCargo} />}
      <Aviso mensaje={error} />
      <div class="acciones">
        <button class="secundario" onClick={alTerminar}>Cancelar</button>
        <button class="primario" onClick={guardar}>Guardar cambios</button>
      </div>
      <Anular entidad="persona" id={String(persona.id)} etiqueta="Anular este registro" alAnular={alTerminar} />
    </div>
  );
}

export function Carnet({ id }: { id: string }) {
  const m = useMotor();
  const nav = useNav();
  const [pestana, setPestana] = useState<'acuerdos' | 'reuniones'>('acuerdos');
  const [editar, setEditar] = useState(false);
  const [error, setError] = useState('');
  const f = fichaCarnet(m.almacen, id);
  if (!f) return <p class="vacio">No se encontró la persona.</p>;
  const p = f.persona;
  const anulada = verdadero(p.anulado);
  const nuevaReunion = () => {
    const r = m.crear('reunion', { fecha: m.hoy(), hora: horaLocal(m.reloj()) });
    const a = m.crear('asistente', { reunion_id: r.id, persona_id: id, papel: 'Atendida' });
    const res = m.ejecutar(r, a);
    if (res.ok) nav.ir({ p: 'reunion', id: r.id });
    else setError(res.motivo ?? 'No se pudo crear la reunión');
  };
  const darCarnet = () => {
    const r = m.ejecutar(m.actualizar('persona', id, { tipo: 'Atendida' }));
    if (!r.ok) setError(r.motivo ?? 'No se pudo dar carnet');
  };
  const datos = [p.colectivo, nombreAlcaldia(p.alcaldia_zona), p.contacto].filter(Boolean).join(' · ');
  return (
    <div class="pantalla">
      <header class="portada">
        <button class="icono claro" aria-label="Volver" onClick={() => nav.atras()}>‹</button>
        <p class="marca">{textoFolio(p)}</p>
        <h1>{String(p.nombre)}</h1>
        {datos && <p class="sub claro">{datos}</p>}
        {anulada && <p class="anulado">ANULADO</p>}
      </header>
      <div class="pila">
        {p.tipo !== 'Atendida' && !anulada && <button class="secundario" onClick={darCarnet}>Dar carnet</button>}
        <div class="conteo">
          {ESTADOS_ACUERDO.map(e => <div class="caja" key={e}><strong>{f.conteo[e]}</strong><span>{e}</span></div>)}
        </div>
        <div class="pestanas-internas" role="tablist">
          <button role="tab" aria-selected={pestana === 'acuerdos'} onClick={() => setPestana('acuerdos')}>Acuerdos ({f.acuerdos.length})</button>
          <button role="tab" aria-selected={pestana === 'reuniones'} onClick={() => setPestana('reuniones')}>Reuniones ({f.reuniones.length})</button>
        </div>
        {pestana === 'acuerdos'
          ? (f.acuerdos.length ? f.acuerdos.map(a => <TarjetaAcuerdo key={String(a.id)} acuerdo={a} hoy={m.hoy()} />) : <p class="vacio">Sin acuerdos todavía.</p>)
          : (f.reuniones.length ? f.reuniones.map(r => (
            <button key={String(r.id)} class="renglon" onClick={() => nav.ir({ p: 'reunion', id: String(r.id) })}>
              <strong>{String(r.tema || 'Reunión')}</strong><small>{fechaLarga(String(r.fecha))} · {String(r.estado)}</small>
            </button>)) : <p class="vacio">Sin reuniones.</p>)}
        {editar ? <EditarPersona persona={p} alTerminar={() => setEditar(false)} />
          : !anulada && <button class="secundario" onClick={() => setEditar(true)}>Editar datos</button>}
        <Aviso mensaje={error} />
      </div>
      {!anulada && p.tipo === 'Atendida' && (
        <div class="barra-inferior">
          <button class="primario grande" style="width:100%" onClick={nuevaReunion}>Nueva reunión con {String(p.nombre).split(' ')[0]}</button>
        </div>
      )}
    </div>
  );
}
