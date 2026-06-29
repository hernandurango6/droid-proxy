import assert from "node:assert/strict";
import { test } from "node:test";
import { maskApiKey, parseCommandCodeApiKeys } from "../commandcode-keys";

test("parseCommandCodeApiKeys splits delimiters and deduplicates", () => {
  const keys = parseCommandCodeApiKeys("key_a,key_b\nkey_c;key_a");
  assert.deepEqual(keys, ["key_a", "key_b", "key_c"]);
});

test("parseCommandCodeApiKeys accepts JSON arrays", () => {
  assert.deepEqual(parseCommandCodeApiKeys('["k1","k2"]'), ["k1", "k2"]);
});

test("maskApiKey hides middle of long keys", () => {
  assert.equal(maskApiKey("abcdefghijklmnop"), "abcd...mnop");
  assert.equal(maskApiKey("short"), "*****");
});