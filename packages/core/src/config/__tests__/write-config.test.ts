import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergePreservedYamlBlocks,
  renderConfigFromTemplate
} from "../write-config";
import { renderOpenAICompatibilityYaml } from "../openai-compatible";

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

test("mergePreservedYamlBlocks keeps management-only provider sections", () => {
  const rendered = `port: 8418
host: 127.0.0.1
request-retry: 3
generative-language-api-key: []
`;
  const existing = `port: 9000
host: 0.0.0.0
openai-compatibility:
  - name: Cline
    base-url: http://127.0.0.1:1234/v1
    api-key:
      - cline-key
    models:
      - cline/sonnet
oauth-excluded-models:
  codex:
    - ignored
`;

  const merged = mergePreservedYamlBlocks(rendered, existing);

  assert.match(merged, /port: 8418/);
  assert.doesNotMatch(merged, /port: 9000/);
  assert.match(merged, /openai-compatibility:\n  - name: Cline/);
  assert.match(merged, /oauth-excluded-models:\n  codex:/);
});

test("mergePreservedYamlBlocks can replace managed provider sections", () => {
  const rendered = "port: 8418\n";
  const existing = `port: 9000
openai-compatibility:
  - name: Cline
oauth-excluded-models:
  codex:
    - ignored
`;

  const merged = mergePreservedYamlBlocks(rendered, existing, ["openai-compatibility"]);

  assert.doesNotMatch(merged, /openai-compatibility:/);
  assert.match(merged, /oauth-excluded-models:/);
});

test("renderOpenAICompatibilityYaml renders DroidProxy provider config", () => {
  const yaml = renderOpenAICompatibilityYaml([
    {
      name: "Cline",
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKeyEntries: [{ apiKey: "key" }],
      models: [{ name: "cline/sonnet", alias: "sonnet" }]
    }
  ]);

  assert.match(yaml, /openai-compatibility:/);
  assert.match(yaml, /name: "Cline"/);
  assert.match(yaml, /base-url: "http:\/\/127\.0\.0\.1:1234\/v1"/);
  assert.match(yaml, /api-key: "key"/);
  assert.match(yaml, /name: "cline\/sonnet"/);
});
