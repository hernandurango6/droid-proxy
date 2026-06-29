export const LOGIN_FLAGS = {
  claude: "-claude-login",
  codex: "-codex-login",
  "codex-device": "-codex-device-login",
  kimi: "-kimi-login",
  antigravity: "-antigravity-login",
  gemini: "-login",
  xai: "-xai-login"
} as const;

export type LoginProvider = keyof typeof LOGIN_FLAGS;

export const DASHBOARD_LOGIN_PROVIDERS = [
  "claude",
  "codex",
  "gemini",
  "antigravity",
  "kimi",
  "xai"
] as const satisfies readonly LoginProvider[];

export function isLoginProvider(value: string): value is LoginProvider {
  return Object.prototype.hasOwnProperty.call(LOGIN_FLAGS, value);
}

export function getLoginFlag(provider: LoginProvider): string {
  return LOGIN_FLAGS[provider];
}