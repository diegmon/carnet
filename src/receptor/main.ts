import { AlmacenSheets, prepararLibro } from './sheets';
import { procesar, Dependencias } from './http';
import type { Respuesta } from './http';
import type { RespuestaFoto } from './fotos';
import { sembrar } from './semillas';
import type { Claims } from './acceso';

const PROPIEDAD_LIBRO = 'LIBRO_ID';

function libro(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const id = PropertiesService.getScriptProperties().getProperty(PROPIEDAD_LIBRO);
  if (!id) throw new Error('Corre setup() desde el editor primero');
  return SpreadsheetApp.openById(id);
}

function obtenerClaims(token: string): Claims {
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return {};
  return JSON.parse(r.getContentText()) as Claims;
}

function dependencias(): Dependencias {
  return {
    almacen: new AlmacenSheets(libro()),
    obtenerClaims,
    ahora: () => new Date().toISOString(),
    ahoraSeg: () => Math.floor(Date.now() / 1000),
    candado: fn => {
      const l = LockService.getScriptLock();
      l.waitLock(30000);
      try { return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); }
    },
    guardarArchivo: (nombre, tipo, base64) => {
      const carpeta = new AlmacenSheets(libro()).config('carpeta_drive_id');
      const blob = Utilities.newBlob(Utilities.base64Decode(base64), tipo, nombre);
      return DriveApp.getFolderById(carpeta).createFile(blob).getUrl();
    },
  };
}

const json = (x: unknown) => ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);

export function doPost(e: GoogleAppsScript.Events.DoPost) {
  let r: Respuesta | RespuestaFoto;
  try {
    r = procesar(e?.postData?.contents ?? '', dependencias());
  } catch (err) {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    r = { ok: false, error: 'error_interno', mensaje: 'No se pudo sincronizar; se reintentará sola' };
  }
  return json(r);
}

export function doGet() {
  return json({ ok: true, servicio: 'Carnet de Atención · receptor' });
}

export function setup() {
  const activo = SpreadsheetApp.getActive();
  PropertiesService.getScriptProperties().setProperty(PROPIEDAD_LIBRO, activo.getId());
  prepararLibro(activo);
  const almacen = new AlmacenSheets(activo);
  let carpeta = almacen.config('carpeta_drive_id');
  if (!carpeta) carpeta = DriveApp.createFolder('Carnet de Atención · Archivos').getId();
  const r = sembrar(almacen, () => new Date().toISOString(), carpeta);
  console.log(`Listo. Instituciones nuevas: ${r.instituciones}. Ahora llena client_id en CONFIG y agrega correos en USUARIOS.`);
}
