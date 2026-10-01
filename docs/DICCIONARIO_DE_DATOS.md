# Diccionario de datos · Carnet de Atención

Generado desde `src/dominio/esquema.ts` (`npm run diccionario`). No editar a mano.

Formatos: fechas ISO 8601, texto UTF-8, exportable a CSV. Las zonas usan las claves del catálogo del perfil.
Este documento describe la estructura; **los datos personales nunca son datos abiertos**.

## PERSONAS

Personas atendidas (con carnet), acompañantes y servidores públicos.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `folio` | Folio del carnet: prefijo configurable + número (solo personas atendidas; lo asigna el receptor). |
| `nombre` | Nombre completo. |
| `tipo` | Atendida \| Acompañante \| Gobierno. |
| `colectivo` | Nombre del colectivo (opcional). |
| `contacto` | Teléfono u otro medio de contacto (opcional). |
| `alcaldia_zona` | Clave de la zona del catálogo del perfil, o texto de la zona (opcional). |
| `cargo` | Cargo (solo servidores públicos). |
| `institucion` | Clave de la institución del catálogo (solo servidores públicos). |
| `anulado` | TRUE si fue anulado (ver ANULACIONES). |

## REUNIONES

Cada reunión o atención. Se sella al terminar y ya no se modifica.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `estado` | Borrador \| Sellada. |
| `sellada_en` | Fecha y hora en que se selló (ISO 8601). |
| `sustituye_a` | id de la reunión anulada a la que reemplaza (opcional). |
| `fecha` | Fecha de la reunión (AAAA-MM-DD). |
| `hora` | Hora de inicio (HH:MM, opcional). |
| `modalidad` | Presencial \| Virtual \| Presencial y virtual. |
| `sede` | Lugar con dirección. |
| `tema` | Título corto; va en "Tema:" de la Tarjeta. |
| `orden_del_dia` | Puntos del orden del día, separados por salto de línea (opcional). |
| `narrativo` | Párrafo de la Tarjeta Informativa. |
| `carnets` | Folios de las personas atendidas (se calcula al sellar). |
| `tarjeta_url` | Liga a la Tarjeta Informativa en Drive. |
| `minuta_url` | Liga a la Minuta de Acuerdos en Drive. |
| `anulado` | TRUE si fue anulado (ver ANULACIONES). |

## ASISTENTES

Personas presentes en cada reunión.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `reunion_id` | Reunión. |
| `persona_id` | Persona. |
| `nombre` | Nombre de la persona (copiado para leer la Hoja fácilmente). |
| `papel` | Atendida \| Acompañante \| Gobierno. |
| `parentesco_o_cargo` | Parentesco del acompañante o cargo del servidor público. |
| `quitado` | TRUE si se quitó mientras la reunión era borrador. |
| `anulado` | TRUE si fue anulado (ver ANULACIONES). |

## PETICIONES

Lo que se pidió en cada reunión.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `reunion_id` | Reunión. |
| `numero` | Consecutivo en la reunión (se asigna al sellar). |
| `texto` | La petición. |
| `persona_ids` | Personas a quienes corresponde, separadas por coma (opcional). |
| `carnets` | Folios correspondientes (se calcula al sellar). |
| `quitado` | TRUE si se quitó mientras la reunión era borrador. |
| `anulado` | TRUE si fue anulado (ver ANULACIONES). |

## ACUERDOS

Acuerdos de cada reunión: el corazón del seguimiento.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `reunion_id` | Reunión donde se acordó. |
| `numero` | Consecutivo en la reunión: 01, 02… (se asigna al sellar). |
| `texto` | Qué se acordó. |
| `persona_ids` | Personas con carnet a quienes corresponde, separadas por coma. |
| `carnets` | Folios correspondientes (se calcula al sellar). |
| `instituciones` | Claves de institución o área del catálogo, separadas por coma. |
| `responsable` | Correo de quien del equipo lo lleva. |
| `fecha_acordada` | AAAA-MM-DD o AAAA-MM-DDTHH:MM (opcional). |
| `sustituye_a` | id del acuerdo anulado al que reemplaza (opcional). |
| `estado_vigente` | Último estado de HISTORIAL_ESTADOS (se calcula). |
| `quitado` | TRUE si se quitó mientras la reunión era borrador. |
| `anulado` | TRUE si fue anulado (ver ANULACIONES). |

