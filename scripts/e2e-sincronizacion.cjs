/* Prueba de punta a punta con dos "teléfonos". Requiere: npm run receptor:local, y la app compilada en modo prueba y servida en 4173. */
const puppeteer = require('puppeteer-core');
const APP = 'http://localhost:4173/';
const RECEPTOR = 'http://localhost:8787/';
const esperar = ms => new Promise(r => setTimeout(r, ms));

async function texto(p) { return p.evaluate(() => document.body.innerText); }
async function clic(p, t) {
  const h = await p.evaluateHandle(x => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === x), t);
  if (!h.asElement()) throw new Error('No hay botón ' + t);
  await h.asElement().click(); await esperar(300);
}
async function escribir(p, etiqueta, valor) {
  const h = await p.evaluateHandle(t => [...document.querySelectorAll('label.campo')].find(l => l.querySelector('span')?.textContent === t)?.querySelector('input,textarea,select'), etiqueta);
  await h.asElement().type(valor);
}
async function entrar(p, correo) {
  await p.goto(APP, { waitUntil: 'networkidle0' });
  await p.type('input[aria-label="Correo de prueba"]', correo);
  await clic(p, 'Entrar como prueba');
  await p.waitForFunction(() => document.body.innerText.includes('Seguimiento'));
}

(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const tel1 = await b.createBrowserContext();
  const p1 = await tel1.newPage();
  await entrar(p1, 'ana.torres@ejemplo.mx');
  await p1.setOfflineMode(true);
  await clic(p1, 'Carnets'); await clic(p1, 'Nuevo carnet');
  await escribir(p1, 'Nombre completo', 'María Fernanda Ríos'); await clic(p1, 'Guardar');
  console.log('· sin señal, folio:', (await texto(p1)).includes('Folio pendiente') ? 'pendiente ✓' : '✗');
  await p1.setOfflineMode(false);
  await p1.evaluate(() => window.dispatchEvent(new Event('online')));
  await p1.waitForFunction(() => document.body.innerText.includes('CA-001'), { timeout: 15000 });
  console.log('· con señal: folio definitivo CA-001 ✓');
  const tel2 = await b.createBrowserContext();
  const p2 = await tel2.newPage();
  await entrar(p2, 'luis.vega@ejemplo.mx');
  await clic(p2, 'Carnets');
  await p2.waitForFunction(() => document.body.innerText.includes('María Fernanda Ríos'), { timeout: 15000 });
  console.log('· el segundo teléfono ve el carnet ✓');
  const estado = await (await fetch(RECEPTOR)).json();
  console.log('· receptor:', estado);
  if (estado.personas !== 1) throw new Error('El receptor debería tener 1 persona');
  await b.close();
  console.log('Prueba de punta a punta completa.');
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
