import { writeFileSync } from 'node:fs';
import { generarDiccionario } from '../src/dominio/diccionario';

writeFileSync('docs/DICCIONARIO_DE_DATOS.md', generarDiccionario());
console.log('docs/DICCIONARIO_DE_DATOS.md actualizado');
