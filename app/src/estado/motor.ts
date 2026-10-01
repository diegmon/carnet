import { AlmacenMemoria } from '../../../src/receptor/almacen';
import { aplicarOperaciones } from '../../../src/receptor/aplicar';
import { sembrar } from '../../../src/receptor/semillas';
import { formatearFolioProvisional, Fila } from '../../../src/dominio/tipos';
import type {
  EntidadActualizable, EntidadCreable, EntidadQuitable, OpCrear, Operacion, ResultadoOp,
} from '../../../src/dominio/operaciones';
import { exportar, Instantanea, Persistencia, Problema, Sesion } from './persistencia';
import { fusionar, reconstruir } from './base';
import { leerToken } from './sesion-google';
import type { Cambios } from '../../../src/receptor/cambios';
import { hoyLocal, isoLocal } from './fechas';

export interface Ejecucion { ok: boolean; motivo?: string; resultados: ResultadoOp[] }

export type FaseSync = 'inactivo' | 'enviando' | 'al_dia' | 'sin_red' | 'requiere_sesion' | 'no_autorizado' | 'error';
export interface EstadoSync { fase: FaseSync; ultimaVez?: string; mensaje?: string }

/** UUID v4. Usa crypto.randomUUID si existe; si no (http en red local), crypto.getRandomValues. */
export function nuevoId(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * El motor del teléfono: aplica cada operación con las mismas reglas del receptor sobre la copia
 * local, la encola para sincronizar (Plan 3) y guarda todo en el teléfono después de cada cambio.
 */
export class Motor {
  private oyentes = new Set<() => void>();
  private guardado: Promise<void> = Promise.resolve();
  /** Mensaje para la persona si la última escritura en el teléfono falló ('' si todo bien). */
  errorGuardado = '';
  /** true si otra pestaña o ventana tiene la escritura: aquí solo se consulta. */
  soloLectura = false;
  /** Lo que el receptor ya confirmó (por cursor). La vista local es base + cola reaplicada. */
  base: Instantanea = {};
  cursor = 0;
  /** Operaciones que el receptor rechazó: quedan a la vista hasta que la persona las descarta. */
  problemas: Problema[] = [];
  estadoSync: EstadoSync = { fase: 'inactivo' };
  /** La app conecta aquí el envío inmediato (botón "Enviar ahora" y cambios recientes). */
  alPedirSincronizacion?: () => void;

  constructor(
    public almacen: AlmacenMemoria,
    public cola: Operacion[],
    public sesion: Sesion | undefined,
    readonly persistencia: Persistencia,
    readonly reloj: () => Date = () => new Date(),
  ) {}

  static async abrir(persistencia: Persistencia, reloj?: () => Date): Promise<Motor> {
    const d = await persistencia.cargar();
    const m = new Motor(new AlmacenMemoria(d.tablas), d.cola, d.sesion, persistencia, reloj);
    m.base = d.base;
    m.cursor = d.cursor;
    m.problemas = d.problemas;
    return m;
  }

  suscribir(fn: () => void): () => void {
    this.oyentes.add(fn);
    return () => { this.oyentes.delete(fn); };
  }

  notificar(): void {
    for (const fn of this.oyentes) fn();
  }

  hoy(): string { return hoyLocal(this.reloj()); }
  ts(): string { return isoLocal(this.reloj()); }

  async configurarSesion(s: Sesion): Promise<void> {
    if (this.soloLectura) throw new Error('Carnet de Atención está abierto en otra pestaña o ventana');
    const sesion = { ...s, correo: s.correo.trim().toLowerCase() };
    this.sesion = sesion;
    if (!this.almacen.filas('usuarios').some(u => u.correo === sesion.correo)) {
      this.almacen.agregar('usuarios', { correo: sesion.correo, nombre: sesion.nombre, cargo: sesion.cargo, activo: true });
    }
    sembrar(this.almacen, () => this.reloj().toISOString(), '');
    await this.persistencia.guardarSesion(sesion);
    this.persistir();
    this.notificar();
    await this.guardado;
  }

  /** Inicio de sesión con Google: la primera vez configura; después solo renueva el token. */
  async iniciarSesionGoogle(jwt: string): Promise<void> {
    const t = leerToken(jwt);
    if (this.sesion && this.sesion.correo !== t.correo && this.cola.length > 0) {
      throw new Error('Este teléfono tiene cambios sin enviar de otra cuenta');
    }
    if (!this.sesion || this.sesion.correo !== t.correo) {
      await this.configurarSesion({ correo: t.correo, nombre: t.nombre, cargo: '' });
    }
    this.sesion = { ...this.sesion!, token: jwt, expira: t.expira };
    await this.persistencia.guardarSesion(this.sesion);
    this.notificar();
  }

  ejecutar(...ops: Operacion[]): Ejecucion {
    if (!this.sesion) throw new Error('Sin sesión: primero configura quién eres');
    if (this.soloLectura) {
      return { ok: false, motivo: 'Carnet de Atención está abierto en otra pestaña o ventana. Ciérrala para capturar aquí.', resultados: [] };
    }
    const resultados: ResultadoOp[] = [];
    for (const op of ops) {
      const { resultados: [r] } = aplicarOperaciones(
        this.almacen, this.sesion.correo, [op], () => this.reloj().toISOString(),
        { formatoFolio: formatearFolioProvisional },
      );
      resultados.push(r);
      if (r.estado === 'rechazada') break;
      this.cola.push(op);
    }
    this.persistir();
    this.notificar();
    const fallida = resultados.find(r => r.estado === 'rechazada');
    return { ok: !fallida, motivo: fallida?.motivo, resultados };
  }

  private persistir(): void {
    const tablas = exportar(this.almacen);
    const cola = [...this.cola];
    const sincronia = { base: this.base, cursor: this.cursor, problemas: [...this.problemas] };
    // Cada escritura lleva la foto completa: si una falla, la siguiente repara todo. La cadena nunca queda rechazada.
    this.guardado = this.guardado
      .then(() => this.persistencia.guardar(tablas, cola, sincronia))
      .then(
        () => { if (this.errorGuardado) { this.errorGuardado = ''; this.notificar(); } },
        () => {
          this.errorGuardado = 'No se pudo guardar en este teléfono. Lo capturado sigue en pantalla; se reintentará con el siguiente cambio.';
          this.notificar();
        },
      );
  }

  esperarGuardado(): Promise<void> { return this.guardado; }

  fijarEstadoSync(e: EstadoSync): void {
    this.estadoSync = e;
    this.notificar();
  }

  /** Aplica la respuesta del receptor a un lote enviado. Lo capturado mientras tanto sigue en la cola. */
  aplicarRespuesta(enviadas: Operacion[], r: { resultados: { op_id: string; estado: string; motivo?: string }[]; cambios: Cambios }): void {
    const respondidas = new Map(r.resultados.map(x => [x.op_id, x]));
    for (const op of enviadas) {
      const res = respondidas.get(op.op_id);
      if (res?.estado === 'rechazada') this.problemas.push({ op, motivo: res.motivo ?? 'Rechazada por el receptor', fecha: this.ts() });
    }
    this.cola = this.cola.filter(op => !respondidas.has(op.op_id));
    this.base = fusionar(this.base, r.cambios);
    this.cursor = r.cambios.rev;
    this.reconstruirVista();
  }

  marcarFotoSubida(anexoId: string, url: string): void {
    this.base = { ...this.base, anexos: (this.base.anexos ?? []).map(a => (a.id === anexoId ? { ...a, drive_url: url } : a)) };
    this.reconstruirVista();
  }

  descartarProblema(opId: string): void {
    this.problemas = this.problemas.filter(p => p.op.op_id !== opId);
    this.persistir();
    this.notificar();
  }

  private reconstruirVista(): void {
    if (!this.sesion) return;
    this.almacen = reconstruir(this.base, this.cola, this.sesion, () => this.reloj().toISOString()).almacen;
    this.persistir();
    this.notificar();
  }

  crear(entidad: EntidadCreable, datos: Fila, id = nuevoId()): OpCrear {
    return { op_id: nuevoId(), tipo: 'crear', entidad, id, datos, ts: this.ts() };
  }
  actualizar(entidad: EntidadActualizable, id: string, cambios: Fila): Operacion {
    return { op_id: nuevoId(), tipo: 'actualizar', entidad, id, cambios, ts: this.ts() };
  }
  quitar(entidad: EntidadQuitable, id: string): Operacion {
    return { op_id: nuevoId(), tipo: 'quitar', entidad, id, ts: this.ts() };
  }
  sellar(id: string): Operacion {
    return { op_id: nuevoId(), tipo: 'sellar', entidad: 'reunion', id, ts: this.ts() };
  }

  async agregarFoto(reunionId: string, archivo: Blob, descripcion: string): Promise<Ejecucion> {
    const id = nuevoId();
    try {
      await this.persistencia.guardarFoto(id, archivo);
    } catch {
      return { ok: false, motivo: 'No se pudo guardar la foto en el teléfono (¿espacio lleno?).', resultados: [] };
    }
    return this.ejecutar(this.crear('anexo', { reunion_id: reunionId, descripcion }, id));
  }
}
