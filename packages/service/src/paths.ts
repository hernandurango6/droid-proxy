import { getCliBinaryPath } from "@droidproxy/core";

export function resolveCliBinaryPath(rootDir: string): string {
  return getCliBinaryPath(rootDir);
}