import { useState } from 'preact/hooks';
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

/** Lo que la persona escribió (sin identificadores internos), para poder recapturarlo. */
function contenido(op: Operacion): string {
  const campos = op.tipo === 'crear' ? op.datos : op.tipo === 'actualizar' ? op.cambios : {};
  return Object.entries(campos)
    .filter(([k, v]) => !/(^id$|_id$|_ids$)/.test(k) && String(v ?? '').trim() !== '')
    .map(([, v]) => String(v))
    .join(' · ');
}

export function Problemas() {
  const m = useMotor();
  const [confirmando, setConfirmando] = useState('');
  return (
    <div class="pantalla">
      <Encabezado titulo="Problemas de sincronización" subtitulo="Lo que el receptor no aceptó" />
      <div class="pila">
        <p class="nota">Estos cambios se quedaron en este teléfono y no llegaron a la base. Revisa el motivo; si hace falta, vuelve a capturarlo correctamente.</p>
        {m.problemas.map(p => (
          <div key={p.op.op_id} class="tarjeta">
            <p><strong>{describir(p.op)}</strong></p>
            <p class="sub">{fechaLarga(p.fecha)}</p>
            {contenido(p.op) && <p class="nota">{contenido(p.op)}</p>}
            <p>{p.motivo}</p>
            <div class="acciones">
              {confirmando === p.op.op_id ? <>
                <span>¿Descartar definitivamente? No se puede recuperar.</span>
                <button class="secundario" onClick={() => setConfirmando('')}>Cancelar</button>
                <button class="peligro" onClick={() => { m.descartarProblema(p.op.op_id); setConfirmando(''); }}>Sí, descartar</button>
              </> : <button class="secundario" onClick={() => setConfirmando(p.op.op_id)}>Descartar</button>}
            </div>
          </div>
        ))}
        {!m.problemas.length && <p class="vacio">No hay problemas de sincronización.</p>}
      </div>
    </div>
  );
}
