import { describe, it, expect } from 'vitest';
import { escaparCelda, normalizarLeido } from '../../src/receptor/celdas';
import { PERFIL } from '../../src/dominio/perfil';
const INSTITUCIONES_SEMILLA = PERFIL.instituciones;
import { sembrar } from '../../src/receptor/semillas';
import { AlmacenMemoria } from '../../src/receptor/almacen';
import { reloj } from './ayuda';

describe('celdas (Review Focus 1 y 5)', () => {
  it('nunca deja que un texto se evalúe como fórmula', () => {
    expect(escaparCelda('=IMPORTXML("http://x","//a")')).toBe('\'=IMPORTXML("http://x","//a")');
    expect(escaparCelda('+52 55')).toBe("'+52 55");
    expect(escaparCelda('- se envió oficio')).toBe("'- se envió oficio");
    expect(escaparCelda('@usuario')).toBe("'@usuario");
    expect(escaparCelda('Normal')).toBe('Normal');
    expect(escaparCelda(5)).toBe(5);
    expect(escaparCelda(true)).toBe(true);
  });
  it('convierte lo que devuelve Sheets a valores simples', () => {
    expect(normalizarLeido(null)).toBe('');
    expect(normalizarLeido(undefined)).toBe('');
    expect(normalizarLeido(new Date(2026, 8, 30))).toBe('2026-09-30');
    expect(normalizarLeido(new Date(Date.UTC(2026, 8, 30, 16, 5)))).toBe('2026-09-30T16:05:00.000Z');
    expect(normalizarLeido('TRUE')).toBe('TRUE');
    expect(normalizarLeido(7)).toBe(7);
  });
});

describe('catálogos semilla (del perfil)', () => {
  it('las instituciones tienen ids únicos y sus áreas apuntan a instituciones existentes', () => {
    const ids = INSTITUCIONES_SEMILLA.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INSTITUCIONES_SEMILLA) if (i.area_de) expect(ids).toContain(i.area_de);
    expect(ids).toEqual(expect.arrayContaining(['fiscalia', 'fiscalia-mp', 'busqueda', 'seguridad', 'monitoreo', 'salud-clinica']));
  });
});

describe('sembrar', () => {
  it('llena config e instituciones una sola vez sin pisar ajustes existentes', () => {
    const a = new AlmacenMemoria({ config: [{ clave: 'client_id', valor: 'ya-configurado' }] });
    const r1 = sembrar(a, reloj(), 'carpeta-1');
    expect(r1.instituciones).toBe(INSTITUCIONES_SEMILLA.length);
    expect(a.config('client_id')).toBe('ya-configurado');
    expect(a.config('carpeta_drive_id')).toBe('carpeta-1');
    expect(a.config('ultimo_folio')).toBe('0');
    const r2 = sembrar(a, reloj(), 'carpeta-2');
    expect(r2.instituciones).toBe(0);
    expect(a.config('carpeta_drive_id')).toBe('carpeta-1');
    expect(a.filas('instituciones')).toHaveLength(INSTITUCIONES_SEMILLA.length);
    expect(Number(a.config('ultimo_rev'))).toBe(INSTITUCIONES_SEMILLA.length);
  });
});
