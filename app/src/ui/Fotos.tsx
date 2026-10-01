import { useEffect, useState } from 'preact/hooks';
import { useMotor } from './contexto';
import { Aviso, Campo, Seccion } from './comunes';
import { hijos } from '../estado/consultas';

export function Fotos({ reunionId, borrador }: { reunionId: string; borrador: boolean }) {
  const m = useMotor();
  const [pie, setPie] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const anexos = hijos(m.almacen, reunionId).anexos;
  const clave = anexos.map(a => a.id).join(',');

  useEffect(() => {
    let vigente = true;
    const creadas: string[] = [];
    (async () => {
      const u: Record<string, string> = {};
      for (const a of anexos) {
        const b = await m.persistencia.leerFoto(String(a.id));
        if (b && typeof URL.createObjectURL === 'function') {
          u[String(a.id)] = URL.createObjectURL(b);
          creadas.push(u[String(a.id)]);
        }
      }
      if (vigente) setUrls(u);
    })();
    return () => { vigente = false; creadas.forEach(x => URL.revokeObjectURL(x)); };
  }, [clave]);

  const subir = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    for (const archivo of Array.from(input.files ?? [])) {
      const r = await m.agregarFoto(reunionId, archivo, pie.trim());
      if (!r.ok) { setError(r.motivo ?? 'No se pudo guardar la foto'); break; }
    }
    setPie('');
    input.value = '';
  };

  return (
    <Seccion titulo={`Fotos · ${anexos.length}`}>
      <div class="miniaturas">
        {anexos.map((a, i) => (
          <figure key={String(a.id)}>
            {urls[String(a.id)]
              ? <img src={urls[String(a.id)]} alt={String(a.descripcion || 'Foto de la reunión')} />
              : <div class="sin-foto">Foto</div>}
            {a.descripcion && <figcaption>{String(a.descripcion)}</figcaption>}
            {borrador && <button aria-label={`Quitar foto ${i + 1}`} onClick={() => m.ejecutar(m.quitar('anexo', String(a.id)))}>×</button>}
          </figure>
        ))}
      </div>
      {borrador && <>
        <Campo etiqueta="Pie de foto (opcional)" valor={pie} alCambiar={setPie} />
        <label class="boton">Tomar o elegir foto
          <input type="file" accept="image/*" capture="environment" multiple hidden onChange={subir} />
        </label>
      </>}
      <Aviso mensaje={error} />
    </Seccion>
  );
}
