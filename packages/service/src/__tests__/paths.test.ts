import assert from "node:assert/strict";
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