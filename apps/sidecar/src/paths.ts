import fs from "node:fs";
import path from "node:path";

export function resolveSidecarRootDir(moduleDirname: string): string {
  if (process.env.DROIDPROXY_ROOT) {
    return path.resolve(process.env.DROIDPROXY_ROOT);
  }

  let current = path.resolve(moduleDirname);
  for (let depth = 0; depth < 6; depth += 1) {
    const binaryPath = path.join(current, "resources", "bin", "cli-proxy-api.exe");
    if (fs.existsSync(binaryPath)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error("Could not resolve DroidProxy root directory (set DROIDPROXY_ROOT)");
}