import type { Motor, EstadoSync } from './motor';
import type { ClienteReceptor } from './cliente';
import { tokenVigente } from './sesion-google';
import { isoLocal } from './fechas';

export const LOTE = 50;

export class Sincronizador {
  private enCurso = false;

  constructor(
    private motor: Motor,
    private cliente: ClienteReceptor,
    private opciones: { lote?: number; alTerminar?: () => Promise<void> } = {},
  ) {}

  async sincronizar(): Promise<EstadoSync> {
    const m = this.motor;
    if (this.enCurso) return m.estadoSync;
    if (!m.sesion || m.soloLectura) return this.fijar({ fase: 'error', mensaje: 'Esta pestaña no puede enviar cambios' });
    const token = tokenVigente(m.sesion, m.reloj());
    if (!token) return this.fijar({ fase: 'requiere_sesion', mensaje: 'Vuelve a iniciar sesión para enviar' });
    this.enCurso = true;
    this.fijar({ ...m.estadoSync, fase: 'enviando' });
    try {
      const tam = this.opciones.lote ?? LOTE;
      for (let vuelta = 0; ; vuelta++) {
        const lote = m.cola.slice(0, tam);
        const r = await this.cliente.sincronizar(token, m.cursor, lote);
        if (!r.ok) {
          switch (r.error) {
            case 'sin_red': return this.fijar({ ...m.estadoSync, fase: 'sin_red', mensaje: r.mensaje });
            case 'sesion_vencida': return this.fijar({ ...m.estadoSync, fase: 'requiere_sesion', mensaje: r.mensaje });
            case 'no_autorizado': return this.fijar({ ...m.estadoSync, fase: 'no_autorizado', mensaje: r.mensaje });
            default: return this.fijar({ ...m.estadoSync, fase: 'error', mensaje: r.mensaje });
          }
        }
        const antes = m.cola.length;
        m.aplicarRespuesta(lote, r);
        if (m.cola.length === 0 || m.cola.length >= antes || vuelta > 1000) break;
      }
      this.fijar({ fase: 'al_dia', ultimaVez: isoLocal(m.reloj()) });
    } finally {
      this.enCurso = false;
    }
    await this.opciones.alTerminar?.();
    return m.estadoSync;
  }

  private fijar(e: EstadoSync): EstadoSync {
    this.motor.fijarEstadoSync(e);
    return e;
  }
}
