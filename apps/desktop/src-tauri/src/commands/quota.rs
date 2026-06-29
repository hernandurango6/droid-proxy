use crate::settings::{load_desktop_settings, save_desktop_settings, DesktopSettings, QuotaAlertThresholds};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaSettingsPayload {
    pub quota_poll_interval_sec: u32,
    pub quota_alert_thresholds: QuotaAlertThresholds,
    pub quota_notifications_enabled: bool,
}

pub async fn lab_quota_settings() -> Result<QuotaSettingsPayload, String> {
    let settings = load_desktop_settings().unwrap_or_default();
    Ok(to_payload(&settings))
}

pub async fn lab_save_quota_settings(
    payload: QuotaSettingsPayload,
) -> Result<QuotaSettingsPayload, String> {
    let mut settings = load_desktop_settings().unwrap_or_default();
    settings.quota_poll_interval_sec = payload.quota_poll_interval_sec.clamp(30, 300);
    settings.quota_alert_thresholds = QuotaAlertThresholds {
        warn: payload.quota_alert_thresholds.warn.min(99),
        critical: payload
            .quota_alert_thresholds
            .critical
            .max(payload.quota_alert_thresholds.warn.saturating_add(1))
            .min(100),
    };
    settings.quota_notifications_enabled = payload.quota_notifications_enabled;
    save_desktop_settings(&settings).map_err(|error| error.to_string())?;
    Ok(to_payload(&settings))
}

fn to_payload(settings: &DesktopSettings) -> QuotaSettingsPayload {
    QuotaSettingsPayload {
        quota_poll_interval_sec: settings.quota_poll_interval_sec,
        quota_alert_thresholds: settings.quota_alert_thresholds.clone(),
        quota_notifications_enabled: settings.quota_notifications_enabled,
    }
}