export type Valor = string | number | boolean;
export type Fila = Record<string, Valor>;

export const TIPOS_PERSONA = ['Atendida', 'Acompañante', 'Gobierno'] as const;
export type TipoPersona = (typeof TIPOS_PERSONA)[number];
export const PAPELES = TIPOS_PERSONA;
export const MODALIDADES = ['Presencial', 'Virtual', 'Presencial y virtual'] as const;
export const ESTADOS_ACUERDO = ['Por iniciar', 'En gestión', 'Bloqueado', 'Cumplido'] as const;
export type EstadoAcuerdo = (typeof ESTADOS_ACUERDO)[number];
export const ESTADOS_CON_NOTA: readonly EstadoAcuerdo[] = ['Bloqueado', 'Cumplido'];
export const ENTIDADES_ANULABLES = ['persona', 'reunion', 'asistente', 'peticion', 'acuerdo'] as const;
export const MIN_NOTA_ACLARATORIA = 10;

/** Prefijo por omisión si CONFIG no define prefijo_folio. */
export const PREFIJO_FOLIO_OMISION = 'CA-';

export function formatearFolio(n: number, prefijo: string = PREFIJO_FOLIO_OMISION): string {
  return prefijo + String(n).padStart(3, '0');
}

/** Folio que asigna el teléfono sin señal; el receptor lo reemplaza por el definitivo al sincronizar. */
export function formatearFolioProvisional(n: number): string {
  return 'PROV-' + String(n).padStart(3, '0');
}

export function esFolioProvisional(f: string): boolean {
  return /^PROV-\d+$/.test(f);
}

export function verdadero(v: Valor | undefined): boolean {
  return v === true || v === 'TRUE' || v === 'true';
}
