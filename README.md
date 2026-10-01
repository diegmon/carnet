# Carnet de Atención

**Software público de gestión de casos para equipos de atención en territorio.** Registra reuniones, presentes, peticiones y acuerdos con las personas atendidas, y da seguimiento a cada acuerdo hasta que se cumple. Funciona sin señal desde el celular y deja constancia de todo: lo guardado no se borra; se anula con una nota aclaratoria.

Este repositorio contiene **solo código**. Nunca incluye datos de personas.

## Cómo funciona

- **App instalable (PWA)** en `app/`: captura sin conexión, carnets por persona atendida, reuniones (individuales o grupales), acuerdos con estado (Por iniciar · En gestión · Bloqueado · Cumplido) y pantalla de Seguimiento.
- **Receptor** en `src/receptor/` (Google Apps Script): valida cada operación, asigna folios consecutivos y guarda todo, solo agregando, en una Hoja de Cálculo de Google con bitácora de cambios.
- **Dominio compartido** en `src/dominio/`: el teléfono aplica exactamente las mismas reglas que el receptor.

## Configurar para tu institución (perfil)

Todo lo propio de quien lo usa vive en un **perfil**, fuera del repositorio:

1. Copia `perfil.ejemplo.json` a `privado/perfil.json`. La carpeta `privado/` está excluida de git.
2. Ajusta:
   - `institucion`: el texto de marca.
   - `prefijoFolio`: por ejemplo `CA-`, para folios `CA-001`.
   - `paraCargo`: el cargo del destinatario de los documentos.
   - `etiquetaZona` y `zonas`: tus zonas territoriales.
   - `instituciones`: el catálogo de dependencias y sus áreas.
   - `colores`.
3. Al compilar (`npm run build:app` y `npm run build:receptor`) se usa automáticamente `privado/perfil.json`. También puedes indicar otro con `PERFIL=ruta`.

## Desarrollo

- `npm install` · `npm test` · `npm run typecheck`
- App: `npm run dev` (desarrollo) · `npm run build:app` (sale a `app-dist/`)
- Receptor: `npm run build:receptor` y la guía `docs/INSTALACION_RECEPTOR.md`
- Diccionario de datos: `docs/DICCIONARIO_DE_DATOS.md`
- Prueba local de punta a punta (dos teléfonos simulados, sin Google):
  1. `npm run receptor:local` (receptor en `http://localhost:8787`, en memoria; arráncalo de nuevo antes de cada corrida).
  2. `PERFIL=perfil.ejemplo.json VITE_RECEPTOR_URL=http://localhost:8787 VITE_GOOGLE_CLIENT_ID=local VITE_ACCESO_PRUEBA=1 npm run build:app` y `npx vite preview --port 4173`.
  3. `npm run e2e` (requiere Chromium; ruta en `CHROMIUM`, por omisión `/usr/bin/chromium`).
  4. Vuelve a compilar sin esas variables antes de publicar: el acceso de prueba solo existe con `VITE_ACCESO_PRUEBA=1`.

## Licencia

Copyright (C) 2026 diegmon

Este programa es software libre: puedes redistribuirlo y modificarlo bajo los términos de la **Licencia Pública General Affero de GNU (AGPL)**, publicada por la Free Software Foundation, versión 3 o, a tu elección, cualquier versión posterior. Se distribuye con la esperanza de que sea útil, pero **sin ninguna garantía**. Consulta el archivo [`LICENSE`](LICENSE).

Si ofreces una versión modificada como servicio en red, la AGPL te pide poner su código a disposición de quienes la usan.
