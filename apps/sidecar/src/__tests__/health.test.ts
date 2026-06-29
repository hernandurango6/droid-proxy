import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { SidecarOrchestrator } from "../orchestrator";

test("getHealthPayload reports degraded before servers start", () => {
  const orchestrator = new SidecarOrchestrator({
    rootDir: process.cwd(),
    moduleDirname: path.join(process.cwd(), "apps", "sidecar", "src")
  });

  const health = orchestrator.getHealthPayload();
  assert.equal(health.status, "degraded");
  assert.equal(health.control.running, false);
  assert.equal(health.proxy.running, false);
  assert.equal(health.backend.running, false);
  assert.equal(health.control.url, "http://127.0.0.1:8420");
});