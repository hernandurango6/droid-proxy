import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKEND_HOST,
  DEFAULT_BACKEND_PORT,
  DEFAULT_CONTROL_PORT,
  DEFAULT_DASHBOARD_PORT,
  DEFAULT_FRONTEND_PORT,
  getManagementUrl,
  getProxyBaseUrl,
  parsePort,
  resolveBackendPort,
  resolveControlPort,
  resolveDashboardPort,
  resolveFrontendHost,
  resolveFrontendPort,
  resolvePublicHost
} from "../ports";

test("parsePort accepts valid ports and rejects invalid values", () => {
  assert.equal(parsePort("8417", 1), 8417);
  assert.equal(parsePort("0", 8417), 8417);
  assert.equal(parsePort("70000", 8417), 8417);
  assert.equal(parsePort(undefined, 8417), 8417);
});

test("default service ports match cli.js", () => {
  assert.equal(DEFAULT_FRONTEND_PORT, 8417);
  assert.equal(DEFAULT_BACKEND_PORT, 8418);
  assert.equal(DEFAULT_DASHBOARD_PORT, 8419);
  assert.equal(DEFAULT_CONTROL_PORT, 8420);
});

test("env resolvers honor DROIDPROXY_* variables", () => {
  const env = {
    DROIDPROXY_HOST: "127.0.0.1",
    DROIDPROXY_PORT: "9001",
    DROIDPROXY_BACKEND_PORT: "9002",
    DROIDPROXY_DASHBOARD_PORT: "9003",
    DROIDPROXY_CONTROL_PORT: "9004",
    DROIDPROXY_PUBLIC_HOST: "192.168.1.10"
  };

  assert.equal(resolveFrontendHost(env), "127.0.0.1");
  assert.equal(resolveFrontendPort(env), 9001);
  assert.equal(resolveBackendPort(env), 9002);
  assert.equal(resolveDashboardPort(env), 9003);
  assert.equal(resolveControlPort(env), 9004);
  assert.equal(resolvePublicHost(env), "192.168.1.10");
});

test("management and proxy URLs use expected hosts", () => {
  assert.equal(getManagementUrl(), `http://${BACKEND_HOST}:${DEFAULT_BACKEND_PORT}/management.html`);
  assert.equal(
    getProxyBaseUrl("127.0.0.1", 8417, "127.0.0.1"),
    "http://127.0.0.1:8417/v1"
  );
});