import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { rutaPerfil } from './perfil.mjs';

mkdirSync('receptor-dist', { recursive: true });
await build({
  entryPoints: ['src/receptor/main.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'Receptor',
  target: 'es2019',
  charset: 'utf8',
  outfile: 'receptor-dist/receptor.js',
  logLevel: 'warning',
  alias: { '@perfil': rutaPerfil() },
});
const envoltura = `
function doPost(e) { return Receptor.doPost(e); }
function doGet(e) { return Receptor.doGet(e); }
function setup() { return Receptor.setup(); }
`;
writeFileSync('receptor-dist/receptor.js', readFileSync('receptor-dist/receptor.js', 'utf8') + envoltura);
copyFileSync('receptor/appsscript.json', 'receptor-dist/appsscript.json');
