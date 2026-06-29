use crate::settings::{
    load_desktop_settings, save_desktop_settings, DesktopSettings, QuotaAlertThresholds,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

use crate::supervisor::SupervisorState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettingsPayload {
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub allow_lan_access: bool,
    pub quota_poll_interval_sec: u32,
    pub quota_alert_thresholds: QuotaAlertThresholds,
    pub quota_notifications_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_start_registered: Option<bool>,
}

pub async fn lab_desktop_settings(app: AppHandle) -> Result<DesktopSettingsPayload, String> {
    let settings = load_desktop_settings().unwrap_or_default();
    Ok(to_payload(&app, &settings))
}

pub async fn lab_save_desktop_settings(
    app: AppHandle,
    payload: DesktopSettingsPayload,
    supervisor: Arc<SupervisorState>,
) -> Result<DesktopSettingsPayload, String> {
    let previous = load_desktop_settings().unwrap_or_default();
    let mut settings = previous.clone();
    settings.auto_start = payload.auto_start;
    settings.minimize_to_tray = payload.minimize_to_tray;
    settings.allow_lan_access = payload.allow_lan_access;
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
    sync_autostart(&app, settings.auto_start)?;

    if previous.allow_lan_access != settings.allow_lan_access {
        supervisor.restart().await.map_err(|error| error.to_string())?;
    }

    Ok(to_payload(&app, &settings))
}

fn sync_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager
            .enable()
            .map_err(|error| format!("failed to enable autostart: {error}"))?;
    } else {
        manager
            .disable()
            .map_err(|error| format!("failed to disable autostart: {error}"))?;
    }
    Ok(())
}

fn to_payload(app: &AppHandle, settings: &DesktopSettings) -> DesktopSettingsPayload {
    let auto_start_registered = app.autolaunch().is_enabled().ok();
    DesktopSettingsPayload {
        auto_start: settings.auto_start,
        minimize_to_tray: settings.minimize_to_tray,
        allow_lan_access: settings.allow_lan_access,
        quota_poll_interval_sec: settings.quota_poll_interval_sec,
        quota_alert_thresholds: settings.quota_alert_thresholds.clone(),
        quota_notifications_enabled: settings.quota_notifications_enabled,
        auto_start_registered,
    }
}

pub fn apply_saved_autostart(app: &AppHandle) -> Result<(), String> {
    let settings = load_desktop_settings().unwrap_or_default();
    sync_autostart(app, settings.auto_start)
}