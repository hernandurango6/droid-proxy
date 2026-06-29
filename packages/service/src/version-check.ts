import http from "http";
import { BACKEND_HOST } from "@droidproxy/core";

export const MINIMUM_BACKEND_VERSION = "7.1.0";

export type BackendHealth = "ok" | "degraded" | "down";

export interface VersionProbeResult {
  health: BackendHealth;
  version: string | null;
  message: string;
}

export function compareSemver(left: string, right: string): number {
  const parse = (value: string) => value.split(".").map((part) => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

export function isBackendVersionSupported(version: string | null): boolean {
  if (!version) return false;
  return compareSemver(version, MINIMUM_BACKEND_VERSION) >= 0;
}

function requestText(options: http.RequestOptions, timeoutMs = 5000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 500,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request timed out"));
    });
    req.end();
  });
}

function extractVersionFromBody(body: string): string | null {
  try {
    const payload = JSON.parse(body);
    if (typeof payload?.version === "string") return payload.version;
    if (typeof payload?.data?.version === "string") return payload.data.version;
  } catch {
    // Fall through to header/body parsing below.
  }

  const match = body.match(/\b(\d+\.\d+\.\d+)\b/);
  return match ? match[1] : null;
}

export async function probeBackendVersion(
  backendPort: number,
  backendHost: string = BACKEND_HOST,
  timeoutMs = 5000
): Promise<VersionProbeResult> {
  const host = backendHost;

  try {
    const versionResponse = await requestText({
      host,
      port: backendPort,
      path: "/v0/management/version",
      method: "GET",
      timeout: timeoutMs
    }, timeoutMs);

    if (versionResponse.status < 500) {
      const version = extractVersionFromBody(versionResponse.body);
      if (version) {
        return {
          health: isBackendVersionSupported(version) ? "ok" : "degraded",
          version,
          message: isBackendVersionSupported(version)
            ? `Backend version ${version}`
            : `Backend version ${version} is below minimum ${MINIMUM_BACKEND_VERSION}`
        };
      }
    }
  } catch {
    // Try auth-files fallback below.
  }

  try {
    const authFilesResponse = await requestText({
      host,
      port: backendPort,
      path: "/v0/management/auth-files",
      method: "GET",
      timeout: timeoutMs
    }, timeoutMs);

    if (authFilesResponse.status === 200 || authFilesResponse.status === 401) {
      return {
        health: "ok",
        version: null,
        message: "Backend management API reachable (version endpoint unavailable)"
      };
    }
  } catch {
    // Mark as down below.
  }

  return {
    health: "down",
    version: null,
    message: "Backend management API unreachable"
  };
}

export function assertMinimumVersion(
  version: string | null,
  onWarning: (message: string) => void = () => {}
): BackendHealth {
  if (!version) return "ok";
  if (isBackendVersionSupported(version)) return "ok";
  const message = `cli-proxy-api version ${version} is below minimum ${MINIMUM_BACKEND_VERSION}`;
  onWarning(message);
  return "degraded";
}