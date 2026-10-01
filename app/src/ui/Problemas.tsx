import { useMotor } from './contexto';
import { Encabezado } from './comunes';
import { fechaLarga } from '../estado/fechas';
import type { Operacion } from '../../../src/dominio/operaciones';

const ENTIDAD: Record<string, string> = {
  persona: 'una persona', reunion: 'una reunión', asistente: 'un asistente', peticion: 'una petición', acuerdo: 'un acuerdo',
  anexo: 'una foto', estado_acuerdo: 'un estado de acuerdo', anulacion: 'una anulación', colectivo: 'un colectivo', institucion: 'una institución',
};
const TIPO: Record<string, string> = { crear: 'Registro de', actualizar: 'Cambio en', quitar: 'Quitar', sellar: 'Sellar' };

function describir(op: Operacion): string {
  return `${TIPO[op.tipo] ?? op.tipo} ${ENTIDAD[op.entidad] ?? op.entidad}`;
}

export function Problemas() {
  const m = useMotor();
  return (
    <div class="pantalla">
      <Encabezado titulo="Problemas de sincronización" subtitulo="Lo que el receptor no aceptó" />
      <div class="pila">
        <p class="nota">Estos cambios se quedaron en este teléfono y no llegaron a la base. Revisa el motivo; si hace falta, vuelve a capturarlo correctamente.</p>
        {m.problemas.map(p => (
          <div key={p.op.op_id} class="tarjeta">
            <p><strong>{describir(p.op)}</strong></p>
            <p class="sub">{fechaLarga(p.fecha)}</p>
            <p>{p.motivo}</p>
            <div class="acciones"><button class="secundario" onClick={() => m.descartarProblema(p.op.op_id)}>Descartar</button></div>
          </div>
        ))}
        {!m.problemas.length && <p class="vacio">No hay problemas de sincronización.</p>}
      </div>
    </div>
  );
}
