/* Receptor de pruebas en Node con las mismas reglas que el de Apps Script. NO verifica firmas: solo para la computadora local. */
import { createServer } from 'node:http';
import { AlmacenMemoria } from '../src/receptor/almacen';
import { procesar } from '../src/receptor/http';
import { sembrar } from '../src/receptor/semillas';

const almacen = new AlmacenMemoria({
  usuarios: [{ correo: 'ana.torres@ejemplo.mx', nombre: 'Ana Torres', cargo: 'Enlace territorial', activo: true },
    { correo: 'luis.vega@ejemplo.mx', nombre: 'Luis Vega', cargo: 'Enlace territorial', activo: true }],
  config: [{ clave: 'client_id', valor: 'local' }],
});
sembrar(almacen, () => new Date().toISOString(), 'carpeta-local');
const archivos = new Map<string, string>();

function claims(token: string) {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return { aud: 'local', email: p.email, email_verified: true, exp: p.exp };
  } catch { return {}; }
}

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, servicio: 'Carnet de Atención · receptor local', personas: almacen.filas('personas').length, fotos: archivos.size }));
    return;
  }
  let cuerpo = '';
  req.on('data', c => { cuerpo += c; });
  req.on('end', () => {
    const r = procesar(cuerpo, {
      almacen, obtenerClaims: claims, ahora: () => new Date().toISOString(), ahoraSeg: () => Math.floor(Date.now() / 1000),
      candado: fn => fn(),
      guardarArchivo: (nombre, _tipo, b64) => { archivos.set(nombre, b64); return `http://localhost:8787/archivo/${nombre}`; },
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(r));
  });
}).listen(8787, () => console.log('Receptor local en http://localhost:8787'));
