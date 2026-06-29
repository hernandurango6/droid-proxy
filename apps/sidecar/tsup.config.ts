import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  clean: true,
  sourcemap: true,
  target: "node18",
  platform: "node",
  bundle: true,
  noExternal: [/@droidproxy\//],
  esbuildOptions(options) {
    options.conditions = ["require", "node"];
  }
});