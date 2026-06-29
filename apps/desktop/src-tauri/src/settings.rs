use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

const AUTH_DIR_NAME: &str = ".cli-proxy-api";
const SETTINGS_FILE_NAME: &str = "droidproxy-commandcode-lab-settings.json";

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("settings file not found at {0}")]
    NotFound(String),
    #[error("failed to read settings: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid settings json: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("management secret key missing or too short")]
    MissingKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaAlertThresholds {
    #[serde(default = "default_warn_threshold")]
    pub warn: u8,
    #[serde(default = "default_critical_threshold")]
    pub critical: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,
    #[serde(default)]
    pub allow_lan_access: bool,
    #[serde(default = "default_poll_interval")]
    pub quota_poll_interval_sec: u32,
    #[serde(default)]
    pub quota_alert_thresholds: QuotaAlertThresholds,
    #[serde(default = "default_true")]
    pub quota_notifications_enabled: bool,
    #[serde(default)]
    pub quota_alert_dedup: HashMap<String, String>,
}

fn default_warn_threshold() -> u8 {
    80
}

fn default_critical_threshold() -> u8 {
    95
}

fn default_poll_interval() -> u32 {
    60
}

fn default_true() -> bool {
    true
}

impl Default for QuotaAlertThresholds {
    fn default() -> Self {
        Self {
            warn: default_warn_threshold(),
            critical: default_critical_threshold(),
        }
    }
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            minimize_to_tray: default_true(),
            allow_lan_access: false,
            quota_poll_interval_sec: default_poll_interval(),
            quota_alert_thresholds: QuotaAlertThresholds::default(),
            quota_notifications_enabled: default_true(),
            quota_alert_dedup: HashMap::new(),
        }
    }
}

pub fn proxy_bind_host(allow_lan_access: bool) -> &'static str {
    if allow_lan_access {
        "0.0.0.0"
    } else {
        "127.0.0.1"
    }
}

pub fn settings_path() -> PathBuf {
    let home = dirs::home_dir().expect("home directory");
    home.join(AUTH_DIR_NAME).join(SETTINGS_FILE_NAME)
}

fn read_settings_value() -> Result<Value, SettingsError> {
    let path = settings_path();
    if !path.exists() {
        return Err(SettingsError::NotFound(path.display().to_string()));
    }
    let raw = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn load_management_secret_key() -> Result<String, SettingsError> {
    let value = read_settings_value()?;
    let key = value
        .get("managementSecretKey")
        .and_then(|entry| entry.as_str())
        .unwrap_or("");

    if key.len() < 24 {
        return Err(SettingsError::MissingKey);
    }

    Ok(key.to_string())
}

pub fn load_desktop_settings() -> Result<DesktopSettings, SettingsError> {
    let value = read_settings_value()?;
    Ok(desktop_settings_from_value(&value))
}

pub fn save_desktop_settings(settings: &DesktopSettings) -> Result<(), SettingsError> {
    let mut value = read_settings_value().unwrap_or_else(|_| Value::Object(Default::default()));
    let object = value.as_object_mut().ok_or_else(|| {
        SettingsError::Parse(serde_json::Error::io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "settings root must be an object",
        )))
    })?;

    object.insert("autoStart".to_string(), Value::Bool(settings.auto_start));
    object.insert(
        "minimizeToTray".to_string(),
        Value::Bool(settings.minimize_to_tray),
    );
    object.insert(
        "allowLanAccess".to_string(),
        Value::Bool(settings.allow_lan_access),
    );
    object.insert(
        "quotaPollIntervalSec".to_string(),
        json_number(settings.quota_poll_interval_sec),
    );
    object.insert(
        "quotaAlertThresholds".to_string(),
        serde_json::to_value(&settings.quota_alert_thresholds)?,
    );
    object.insert(
        "quotaNotificationsEnabled".to_string(),
        Value::Bool(settings.quota_notifications_enabled),
    );
    object.insert(
        "quotaAlertDedup".to_string(),
        serde_json::to_value(&settings.quota_alert_dedup)?,
    );

    let serialized = serde_json::to_string_pretty(&value)?;
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serialized)?;
    Ok(())
}

fn desktop_settings_from_value(value: &Value) -> DesktopSettings {
    let mut settings = DesktopSettings::default();
    if let Some(enabled) = value.get("autoStart").and_then(|v| v.as_bool()) {
        settings.auto_start = enabled;
    }
    if let Some(enabled) = value.get("minimizeToTray").and_then(|v| v.as_bool()) {
        settings.minimize_to_tray = enabled;
    }
    if let Some(enabled) = value.get("allowLanAccess").and_then(|v| v.as_bool()) {
        settings.allow_lan_access = enabled;
    }
    if let Some(interval) = value.get("quotaPollIntervalSec").and_then(|v| v.as_u64()) {
        settings.quota_poll_interval_sec = interval.clamp(30, 300) as u32;
    }
    if let Some(thresholds) = value.get("quotaAlertThresholds") {
        if let Ok(parsed) = serde_json::from_value::<QuotaAlertThresholds>(thresholds.clone()) {
            settings.quota_alert_thresholds = parsed;
        }
    }
    if let Some(enabled) = value.get("quotaNotificationsEnabled").and_then(|v| v.as_bool()) {
        settings.quota_notifications_enabled = enabled;
    }
    if let Some(dedup) = value.get("quotaAlertDedup") {
        if let Ok(parsed) = serde_json::from_value::<HashMap<String, String>>(dedup.clone()) {
            settings.quota_alert_dedup = parsed;
        }
    }
    settings
}

fn json_number(value: u32) -> Value {
    Value::Number(value.into())
}

pub fn mask_secret_key(key: &str) -> String {
    if key.len() <= 8 {
        return "*".repeat(key.len());
    }
    format!("{}...{}", &key[..4], &key[key.len() - 4..])
}

#[cfg(test)]
mod tests {
    use super::{desktop_settings_from_value, mask_secret_key, proxy_bind_host};
    use serde_json::json;

    #[test]
    fn masks_long_keys() {
        let masked = mask_secret_key("abcdefghijklmnopqrstuvwxyz");
        assert_eq!(masked, "abcd...wxyz");
    }

    #[test]
    fn parses_desktop_behavior_defaults() {
        let settings = desktop_settings_from_value(&json!({}));
        assert!(!settings.auto_start);
        assert!(settings.minimize_to_tray);
        assert!(!settings.allow_lan_access);
    }

    #[test]
    fn proxy_bind_host_follows_lan_setting() {
        assert_eq!(proxy_bind_host(false), "127.0.0.1");
        assert_eq!(proxy_bind_host(true), "0.0.0.0");
    }
}