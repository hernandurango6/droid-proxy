import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { test } from "node:test";
import path from "path";
import { resolveCliBinaryPath } from "../paths";

test("resolveCliBinaryPath points to bundled backend binary", () => {
  const root = path.resolve("repo");
  assert.equal(
    resolveCliBinaryPath(root),
    path.join(root, "resources", "bin", "cli-proxy-api.exe")
  );
});

test("resolveCliBinaryPath prefers TAURI_RESOURCE_DIR when present", () => {
  const root = path.resolve("repo");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "droidproxy-resources-"));
  const binDir = path.join(tempDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const binary = path.join(binDir, "cli-proxy-api.exe");
  fs.writeFileSync(binary, "stub");

  const previous = process.env.TAURI_RESOURCE_DIR;
  process.env.TAURI_RESOURCE_DIR = tempDir;
  try {
    assert.equal(resolveCliBinaryPath(root), binary);
  } finally {
    if (previous === undefined) {
      delete process.env.TAURI_RESOURCE_DIR;
    } else {
      process.env.TAURI_RESOURCE_DIR = previous;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});