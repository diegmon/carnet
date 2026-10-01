import { useMotor } from './contexto';
import { Encabezado } from './comunes';
import { anulacionesDelMes, nombreUsuario } from '../estado/consultas';
import { fechaLarga } from '../estado/fechas';

const NOMBRE: Record<string, string> = { persona: 'Persona', reunion: 'Reunión', asistente: 'Asistente', peticion: 'Petición', acuerdo: 'Acuerdo' };

export function Anulaciones() {
  const m = useMotor();
  const lista = anulacionesDelMes(m.almacen, m.hoy());
  return (
    <div class="pantalla">
      <Encabezado titulo="Anulaciones" subtitulo="Este mes" />
      <div class="pila">
        {lista.map(n => (
          <div key={String(n.id)} class="tarjeta">
            <p class="sub">{NOMBRE[String(n.entidad)] ?? String(n.entidad)} · {fechaLarga(String(n.creado_en))} · {nombreUsuario(m.almacen, String(n.creado_por))}</p>
            <p>{String(n.nota_aclaratoria)}</p>
          </div>
        ))}
        {!lista.length && <p class="vacio">No hay anulaciones este mes.</p>}
      </div>
    </div>
  );
}
