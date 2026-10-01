import { useMotor, useNav } from './contexto';
import { Encabezado } from './comunes';
import { fechaLarga } from '../estado/fechas';
import { verdadero } from '../../../src/dominio/tipos';

export function Documentos() {
  const m = useMotor();
  const nav = useNav();
  const selladas = m.almacen.filas('reuniones').filter(r => r.estado === 'Sellada')
    .sort((x, y) => String(y.sellada_en).localeCompare(String(x.sellada_en)));
  return (
    <div class="pantalla">
      <Encabezado titulo="Documentos" atras={false} />
      <div class="pila">
        <p class="nota">Pronto podrás generar aquí la Tarjeta Informativa y la Minuta de Acuerdos en Word.</p>
        {selladas.map(r => (
          <button key={String(r.id)} class="renglon" onClick={() => nav.ir({ p: 'reunion', id: String(r.id) })}>
            <strong>{String(r.tema || 'Reunión')}</strong>
            <small>{fechaLarga(String(r.fecha))}{verdadero(r.anulado) ? ' · ANULADA' : ''}</small>
          </button>
        ))}
        {!selladas.length && <p class="vacio">Aún no hay reuniones terminadas.</p>}
      </div>
    </div>
  );
}
