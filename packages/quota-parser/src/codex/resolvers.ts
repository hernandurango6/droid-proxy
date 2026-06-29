import { normalizeNumberValue, normalizePlanType, normalizeStringValue, parseJsonPayload } from "../normalize";
import type { AuthFileItem } from "../auth-files";

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

function parseIdTokenPayload(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const parts = value.split(".");
    if (parts.length < 2) return null;
    try {
      const payload = Buffer.from(parts[1], "base64url").toString("utf8");
      return parseJsonPayload<Record<string, unknown>>(payload);
    } catch {
      return null;
    }
  }
  return toRecord(value);
}

const resolveCodexAuthInfo = (value: unknown): Record<string, unknown> | null => {
  const payload = parseIdTokenPayload(value);
  if (!payload) return null;
  const nested = toRecord(payload["https://api.openai.com/auth"]);
  return nested ?? payload;
};

export function extractCodexChatgptAccountId(value: unknown): string | null {
  const payload = parseIdTokenPayload(value);
  if (!payload) return null;
  return normalizeStringValue(payload.chatgpt_account_id ?? payload.chatgptAccountId);
}

export function resolveCodexChatgptAccountId(file: AuthFileItem): string | null {
  const metadata = toRecord(file.metadata);
  const attributes = toRecord(file.attributes);
  const candidates = [file.id_token, metadata?.id_token, attributes?.id_token];

  for (const candidate of candidates) {
    const id = extractCodexChatgptAccountId(candidate);
    if (id) return id;
  }

  return null;
}

export function resolveCodexPlanType(file: AuthFileItem): string | null {
  const metadata = toRecord(file.metadata);
  const attributes = toRecord(file.attributes);
  const idToken = toRecord(file.id_token);
  const metadataIdToken = toRecord(metadata?.id_token);
  const candidates = [
    file.plan_type,
    file.planType,
    file.id_token,
    idToken?.plan_type,
    idToken?.planType,
    metadata?.plan_type,
    metadata?.planType,
    metadata?.id_token,
    metadataIdToken?.plan_type,
    metadataIdToken?.planType,
    attributes?.plan_type,
    attributes?.planType,
    attributes?.id_token
  ];

  for (const candidate of candidates) {
    const planType = normalizePlanType(candidate);
    if (planType) return planType;
  }

  return null;
}

function normalizeDateLikeValue(value: unknown): string | number | null {
  const numberValue = normalizeNumberValue(value);
  if (numberValue === 0) return null;
  if (numberValue !== null) return numberValue;

  const stringValue = normalizeStringValue(value);
  if (!stringValue || stringValue === "0") return null;
  return stringValue;
}

export function resolveCodexSubscriptionActiveUntil(file: AuthFileItem): string | number | null {
  const metadata = toRecord(file.metadata);
  const attributes = toRecord(file.attributes);
  const idToken = resolveCodexAuthInfo(file.id_token);
  const metadataIdToken = resolveCodexAuthInfo(metadata?.id_token);
  const attributesIdToken = resolveCodexAuthInfo(attributes?.id_token);
  const subscription = toRecord(file.subscription);
  const metadataSubscription = toRecord(metadata?.subscription);
  const attributesSubscription = toRecord(attributes?.subscription);

  const candidates = [
    file.chatgpt_subscription_active_until,
    file.chatgptSubscriptionActiveUntil,
    file.subscription_active_until,
    file.subscriptionActiveUntil,
    subscription?.active_until,
    subscription?.activeUntil,
    idToken?.chatgpt_subscription_active_until,
    idToken?.chatgptSubscriptionActiveUntil,
    metadata?.chatgpt_subscription_active_until,
    metadata?.chatgptSubscriptionActiveUntil,
    metadata?.subscription_active_until,
    metadata?.subscriptionActiveUntil,
    metadataSubscription?.active_until,
    metadataSubscription?.activeUntil,
    metadataIdToken?.chatgpt_subscription_active_until,
    metadataIdToken?.chatgptSubscriptionActiveUntil,
    attributes?.chatgpt_subscription_active_until,
    attributes?.chatgptSubscriptionActiveUntil,
    attributes?.subscription_active_until,
    attributes?.subscriptionActiveUntil,
    attributesSubscription?.active_until,
    attributesSubscription?.activeUntil,
    attributesIdToken?.chatgpt_subscription_active_until,
    attributesIdToken?.chatgptSubscriptionActiveUntil
  ];

  for (const candidate of candidates) {
    const value = normalizeDateLikeValue(candidate);
    if (value !== null) return value;
  }

  return null;
}

export function buildCodexRequestHeader(file: AuthFileItem): Record<string, string> {
  const header: Record<string, string> = {
    Authorization: "Bearer $TOKEN$",
    "Content-Type": "application/json",
    "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal"
  };
  const accountId = resolveCodexChatgptAccountId(file);
  if (accountId) {
    header["Chatgpt-Account-Id"] = accountId;
  }
  return header;
}