export interface ConfigApp { receptorUrl: string; clientId: string }

/** Lee la configuración pública de la app (no son secretos: la seguridad está en el receptor). */
export function leerConfig(env: Record<string, string | boolean | undefined>): ConfigApp | undefined {
  const receptorUrl = String(env.VITE_RECEPTOR_URL ?? '').trim();
  const clientId = String(env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  if (!receptorUrl || !clientId) return undefined;
  if (!/^https:\/\//.test(receptorUrl) && !/^http:\/\/localhost(:\d+)?(\/|$)/.test(receptorUrl)) return undefined;
  return { receptorUrl, clientId };
}
