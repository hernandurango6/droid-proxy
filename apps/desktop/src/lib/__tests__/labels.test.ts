import { describe, expect, it } from "vitest";
import { LOGIN_PROVIDERS, providerLabel } from "../labels";

describe("providerLabel", () => {
  it("formats xAI and default providers", () => {
    expect(providerLabel("xai")).toBe("xAI");
    expect(providerLabel("claude")).toBe("Claude");
  });

  it("exposes the dashboard provider list", () => {
    expect(LOGIN_PROVIDERS).toEqual([
      "claude",
      "codex",
      "gemini",
      "antigravity",
      "kimi",
      "xai"
    ]);
  });
});