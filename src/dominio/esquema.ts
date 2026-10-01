export type NombreTabla =
  | 'personas' | 'reuniones' | 'asistentes' | 'peticiones' | 'acuerdos'
  | 'historial_estados' | 'anulaciones' | 'personas_versiones' | 'anexos'
  | 'instituciones' | 'colectivos' | 'usuarios' | 'changelog' | 'config' | 'ops';

export interface Columna { nombre: string; descripcion: string }
export interface Tabla { hoja: string; descripcion: string; sincroniza: boolean; columnas: Columna[] }

const c = (nombre: string, descripcion: string): Columna => ({ nombre, descripcion });

const BASE: Columna[] = [
  c('id', 'Identificador interno (UUID generado en el teléfono, o clave del catálogo).'),
  c('creado_por', 'Correo de quien lo capturó.'),
  c('creado_en', 'Fecha y hora de captura en el teléfono (ISO 8601).'),
  c('servidor_en', 'Fecha y hora en que el receptor lo guardó (ISO 8601).'),
  c('_rev', 'Número de revisión del receptor; sirve para sincronizar.'),
];
const ANULADO = c('anulado', 'TRUE si fue anulado (ver ANULACIONES).');
const QUITADO = c('quitado', 'TRUE si se quitó mientras la reunión era borrador.');

