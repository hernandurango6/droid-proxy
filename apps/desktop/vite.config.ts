import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineConfig } from "vite";
import { managementUiResolver } from "./vite.management-ui";

const host = process.env.TAURI_DEV_HOST;
const desktopRoot = __dirname;
const vendorRoot = path.resolve(desktopRoot, "vendor/management-center/src");

function resolveVendorScssFile(importPath: string): string | undefined {
  const basePath = path.resolve(vendorRoot, importPath);
  const candidates = [basePath, `${basePath}.scss`, `${basePath}.sass`];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), managementUiResolver(desktopRoot)],
  resolve: {
    alias: []
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        additionalData: `@use "${path.resolve(vendorRoot, "styles/variables.scss").replace(/\\/g, "/")}" as *;\n`,
        importers: [
          {
            canonicalize(url: string) {
              if (!url.startsWith("@/")) return null;
              const resolved = resolveVendorScssFile(url.slice(2));
              return resolved ? pathToFileURL(resolved) : null;
            },
            load(canonicalUrl: URL) {
              const filePath = fileURLToPath(canonicalUrl);
              const contents = fs.readFileSync(filePath, "utf8");
              return {
                contents,
                syntax: filePath.endsWith(".sass") ? "indented" : "scss"
              };
            }
          }
        ]
      }
    }
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.{test,spec}.{ts,tsx}"]
  }
});