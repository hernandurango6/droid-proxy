import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandCodeApiKeyRotator, resolveCommandCodeApiKeyEntries } from "../api-keys";

test("resolveCommandCodeApiKeyEntries reads env and saved keys with deduplication", () => {
  const entries = resolveCommandCodeApiKeyEntries({
    env: {
      DROIDPROXY_COMMANDCODE_API_KEY: "env-key",
      COMMANDCODE_API_KEYS: "env-key,other-key"
    },
    savedKeys: ["saved-key", "other-key"],
    authPath: "Z:\\missing-auth.json"
  });

  assert.deepEqual(entries.map((entry) => entry.apiKey), ["env-key", "other-key", "saved-key"]);
  assert.equal(entries[0].source, "Environment");
  assert.equal(entries[2].source, "Dashboard");
});

test("CommandCodeApiKeyRotator cycles through keys", () => {
  const rotator = new CommandCodeApiKeyRotator();
  const keys = ["a", "b", "c"];

  assert.deepEqual(rotator.next(keys), { apiKey: "a", index: 0 });
  assert.deepEqual(rotator.next(keys), { apiKey: "b", index: 1 });
  assert.deepEqual(rotator.next(keys), { apiKey: "c", index: 2 });
  assert.deepEqual(rotator.next(keys), { apiKey: "a", index: 0 });

  rotator.reset();
  assert.deepEqual(rotator.next(keys), { apiKey: "a", index: 0 });
});