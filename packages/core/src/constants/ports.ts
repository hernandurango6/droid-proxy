import os from "os";

export const DEFAULT_FRONTEND_PORT = 8417;
export const DEFAULT_BACKEND_PORT = 8418;
export const DEFAULT_DASHBOARD_PORT = 8419;
export const DEFAULT_CONTROL_PORT = 8420;
export const BACKEND_HOST = "127.0.0.1";

export const ENV_FRONTEND_HOST = "DROIDPROXY_HOST";
export const ENV_FRONTEND_PORT = "DROIDPROXY_PORT";
export const ENV_BACKEND_PORT = "DROIDPROXY_BACKEND_PORT";
export const ENV_DASHBOARD_HOST = "DROIDPROXY_DASHBOARD_HOST";
export const ENV_DASHBOARD_PORT = "DROIDPROXY_DASHBOARD_PORT";
export const ENV_PUBLIC_HOST = "DROIDPROXY_PUBLIC_HOST";
export const ENV_COMMANDCODE_URL = "DROIDPROXY_COMMANDCODE_URL";
export const ENV_CONTROL_PORT = "DROIDPROXY_CONTROL_PORT";

export const DEFAULT_COMMANDCODE_API_URL = "https://api.commandcode.ai/alpha/generate";

export function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

export function resolveFrontendHost(env: NodeJS.ProcessEnv = process.env): string {
  return env[ENV_FRONTEND_HOST] || "0.0.0.0";
}

export function resolveFrontendPort(env: NodeJS.ProcessEnv = process.env): number {
  return parsePort(env[ENV_FRONTEND_PORT], DEFAULT_FRONTEND_PORT);
}

export function resolveBackendPort(env: NodeJS.ProcessEnv = process.env): number {
  return parsePort(env[ENV_BACKEND_PORT], DEFAULT_BACKEND_PORT);
}

export function resolveDashboardHost(env: NodeJS.ProcessEnv = process.env): string {
  return env[ENV_DASHBOARD_HOST] || "127.0.0.1";
}

export function resolveDashboardPort(env: NodeJS.ProcessEnv = process.env): number {
  return parsePort(env[ENV_DASHBOARD_PORT], DEFAULT_DASHBOARD_PORT);
}

export function resolveCommandCodeApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env[ENV_COMMANDCODE_URL] || DEFAULT_COMMANDCODE_API_URL;
}

export function resolveControlPort(env: NodeJS.ProcessEnv = process.env): number {
  return parsePort(env[ENV_CONTROL_PORT], DEFAULT_CONTROL_PORT);
}

export function detectPublicHost(): string {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "127.0.0.1";
}

export function resolvePublicHost(env: NodeJS.ProcessEnv = process.env): string {
  return env[ENV_PUBLIC_HOST] || detectPublicHost();
}

export function getManagementUrl(backendHost: string = BACKEND_HOST, backendPort: number = DEFAULT_BACKEND_PORT): string {
  return `http://${backendHost}:${backendPort}/management.html`;
}

export function getProxyUrl(
  frontendHost: string,
  frontendPort: number,
  publicHost?: string
): string {
  const host = frontendHost === "0.0.0.0" || frontendHost === "::"
    ? (publicHost || detectPublicHost())
    : frontendHost;
  return `http://${host}:${frontendPort}`;
}

export function getProxyBaseUrl(
  frontendHost: string,
  frontendPort: number,
  publicHost?: string
): string {
  return `${getProxyUrl(frontendHost, frontendPort, publicHost)}/v1`;
}