## HISTORIAL_ESTADOS

Cada cambio de estado de un acuerdo, como renglón nuevo.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `acuerdo_id` | Acuerdo. |
| `estado` | Por iniciar \| En gestión \| Bloqueado \| Cumplido. |
| `nota` | Nota; obligatoria en Bloqueado y Cumplido. |

## ANULACIONES

Registro de cada anulación, para monitorearlas.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `entidad` | persona \| reunion \| asistente \| peticion \| acuerdo. |
| `registro_id` | id del registro anulado. |
| `nota_aclaratoria` | Motivo de la anulación (obligatorio, mínimo 10 caracteres). |
| `sustituido_por` | id del registro nuevo que lo reemplaza (se llena solo). |

## PERSONAS_VERSIONES

Versiones anteriores de los datos de una persona.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `persona_id` | Persona. |
| `campo` | Campo que cambió. |
| `valor_anterior` | Valor antes del cambio. |
| `valor_nuevo` | Valor después del cambio. |

## ANEXOS

Fotos y documentos de una reunión.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `reunion_id` | Reunión. |
| `descripcion` | Pie de foto o nombre del anexo. |
| `drive_url` | Liga al archivo en Drive (se llena al subirlo). |
| `quitado` | TRUE si se quitó mientras la reunión era borrador. |

## INSTITUCIONES

Catálogo de dependencias de la Ciudad y sus áreas.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `nombre` | Nombre oficial. |
| `siglas` | Siglas. |
| `tipo` | Dependencia \| Órgano desconcentrado \| Organismo \| Autónomo \| Alcaldía \| Área \| Federal \| Otro. |
| `area_de` | Si es un área: clave de la institución a la que pertenece. |
| `usos` | Veces usada en acuerdos (para mostrar primero las más usadas). |

## COLECTIVOS

Catálogo de nombres de colectivos.

| Columna | Descripción |
|---|---|
| `id` | Identificador interno (UUID generado en el teléfono, o clave del catálogo). |
| `creado_por` | Correo de quien lo capturó. |
| `creado_en` | Fecha y hora de captura en el teléfono (ISO 8601). |
| `servidor_en` | Fecha y hora en que el receptor lo guardó (ISO 8601). |
| `_rev` | Número de revisión del receptor; sirve para sincronizar. |
| `nombre` | Nombre del colectivo. |

## USUARIOS

Correos autorizados para usar Carnet de Atención.

| Columna | Descripción |
|---|---|
| `correo` | Correo de Google. |
| `nombre` | Nombre. |
| `cargo` | Cargo. |
| `activo` | TRUE para permitir el acceso. |

## CHANGELOG

Bitácora automática de todo cambio.

| Columna | Descripción |
|---|---|
| `fecha` | Fecha y hora (ISO 8601). |
| `tabla` | Tabla. |
| `registro_id` | Registro. |
| `campo` | Campo (* = registro nuevo). |
| `antes` | Valor anterior. |
| `ahora` | Valor nuevo. |
| `usuario` | Correo de quien hizo el cambio. |
| `op_id` | Operación que lo produjo. |

## CONFIG

Ajustes y contadores del receptor.

| Columna | Descripción |
|---|---|
| `clave` | Nombre del ajuste. |
| `valor` | Valor. |

## _OPS

Operaciones ya procesadas (evita duplicados).

| Columna | Descripción |
|---|---|
| `op_id` | Operación. |
| `usuario` | Correo. |
| `estado` | aplicada \| rechazada. |
| `motivo` | Motivo del rechazo. |
| `aplicada_en` | Fecha y hora (ISO 8601). |
