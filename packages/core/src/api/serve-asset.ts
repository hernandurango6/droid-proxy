import fs from "node:fs";
import path from "node:path";
import type { ServerResponse } from "node:http";
import { contentTypeFor } from "./content-type";

export function resolveDashboardAssetPath(dashboardDir: string, pathname: string): string | null {
  const root = path.resolve(dashboardDir);
  const assetName = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const assetPath = path.resolve(root, assetName);

  if (!assetPath.startsWith(root) || !fs.existsSync(assetPath) || fs.statSync(assetPath).isDirectory()) {
    return null;
  }

  return assetPath;
}

export function serveDashboardAsset(
  dashboardDir: string,
  pathname: string,
  res: ServerResponse
): void {
  const assetPath = resolveDashboardAssetPath(dashboardDir, pathname);

  if (!assetPath) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentTypeFor(assetPath) });
  fs.createReadStream(assetPath).pipe(res);
}