export const TABLAS: Record<NombreTabla, Tabla> = {
  personas: {
    hoja: 'PERSONAS', sincroniza: true,
    descripcion: 'Personas atendidas (con carnet), acompañantes y servidores públicos.',
    columnas: [...BASE,
      c('folio', 'Folio del carnet: prefijo configurable + número (solo personas atendidas; lo asigna el receptor).'),
      c('nombre', 'Nombre completo.'),
      c('tipo', 'Atendida | Acompañante | Gobierno.'),
      c('colectivo', 'Nombre del colectivo (opcional).'),
      c('contacto', 'Teléfono u otro medio de contacto (opcional).'),
      c('alcaldia_zona', 'Clave de la zona del catálogo del perfil, o texto de la zona (opcional).'),
      c('cargo', 'Cargo (solo servidores públicos).'),
      c('institucion', 'Clave de la institución del catálogo (solo servidores públicos).'),
      ANULADO],
  },
  reuniones: {
    hoja: 'REUNIONES', sincroniza: true,
    descripcion: 'Cada reunión o atención. Se sella al terminar y ya no se modifica.',
    columnas: [...BASE,
      c('estado', 'Borrador | Sellada.'),
      c('sellada_en', 'Fecha y hora en que se selló (ISO 8601).'),
      c('sustituye_a', 'id de la reunión anulada a la que reemplaza (opcional).'),
      c('fecha', 'Fecha de la reunión (AAAA-MM-DD).'),
      c('hora', 'Hora de inicio (HH:MM, opcional).'),
      c('modalidad', 'Presencial | Virtual | Presencial y virtual.'),
      c('sede', 'Lugar con dirección.'),
      c('tema', 'Título corto; va en "Tema:" de la Tarjeta.'),
      c('orden_del_dia', 'Puntos del orden del día, separados por salto de línea (opcional).'),
      c('narrativo', 'Párrafo de la Tarjeta Informativa.'),
      c('carnets', 'Folios de las personas atendidas (se calcula al sellar).'),
      c('tarjeta_url', 'Liga a la Tarjeta Informativa en Drive.'),
      c('minuta_url', 'Liga a la Minuta de Acuerdos en Drive.'),
      ANULADO],
  },
  asistentes: {
    hoja: 'ASISTENTES', sincroniza: true,
    descripcion: 'Personas presentes en cada reunión.',
    columnas: [...BASE,
      c('reunion_id', 'Reunión.'),
      c('persona_id', 'Persona.'),
      c('nombre', 'Nombre de la persona (copiado para leer la Hoja fácilmente).'),
      c('papel', 'Atendida | Acompañante | Gobierno.'),
      c('parentesco_o_cargo', 'Parentesco del acompañante o cargo del servidor público.'),
      QUITADO, ANULADO],
  },
  peticiones: {
    hoja: 'PETICIONES', sincroniza: true,
    descripcion: 'Lo que se pidió en cada reunión.',
    columnas: [...BASE,
      c('reunion_id', 'Reunión.'),
      c('numero', 'Consecutivo en la reunión (se asigna al sellar).'),
      c('texto', 'La petición.'),
      c('persona_ids', 'Personas a quienes corresponde, separadas por coma (opcional).'),
      c('carnets', 'Folios correspondientes (se calcula al sellar).'),
      QUITADO, ANULADO],
  },
  acuerdos: {
    hoja: 'ACUERDOS', sincroniza: true,
    descripcion: 'Acuerdos de cada reunión: el corazón del seguimiento.',
    columnas: [...BASE,
      c('reunion_id', 'Reunión donde se acordó.'),
      c('numero', 'Consecutivo en la reunión: 01, 02… (se asigna al sellar).'),
      c('texto', 'Qué se acordó.'),
      c('persona_ids', 'Personas con carnet a quienes corresponde, separadas por coma.'),
      c('carnets', 'Folios correspondientes (se calcula al sellar).'),
      c('instituciones', 'Claves de institución o área del catálogo, separadas por coma.'),
      c('responsable', 'Correo de quien del equipo lo lleva.'),
      c('fecha_acordada', 'AAAA-MM-DD o AAAA-MM-DDTHH:MM (opcional).'),
      c('sustituye_a', 'id del acuerdo anulado al que reemplaza (opcional).'),
      c('estado_vigente', 'Último estado de HISTORIAL_ESTADOS (se calcula).'),
      QUITADO, ANULADO],
  },
  historial_estados: {
    hoja: 'HISTORIAL_ESTADOS', sincroniza: true,
    descripcion: 'Cada cambio de estado de un acuerdo, como renglón nuevo.',
    columnas: [...BASE,
      c('acuerdo_id', 'Acuerdo.'),
      c('estado', 'Por iniciar | En gestión | Bloqueado | Cumplido.'),
      c('nota', 'Nota; obligatoria en Bloqueado y Cumplido.')],
  },
  anulaciones: {
    hoja: 'ANULACIONES', sincroniza: true,
    descripcion: 'Registro de cada anulación, para monitorearlas.',
    columnas: [...BASE,
      c('entidad', 'persona | reunion | asistente | peticion | acuerdo.'),
      c('registro_id', 'id del registro anulado.'),
      c('nota_aclaratoria', 'Motivo de la anulación (obligatorio, mínimo 10 caracteres).'),
      c('sustituido_por', 'id del registro nuevo que lo reemplaza (se llena solo).')],
  },
  personas_versiones: {
    hoja: 'PERSONAS_VERSIONES', sincroniza: true,
    descripcion: 'Versiones anteriores de los datos de una persona.',
    columnas: [...BASE,
      c('persona_id', 'Persona.'),
      c('campo', 'Campo que cambió.'),
      c('valor_anterior', 'Valor antes del cambio.'),
      c('valor_nuevo', 'Valor después del cambio.')],
  },
  anexos: {
    hoja: 'ANEXOS', sincroniza: true,
    descripcion: 'Fotos y documentos de una reunión.',
    columnas: [...BASE,
      c('reunion_id', 'Reunión.'),
      c('descripcion', 'Pie de foto o nombre del anexo.'),
      c('drive_url', 'Liga al archivo en Drive (se llena al subirlo).'),
      QUITADO],
  },
  instituciones: {
    hoja: 'INSTITUCIONES', sincroniza: true,
    descripcion: 'Catálogo de dependencias de la Ciudad y sus áreas.',
    columnas: [...BASE,
      c('nombre', 'Nombre oficial.'),
      c('siglas', 'Siglas.'),
      c('tipo', 'Dependencia | Órgano desconcentrado | Organismo | Autónomo | Alcaldía | Área | Federal | Otro.'),
      c('area_de', 'Si es un área: clave de la institución a la que pertenece.'),
      c('usos', 'Veces usada en acuerdos (para mostrar primero las más usadas).')],
  },
  colectivos: {
    hoja: 'COLECTIVOS', sincroniza: true,
    descripcion: 'Catálogo de nombres de colectivos.',
    columnas: [...BASE, c('nombre', 'Nombre del colectivo.')],
  },
  usuarios: {
    hoja: 'USUARIOS', sincroniza: false,
    descripcion: 'Correos autorizados para usar Carnet de Atención.',
    columnas: [c('correo', 'Correo de Google.'), c('nombre', 'Nombre.'), c('cargo', 'Cargo.'),
      c('activo', 'TRUE para permitir el acceso.')],
  },
  changelog: {
    hoja: 'CHANGELOG', sincroniza: false,
    descripcion: 'Bitácora automática de todo cambio.',
    columnas: [c('fecha', 'Fecha y hora (ISO 8601).'), c('tabla', 'Tabla.'), c('registro_id', 'Registro.'),
      c('campo', 'Campo (* = registro nuevo).'), c('antes', 'Valor anterior.'), c('ahora', 'Valor nuevo.'),
      c('usuario', 'Correo de quien hizo el cambio.'), c('op_id', 'Operación que lo produjo.')],
  },
  config: {
    hoja: 'CONFIG', sincroniza: false,
    descripcion: 'Ajustes y contadores del receptor.',
    columnas: [c('clave', 'Nombre del ajuste.'), c('valor', 'Valor.')],
  },
  ops: {
    hoja: '_OPS', sincroniza: false,
    descripcion: 'Operaciones ya procesadas (evita duplicados).',
    columnas: [c('op_id', 'Operación.'), c('usuario', 'Correo.'), c('estado', 'aplicada | rechazada.'),
      c('motivo', 'Motivo del rechazo.'), c('aplicada_en', 'Fecha y hora (ISO 8601).')],
  },
};

export const TABLAS_SINCRONIZADAS: NombreTabla[] =
  (Object.keys(TABLAS) as NombreTabla[]).filter(t => TABLAS[t].sincroniza);

export function columnas(t: NombreTabla): string[] {
  return TABLAS[t].columnas.map(col => col.nombre);
}
