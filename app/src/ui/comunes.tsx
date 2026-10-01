import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useMotor, useNav } from './contexto';
import { historial, nombreInstitucion, personasDe, separar, textoFolio } from '../estado/consultas';
import { textoFechaAcordada } from '../estado/fechas';
import { verdadero, Fila } from '../../../src/dominio/tipos';

let contador = 0;
const nuevoIdCampo = () => `campo-${++contador}`;

export function Encabezado({ titulo, subtitulo, atras = true, accion }:
  { titulo: string; subtitulo?: string; atras?: boolean; accion?: ComponentChildren }) {
  const nav = useNav();
  return (
    <header class="encabezado">
      {atras && <button class="icono" aria-label="Volver" onClick={() => nav.atras()}>‹</button>}
      <div class="titulos">
        <h1>{titulo}</h1>
        {subtitulo && <p class="sub">{subtitulo}</p>}
      </div>
      {accion}
    </header>
  );
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <section class="tarjeta">
      <div class="fila-titulo"><h2>{titulo}</h2>{accion}</div>
      {children}
    </section>
  );
}

const CLASE_ESTADO: Record<string, string> = {
  'Por iniciar': 'por-iniciar', 'En gestión': 'gestion', Bloqueado: 'bloqueado', Cumplido: 'cumplido',
};
export function Insignia({ estado }: { estado: string }) {
  return <span class={`insignia ${CLASE_ESTADO[estado] ?? 'por-iniciar'}`}>{estado}</span>;
}

export function Aviso({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p class="aviso" role="alert">{mensaje}</p> : null;
}

export function Campo({ etiqueta, valor, alCambiar, tipo = 'text', multilinea = false, sugerencias }:
  { etiqueta: string; valor: string; alCambiar(v: string): void; tipo?: string; multilinea?: boolean; sugerencias?: string[] }) {
  const [lista] = useState(nuevoIdCampo);
  const leer = (e: Event) => alCambiar((e.target as HTMLInputElement).value);
  return (
    <label class="campo">
      <span>{etiqueta}</span>
      {multilinea
        ? <textarea rows={3} value={valor} onInput={leer} />
        : <input type={tipo} value={valor} onInput={leer} list={sugerencias ? lista : undefined} />}
      {sugerencias && <datalist id={lista}>{sugerencias.map(s => <option key={s} value={s} />)}</datalist>}
    </label>
  );
}

/** Guarda al salir del campo y solo si cambió (una operación por cambio real). */
export function CampoDiferido({ etiqueta, valor, alGuardar, tipo = 'text', multilinea = false }:
  { etiqueta: string; valor: string; alGuardar(v: string): boolean | void; tipo?: string; multilinea?: boolean }) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  const actual = useRef({ v, valor, alGuardar });
  actual.current = { v, valor, alGuardar };
  const leer = (e: Event) => setV((e.target as HTMLInputElement).value);
  // Solo guarda si cambió de verdad (el receptor recorta espacios). Si no cambió o se rechazó, vuelve al valor guardado.
  const salir = () => {
    const { v: escrito, valor: guardado, alGuardar: guardar } = actual.current;
    if (escrito.trim() === String(guardado).trim()) { setV(guardado); return; }
    if (guardar(escrito) === false) setV(guardado);
  };
  // Si la app se oculta o se cierra mientras se escribe, se guarda lo escrito.
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') salir(); };
    window.addEventListener('pagehide', salir);
    document.addEventListener('visibilitychange', alOcultar);
    return () => { window.removeEventListener('pagehide', salir); document.removeEventListener('visibilitychange', alOcultar); };
  }, []);
  return (
    <label class="campo">
      <span>{etiqueta}</span>
      {multilinea
        ? <textarea rows={4} value={v} onInput={leer} onBlur={salir} />
        : <input type={tipo} value={v} onInput={leer} onBlur={salir} />}
    </label>
  );
}

export function Selector({ etiqueta, valor, opciones, alCambiar }:
  { etiqueta: string; valor: string; opciones: [string, string][]; alCambiar(v: string): void }) {
  return (
    <label class="campo">
      <span>{etiqueta}</span>
      <select value={valor} onChange={e => alCambiar((e.target as HTMLSelectElement).value)}>
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

export function TarjetaAcuerdo({ acuerdo, hoy }: { acuerdo: Fila; hoy: string }) {
  const m = useMotor();
  const nav = useNav();
  const quien = personasDe(m.almacen, acuerdo.persona_ids).map(p => `${textoFolio(p)} · ${p.nombre}`).join(', ');
  const inst = separar(acuerdo.instituciones).map(k => nombreInstitucion(m.almacen, k)).join(', ');
  const ultimo = historial(m.almacen, String(acuerdo.id)).slice(-1)[0];
  const detalle = acuerdo.estado_vigente === 'Bloqueado' && ultimo?.nota
    ? `“${ultimo.nota}”`
    : textoFechaAcordada(String(acuerdo.fecha_acordada ?? ''), hoy);
  return (
    <button class="tarjeta-acuerdo" onClick={() => nav.ir({ p: 'acuerdo', id: String(acuerdo.id) })}>
      <span class="arriba"><span class="quien">{quien}</span><Insignia estado={String(acuerdo.estado_vigente)} /></span>
      <span class="texto">{String(acuerdo.texto)}</span>
      <span class="detalle">{inst} · {detalle}</span>
      {verdadero(acuerdo.anulado) && <span class="anulado">ANULADO</span>}
    </button>
  );
}

/** Texto en captura que sobrevive a salir de la pantalla o a recargar (solo en este teléfono). */
export function useBorrador(clave: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => {
    try { return localStorage.getItem(clave) ?? ''; } catch { return ''; }
  });
  const fijar = (x: string) => {
    setV(x);
    try {
      if (x) localStorage.setItem(clave, x);
      else localStorage.removeItem(clave);
    } catch { /* sin almacenamiento local: el borrador solo vive en pantalla */ }
  };
  return [v, fijar];
}
