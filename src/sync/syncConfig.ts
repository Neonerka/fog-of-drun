export const DEFAULT_SERVER_PORT = 8080;
export const DEFAULT_SERVER_HOST = '192.168.1.100';

export const PING_TIMEOUT_MS = 5000;
export const META_UPLOAD_TIMEOUT_MS = 30000;
export const PHOTO_UPLOAD_TIMEOUT_MS = 120000;

export function buildServerUrl(host?: string, port?: number): string {
  const h = host || DEFAULT_SERVER_HOST;
  const p = port || DEFAULT_SERVER_PORT;
  return `http://${h}:${p}`;
}
