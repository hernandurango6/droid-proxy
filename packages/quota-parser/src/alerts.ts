import type { QuotaAlert, QuotaAlertLevel, QuotaWindowSummary } from "./types";

export interface QuotaAlertThresholds {
  warn: number;
  critical: number;
}

export const DEFAULT_QUOTA_ALERT_THRESHOLDS: QuotaAlertThresholds = {
  warn: 80,
  critical: 95
};

export function classifyQuotaUsage(
  usedPercent: number,
  thresholds: QuotaAlertThresholds = DEFAULT_QUOTA_ALERT_THRESHOLDS
): QuotaAlertLevel | null {
  if (!Number.isFinite(usedPercent)) return null;
  if (usedPercent >= 100) return "exhausted";
  if (usedPercent >= thresholds.critical) return "critical";
  if (usedPercent >= thresholds.warn) return "warn";
  return null;
}

export function buildQuotaAlerts(params: {
  provider: QuotaAlert["provider"];
  accountName: string;
  windows: QuotaWindowSummary[];
  thresholds?: QuotaAlertThresholds;
  now?: Date;
}): QuotaAlert[] {
  const thresholds = params.thresholds ?? DEFAULT_QUOTA_ALERT_THRESHOLDS;
  const timestamp = (params.now ?? new Date()).toISOString();
  const alerts: QuotaAlert[] = [];

  for (const window of params.windows) {
    if (window.usedPercent === null) continue;
    const level = classifyQuotaUsage(window.usedPercent, thresholds);
    if (!level) continue;
    alerts.push({
      provider: params.provider,
      accountName: params.accountName,
      windowLabel: window.label,
      usedPercent: window.usedPercent,
      level,
      timestamp
    });
  }

  return alerts;
}

export function dedupeQuotaAlerts(
  alerts: QuotaAlert[],
  lastSentAt: Record<string, string>,
  dedupeWindowMs = 4 * 60 * 60 * 1000,
  now = Date.now()
): { alerts: QuotaAlert[]; lastSentAt: Record<string, string> } {
  const nextLastSentAt = { ...lastSentAt };
  const fresh: QuotaAlert[] = [];

  for (const alert of alerts) {
    const key = `${alert.accountName}:${alert.windowLabel}:${alert.level}`;
    const previous = nextLastSentAt[key];
    if (previous) {
      const previousMs = Date.parse(previous);
      if (Number.isFinite(previousMs) && now - previousMs < dedupeWindowMs) {
        continue;
      }
    }
    nextLastSentAt[key] = alert.timestamp;
    fresh.push(alert);
  }

  return { alerts: fresh, lastSentAt: nextLastSentAt };
}