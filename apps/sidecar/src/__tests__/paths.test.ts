import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { resolveSidecarRootDir } from "../paths";

test("resolveSidecarRootDir walks up to repo root from sidecar src", () => {
  const root = resolveSidecarRootDir(path.join(process.cwd(), "apps", "sidecar", "src"));
  assert.equal(path.basename(root), "droidproxy-commandcode-lab");
});