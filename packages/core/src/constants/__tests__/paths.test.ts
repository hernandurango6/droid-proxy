import assert from "node:assert/strict";
import { test } from "node:test";
import path from "path";
import {
  CONFIG_FILE_NAME,
  SETTINGS_FILE_NAME,
  getAuthDir,
  getCliBinaryPath,
  getConfigPath,
  getDashboardDir,
  getSettingsPath,
  resolveRepoRootFromSrcDir
} from "../paths";

test("resolveRepoRootFromSrcDir walks up from src/ to repo root", () => {
  const root = resolveRepoRootFromSrcDir(path.join("repo", "src"));
  assert.equal(root, path.resolve("repo"));
});

test("auth paths use lab-specific filenames", () => {
  assert.match(getAuthDir(), /\.cli-proxy-api$/);
  assert.equal(getConfigPath(), path.join(getAuthDir(), CONFIG_FILE_NAME));
  assert.equal(getSettingsPath(), path.join(getAuthDir(), SETTINGS_FILE_NAME));
});

test("cli binary path resolves under resources/bin", () => {
  const root = path.resolve("repo");
  assert.equal(
    getCliBinaryPath(root),
    path.join(root, "resources", "bin", "cli-proxy-api.exe")
  );
});

test("dashboard dir resolves under repo root", () => {
  const root = path.resolve("repo");
  assert.equal(getDashboardDir(root), path.join(root, "dashboard"));
});