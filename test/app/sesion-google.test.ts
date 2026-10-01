import { describe, it, expect } from 'vitest';
import { leerToken, tokenVigente } from '../../app/src/estado/sesion-google';
import { motorDePrueba, tokenDePrueba, HOY, USUARIA } from './ayuda';

describe('token de Google', () => {
  it('lee correo, nombre y vencimiento, aun con acentos', () => {
    const t = tokenDePrueba('Ana.Torres@ejemplo.mx', 'Ana Torres Núñez', 1_800_000_000);
    expect(leerToken(t)).toEqual({ correo: 'ana.torres@ejemplo.mx', nombre: 'Ana Torres Núñez', expira: 1_800_000_000 });
    expect(() => leerToken('basura')).toThrow();
  });
  it('dice si el token sigue vigente con margen', () => {
    const seg = Math.floor(HOY.getTime() / 1000);
    expect(tokenVigente({ ...USUARIA, token: 't', expira: seg + 3600 }, HOY)).toBe('t');
    expect(tokenVigente({ ...USUARIA, token: 't', expira: seg + 30 }, HOY)).toBeUndefined();
    expect(tokenVigente({ ...USUARIA }, HOY)).toBeUndefined();
    expect(tokenVigente(undefined, HOY)).toBeUndefined();
  });
});

describe('Motor.iniciarSesionGoogle', () => {
  it('primera vez configura la sesión; después solo renueva el token', async () => {
    const m = await motorDePrueba(false);
    await m.iniciarSesionGoogle(tokenDePrueba());
    expect(m.sesion).toMatchObject({ correo: USUARIA.correo, nombre: USUARIA.nombre, token: expect.any(String) });
    expect(m.almacen.filas('instituciones').length).toBeGreaterThan(5);
    const nuevo = tokenDePrueba(USUARIA.correo, USUARIA.nombre, Math.floor(HOY.getTime() / 1000) + 7200);
    await m.iniciarSesionGoogle(nuevo);
    expect(m.sesion?.token).toBe(nuevo);
  });
  it('no mezcla cuentas si hay cambios sin enviar', async () => {
    const m = await motorDePrueba(false);
    await m.iniciarSesionGoogle(tokenDePrueba());
    m.ejecutar(m.crear('colectivo', { nombre: 'Raíces' }));
    await expect(m.iniciarSesionGoogle(tokenDePrueba('otra@ejemplo.mx', 'Otra'))).rejects.toThrow(/otra cuenta/);
    expect(m.sesion?.correo).toBe(USUARIA.correo);
  });
});
