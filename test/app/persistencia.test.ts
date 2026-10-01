import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { persistenciaIdb, persistenciaMemoria, exportar } from '../../app/src/estado/persistencia';
import { AlmacenMemoria, filaVacia } from '../../src/receptor/almacen';
import type { Operacion } from '../../src/dominio/operaciones';

const op: Operacion = { op_id: 'o1', tipo: 'sellar', entidad: 'reunion', id: 'r1', ts: '2026-09-30T17:00:00-06:00' };

for (const [nombre, crear] of [['IndexedDB', () => persistenciaIdb('prueba-' + Math.random())], ['memoria', persistenciaMemoria]] as const) {
  describe(`persistencia en ${nombre}`, () => {
    it('empieza vacía', async () => {
      expect(await crear().cargar()).toEqual({ tablas: {}, cola: [], sesion: undefined });
    });
    it('guarda y recarga tablas, cola y sesión', async () => {
      const p = crear();
      const a = new AlmacenMemoria({ colectivos: [{ ...filaVacia('colectivos'), id: 'c1', nombre: 'Colectivo Raíces' }] });
      await p.guardar(exportar(a), [op]);
      await p.guardarSesion({ correo: 'ana.torres@ejemplo.mx', nombre: 'Ana Torres', cargo: '' });
      const d = await p.cargar();
      expect(d.tablas.colectivos![0].nombre).toBe('Colectivo Raíces');
      expect(d.cola).toEqual([op]);
      expect(d.sesion?.nombre).toBe('Ana Torres');
    });
    it('guarda y lee fotos', async () => {
      const p = crear();
      await p.guardarFoto('f1', new Blob(['abc'], { type: 'image/jpeg' }));
      const b = await p.leerFoto('f1');
      expect(b?.type).toBe('image/jpeg');
      expect(await b?.text()).toBe('abc');
      expect(await p.leerFoto('nada')).toBeUndefined();
    });
  });
}

it('exportar incluye todas las tablas', () => {
  const t = exportar(new AlmacenMemoria());
  expect(Object.keys(t)).toContain('personas');
  expect(Object.keys(t)).toContain('ops');
});
