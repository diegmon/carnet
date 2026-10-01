# Instalación del receptor (cuenta dueña)

Se hace una sola vez. Tiempo: ~30 minutos.

0. **Perfil:** prepara `privado/perfil.json` (ver el README). El receptor toma de ahí el prefijo de folio, el cargo del destinatario y el catálogo inicial.
1. **Cuenta dueña:** entrar con la cuenta de Google dedicada de la institución y activar la verificación en dos pasos.
2. **Hoja de Cálculo:** crear una Hoja nueva llamada `Carnet de Atención · Base de datos`. Menú *Extensiones › Apps Script*.
   Copiar el **ID del script** (Configuración del proyecto).
3. **Subir el código** (en la computadora, dentro del repositorio):
   ```bash
   npm install
   npm run build:receptor
   cp receptor/.clasp.json.ejemplo .clasp.json   # pegar el ID del script en scriptId
   npx clasp login                               # con la cuenta dueña
   npx clasp push -f
   ```
4. **Preparar la Hoja:** en el editor de Apps Script elegir la función `setup` y darle ▶ Ejecutar.
   Aceptar permisos (Hojas, Drive y conexiones externas). Revisar el registro: "Listo. Instituciones nuevas: …".
5. **ID de cliente de Google** (para iniciar sesión desde la app):
   en https://console.cloud.google.com crear un proyecto gratuito `carnet`, *APIs y servicios › Pantalla de consentimiento*
   (tipo Externo, en modo prueba, agregar los correos del equipo como usuarios de prueba),
   y *Credenciales › Crear ID de cliente de OAuth › Aplicación web*. Por ahora, sin orígenes (el Plan 4 agrega la dirección de GitHub Pages).
   Copiar el ID de cliente en la pestaña **CONFIG**, renglón `client_id`.
6. **Usuarios:** en la pestaña **USUARIOS** agregar un renglón por persona: `correo`, `nombre`, `cargo`, `activo` = `TRUE`.
   MVP: la cuenta dueña y el primer usuario.
7. **Publicar:** *Implementar › Nueva implementación › Aplicación web*. Ejecutar como: **yo**. Acceso: **Cualquier usuario**.
   Copiar la URL (`https://script.google.com/macros/s/…/exec`). La seguridad depende de la verificación del inicio de sesión en cada solicitud,
   no de esta opción: sin una cuenta autorizada, el receptor rechaza todo.
8. **Prueba de humo:** `bash scripts/humo.sh <URL>`.
9. Revisar que las pestañas tengan formato de texto (Formato › Número › Texto sin formato) y que no esté compartida con nadie más.

Para actualizar el código después: `npm run build:receptor && npx clasp push -f` y *Implementar › Administrar implementaciones › Editar › Nueva versión*.
