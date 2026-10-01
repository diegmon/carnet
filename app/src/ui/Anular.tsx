import { useState } from 'preact/hooks';
import { useMotor } from './contexto';
import { Aviso, Campo } from './comunes';
import { ENTIDADES_ANULABLES, MIN_NOTA_ACLARATORIA } from '../../../src/dominio/tipos';

type Anulable = (typeof ENTIDADES_ANULABLES)[number];

export function Anular({ entidad, id, etiqueta = 'Anular', alAnular }:
  { entidad: Anulable; id: string; etiqueta?: string; alAnular?: () => void }) {
  const m = useMotor();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  if (!abierto) return <button class="enlace peligro" onClick={() => setAbierto(true)}>{etiqueta}</button>;
  const confirmar = () => {
    if (nota.trim().length < MIN_NOTA_ACLARATORIA) {
      setError(`Explica el motivo (mínimo ${MIN_NOTA_ACLARATORIA} caracteres)`);
      return;
    }
    const r = m.ejecutar(m.crear('anulacion', { entidad, registro_id: id, nota_aclaratoria: nota.trim() }));
    if (!r.ok) { setError(r.motivo ?? 'No se pudo anular'); return; }
    setAbierto(false);
    alAnular?.();
  };
  return (
    <div class="tarjeta formulario">
      <p class="nota">Lo anulado queda visible y registrado; no se borra.</p>
      <Campo etiqueta="Nota aclaratoria" valor={nota} alCambiar={setNota} multilinea />
      <Aviso mensaje={error} />
      <div class="acciones">
        <button class="secundario" onClick={() => setAbierto(false)}>Cancelar</button>
        <button class="peligro" onClick={confirmar}>Confirmar anulación</button>
      </div>
    </div>
  );
}
