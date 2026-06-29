import assert from "node:assert/strict";
import { test } from "node:test";
import path from "path";
import { generateSecretKey, loadSettings, saveSettings, type AppSettings } from "../settings";

test("generateSecretKey returns base64url secret with sufficient length", () => {
  const key = generateSecretKey();
  assert.ok(key.length >= 24);
  assert.match(key, /^[A-Za-z0-9_-]+$/);
});

test("loadSettings regenerates invalid settings files", () => {
  const authDir = path.join("tmp-test-auth");
  const settingsPath = path.join(authDir, "settings.json");
  const writes: AppSettings[] = [];

  const settings = loadSettings({
    authDir,
    settingsPath,
    io: {
      ensureAuthDir() {},
      readSettingsFile() {
        return { managementSecretKey: "short" };
      },
      writeSettingsFile(_path, value) {
        writes.push(value);
      }
    }
  });

  assert.equal(writes.length, 1);
  assert.ok(settings.managementSecretKey.length >= 24);
  assert.deepEqual(settings.commandCodeApiKeys, []);
});

test("loadSettings normalizes commandCodeApiKeys arrays", () => {
  const settings = loadSettings({
    settingsPath: "ignored.json",
    authDir: "ignored",
    io: {
      ensureAuthDir() {},
      readSettingsFile() {
        return {
          managementSecretKey: "x".repeat(32),
          commandCodeApiKeys: ["key_a", "key_b"]
        };
      },
      writeSettingsFile() {}
    }
  });

  assert.deepEqual(settings.commandCodeApiKeys, ["key_a", "key_b"]);
});

test("saveSettings writes provided settings object", () => {
  let written: AppSettings | null = null;
  saveSettings(
    {
      managementSecretKey: "x".repeat(32),
      commandCodeApiKeys: ["k1"]
    },
    {
      authDir: "auth",
      settingsPath: "auth/settings.json",
      io: {
        ensureAuthDir(dir) {
          assert.equal(dir, "auth");
        },
        readSettingsFile() {
          return {};
        },
        writeSettingsFile(filePath, value) {
          assert.equal(filePath, "auth/settings.json");
          written = value;
        }
      }
    }
  );

  assert.deepEqual(written?.commandCodeApiKeys, ["k1"]);
});