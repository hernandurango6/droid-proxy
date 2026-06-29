import assert from "node:assert/strict";
import { test } from "node:test";
import { renderConfigFromTemplate } from "../write-config";

const TEMPLATE = `port: __BACKEND_PORT__
secret-key: "__MANAGEMENT_SECRET_KEY__"
debug: __DEBUG__
request-retry: __REQUEST_RETRY__
request-timeout: "__REQUEST_TIMEOUT__"`;

test("renderConfigFromTemplate substitutes all tokens", () => {
  const rendered = renderConfigFromTemplate(TEMPLATE, {
    backendPort: 8418,
    managementSecretKey: "secret-key-value",
    debug: true,
    requestRetry: "5",
    requestTimeout: "15m"
  });

  assert.match(rendered, /port: 8418/);
  assert.match(rendered, /secret-key: "secret-key-value"/);
  assert.match(rendered, /debug: true/);
  assert.match(rendered, /request-retry: 5/);
  assert.match(rendered, /request-timeout: "15m"/);
});