import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const SHIM_TARGETS = {
  "services/api/client": "apiClient.shim.ts",
  "stores/useAuthStore": "useAuthStore.shim.ts",
  "services/storage/secureStorage": "secureStorage.shim.ts"
} as const;

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isVendorImporter(importer?: string): boolean {
  if (!importer) return false;
  return normalizePath(importer).includes("/vendor/management-center/");
}

function resolveExistingFile(basePath: string): string | undefined {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.scss`,
    `${basePath}.css`,
    `${basePath}.sass`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return undefined;
}

export function managementUiResolver(desktopRoot: string): Plugin {
  const desktopSrc = path.resolve(desktopRoot, "src");
  const vendorRoot = path.resolve(desktopRoot, "vendor/management-center/src");
  const adapterRoot = path.resolve(desktopRoot, "src/management/adapter");

  const shimPath = (target: keyof typeof SHIM_TARGETS) =>
    path.resolve(adapterRoot, SHIM_TARGETS[target]);

  const resolveShim = (subpath: string): string | undefined => {
    if (subpath in SHIM_TARGETS) {
      return shimPath(subpath as keyof typeof SHIM_TARGETS);
    }
    return undefined;
  };

  return {
    name: "droidproxy-management-ui-resolver",
    enforce: "pre",
    resolveId(source, importer) {
      if (source.startsWith("@/")) {
        const subpath = source.slice(2);
        if (isVendorImporter(importer)) {
          const shim = resolveShim(subpath);
          if (shim) return shim;
          return resolveExistingFile(path.resolve(vendorRoot, subpath));
        }
        return resolveExistingFile(path.resolve(desktopSrc, subpath));
      }

      if (source === "@droidproxy/management-ui" || source.startsWith("@droidproxy/management-ui/")) {
        const subpath =
          source === "@droidproxy/management-ui" ? "index" : source.slice("@droidproxy/management-ui/".length);
        const shim = resolveShim(subpath);
        if (shim) return shim;
        return resolveExistingFile(path.resolve(vendorRoot, subpath));
      }

      if (!isVendorImporter(importer)) {
        return null;
      }

      const normalizedImporter = normalizePath(importer || "");

      if (source === "./client" && normalizedImporter.includes("/services/api/")) {
        return shimPath("services/api/client");
      }

      if (source === "./useAuthStore" && normalizedImporter.includes("/stores/")) {
        return shimPath("stores/useAuthStore");
      }

      return null;
    }
  };
}