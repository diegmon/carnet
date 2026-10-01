import { Almacen, filaVacia } from './almacen';
import { Contexto } from './contexto';
import { PERFIL } from '../dominio/perfil';

export const CONFIG_INICIAL: Record<string, string> = {
  ultimo_folio: '0',
  ultimo_rev: '0',
  para_nombre: '',
  para_cargo: PERFIL.paraCargo,
  prefijo_folio: PERFIL.prefijoFolio,
  client_id: '',
};

export function sembrar(almacen: Almacen, ahora: () => string, carpetaDriveId: string): { instituciones: number } {
  for (const [clave, valor] of Object.entries({ ...CONFIG_INICIAL, carpeta_drive_id: carpetaDriveId })) {
    if (almacen.config(clave) === '') almacen.setConfig(clave, valor);
  }
  const ctx = new Contexto(almacen, 'setup', ahora, 'setup');
  const existentes = new Set(almacen.filas('instituciones').map(f => String(f.id)));
  let nuevas = 0;
  for (const s of PERFIL.instituciones) {
    if (existentes.has(s.id)) continue;
    ctx.insertar('instituciones', { ...filaVacia('instituciones'), ...s, creado_por: 'setup', creado_en: ahora(), usos: 0 });
    nuevas++;
  }
  return { instituciones: nuevas };
}
