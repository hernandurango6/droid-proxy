import { DROIDPROXY_MODEL_PREFIXES } from "./constants";

export function isDroidProxyModelId(id: string): boolean {
  return DROIDPROXY_MODEL_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export function setEquals(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}