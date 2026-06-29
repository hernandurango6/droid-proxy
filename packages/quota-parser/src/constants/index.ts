export const ANTIGRAVITY_QUOTA_URLS = [
  "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
  "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary",
  "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary"
] as const;

export const ANTIGRAVITY_REQUEST_HEADERS = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "User-Agent": "antigravity/cli/1.0.8 darwin/arm64"
} as const;

export const CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";

export const CLAUDE_REQUEST_HEADERS = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "anthropic-beta": "oauth-2025-04-20"
} as const;

export const CLAUDE_USAGE_WINDOW_KEYS = [
  { key: "five_hour", id: "five-hour", label: "Five-hour window" },
  { key: "seven_day", id: "seven-day", label: "Seven-day window" },
  {
    key: "seven_day_oauth_apps",
    id: "seven-day-oauth-apps",
    label: "Seven-day OAuth apps window"
  },
  { key: "seven_day_opus", id: "seven-day-opus", label: "Seven-day Opus window" },
  { key: "seven_day_sonnet", id: "seven-day-sonnet", label: "Seven-day Sonnet window" },
  { key: "seven_day_cowork", id: "seven-day-cowork", label: "Seven-day Cowork window" },
  { key: "iguana_necktie", id: "iguana-necktie", label: "Iguana necktie window" }
] as const;

export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

export const CODEX_REQUEST_HEADERS = {
  Authorization: "Bearer $TOKEN$",
  "Content-Type": "application/json",
  "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal"
} as const;

export const KIMI_USAGE_URL = "https://api.kimi.com/coding/v1/usages";

export const KIMI_REQUEST_HEADERS = {
  Authorization: "Bearer $TOKEN$"
} as const;

export const XAI_BILLING_URL = "https://cli-chat-proxy.grok.com/v1/billing";

export const XAI_REQUEST_HEADERS = {
  Authorization: "Bearer $TOKEN$"
} as const;