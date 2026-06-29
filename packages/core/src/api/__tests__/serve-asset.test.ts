import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resolveDashboardAssetPath } from "../serve-asset";

test("resolveDashboardAssetPath maps root to index.html", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "droidproxy-dashboard-"));
  const indexPath = path.join(dir, "index.html");
  fs.writeFileSync(indexPath, "<html>ok</html>");

  assert.equal(resolveDashboardAssetPath(dir, "/"), indexPath);
});

test("resolveDashboardAssetPath blocks path traversal", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "droidproxy-dashboard-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html>ok</html>");

  assert.equal(resolveDashboardAssetPath(dir, "/../secret.txt"), null);
});