import datos from '@perfil';

export interface Zona { clave: string; nombre: string }
export interface InstitucionSemilla { id: string; nombre: string; siglas: string; tipo: string; area_de: string }

/** Lo propio de la institución que usa Carnet de Atención. El repositorio trae un ejemplo genérico (perfil.ejemplo.json). */
export interface Perfil {
  /** Texto de marca en la app, por ejemplo "MI INSTITUCIÓN". */
  institucion: string;
  /** Prefijo de los folios de carnet, por ejemplo "CA-" para CA-001. */
  prefijoFolio: string;
  /** Cargo del destinatario ("Para:") de los documentos. */
  paraCargo: string;
  /** Cómo se llama la zona territorial: "Zona", "Alcaldía", "Municipio"… */
  etiquetaZona: string;
  zonas: Zona[];
  /** Catálogo semilla de instituciones y áreas. */
  instituciones: InstitucionSemilla[];
  colores: { primario: string; primarioOscuro: string; acento: string };
}

export const PERFIL: Perfil = datos as Perfil;
