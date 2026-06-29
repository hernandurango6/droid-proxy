import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { resolveSidecarRootDir } from "../paths";

test("resolveSidecarRootDir walks up to repo root from sidecar src", () => {
  const root = resolveSidecarRootDir(path.join(process.cwd(), "apps", "sidecar", "src"));
  const binaryPath = path.join(root, "resources", "bin", "cli-proxy-api.exe");
  assert.ok(fs.existsSync(binaryPath), `expected backend binary at ${binaryPath}`);
});