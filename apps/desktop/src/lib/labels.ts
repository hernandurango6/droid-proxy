import type { LoginProvider } from "./types";

export const LOGIN_PROVIDERS: LoginProvider[] = [
  "claude",
  "codex",
  "gemini",
  "antigravity",
  "kimi",
  "xai"
];

export function providerLabel(value: LoginProvider | string): string {
  if (value === "xai") return "xAI";
  return value.charAt(0).toUpperCase() + value.slice(1);
}