import { describe, it, expect } from 'vitest';
import { aplicarOperaciones } from '../../src/receptor/aplicar';
import { almacenBase, reloj, USUARIO, crear } from './ayuda';

describe('catálogos', () => {
  it('crea colectivos y rechaza duplicados sin importar acentos ni mayúsculas', () => {
    const a = almacenBase();
    const r = aplicarOperaciones(a, USUARIO, [
      crear('colectivo', 'c1', { nombre: 'Colectivo Raíces' }),
      crear('colectivo', 'c2', { nombre: 'colectivo  RAICES' }),
      crear('colectivo', 'c3', { nombre: '' }),
    ], reloj());
    expect(r.resultados.map(x => x.estado)).toEqual(['aplicada', 'rechazada', 'rechazada']);
    expect(r.resultados[1].motivo).toMatch(/ya existe/);
  });
  it('crea instituciones y áreas, validando que el área pertenezca a una institución existente', () => {
    const a = almacenBase();
    const r = aplicarOperaciones(a, USUARIO, [
      crear('institucion', 'salud', { nombre: 'Secretaría de Salud', siglas: 'SALUD', tipo: 'Dependencia' }),
      crear('institucion', 'salud-clinica', { nombre: 'Clínica Especializada', tipo: 'Área', area_de: 'salud' }),
      crear('institucion', 'x-area', { nombre: 'Área huérfana', tipo: 'Área', area_de: 'no-existe' }),
      crear('institucion', 'salud-2', { nombre: 'SECRETARIA de salud', tipo: 'Dependencia' }),
      crear('institucion', 'raro', { nombre: 'Algo', tipo: 'Inventado' }),
    ], reloj());
    expect(r.resultados.map(x => x.estado)).toEqual(['aplicada', 'aplicada', 'rechazada', 'rechazada', 'rechazada']);
    expect(a.filas('instituciones').find(i => i.id === 'salud-clinica')).toMatchObject({ area_de: 'salud', usos: 0 });
  });
});
