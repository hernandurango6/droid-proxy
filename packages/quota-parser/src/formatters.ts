import { normalizeNumberValue } from "./normalize";
import type { CodexUsageWindow } from "./types";

function formatLocaleDateTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatUnixSeconds(value: number | null): string {
  if (!value) return "-";
  return formatLocaleDateTime(new Date(value * 1000));
}

export function formatQuotaResetTime(value?: string): string {
  if (!value) return "-";
  return formatLocaleDateTime(new Date(value));
}

export function formatSubscriptionDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const date =
    typeof value === "number"
      ? new Date(value > 1_000_000_000_000 ? value : value * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function formatCodexResetLabel(window?: CodexUsageWindow | null): string {
  if (!window) return "-";
  const resetAt = normalizeNumberValue(window.reset_at ?? window.resetAt);
  if (resetAt !== null && resetAt > 0) {
    return formatUnixSeconds(resetAt);
  }
  const resetAfter = normalizeNumberValue(window.reset_after_seconds ?? window.resetAfterSeconds);
  if (resetAfter !== null && resetAfter > 0) {
    const targetSeconds = Math.floor(Date.now() / 1000 + resetAfter);
    return formatUnixSeconds(targetSeconds);
  }
  return "-";
}