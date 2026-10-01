import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Perfil de la institución: PERFIL=ruta, o privado/perfil.json si existe, o el ejemplo genérico del repositorio. */
export function rutaPerfil() {
  const ruta = process.env.PERFIL ?? (existsSync('privado/perfil.json') ? 'privado/perfil.json' : 'perfil.ejemplo.json');
  return resolve(ruta);
}

export function leerPerfil() {
  return JSON.parse(readFileSync(rutaPerfil(), 'utf8'));
}
