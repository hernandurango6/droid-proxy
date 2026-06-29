export function parseJSONBody(body: Buffer | null | undefined): Record<string, unknown> | null {
  if (!body || body.length === 0) return null;
  try {
    return JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}