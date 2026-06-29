use crate::commands::mgmt::{forward_management_request, ManagementRequest};
use crate::quota_parse::{
    classify_used_percent, dedupe_key, is_disabled_auth_file, parse_provider_windows,
    provider_from_auth_file, resolve_antigravity_project_id, resolve_auth_index, QuotaWindowSummary,
};
use crate::settings::{load_desktop_settings, save_desktop_settings, DesktopSettings};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex;

const MAX_CONCURRENT: usize = 10;
const DEDUPE_WINDOW_MS: i64 = 4 * 60 * 60 * 1000;

const CLAUDE_USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
const CODEX_USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";
const KIMI_USAGE_URL: &str = "https://api.kimi.com/coding/v1/usages";
const XAI_BILLING_URL: &str = "https://cli-chat-proxy.grok.com/v1/billing";
const ANTIGRAVITY_QUOTA_URLS: [&str; 3] = [
    "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
    "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary",
    "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
];

#[derive(Debug, Clone)]
pub struct QuotaAlert {
    pub provider: String,
    pub account_name: String,
    pub window_label: String,
    pub used_percent: f64,
    pub level: String,
}

pub struct QuotaPollerState {
    app: AppHandle,
    dedup: Mutex<HashMap<String, String>>,
}

impl QuotaPollerState {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            dedup: Mutex::new(HashMap::new()),
        }
    }

    pub fn start(self: Arc<Self>) {
        tauri::async_runtime::spawn(async move {
            loop {
                let sleep_secs = load_desktop_settings()
                    .map(|settings| settings.quota_poll_interval_sec.clamp(30, 300))
                    .unwrap_or(60);
                if let Err(error) = self.poll_once().await {
                    eprintln!("quota poller tick failed: {error}");
                }
                tokio::time::sleep(Duration::from_secs(sleep_secs as u64)).await;
            }
        });
    }

    async fn poll_once(&self) -> Result<(), String> {
        let settings = load_desktop_settings().unwrap_or_default();
        if !settings.quota_notifications_enabled {
            return Ok(());
        }

        {
            let mut dedup = self.dedup.lock().await;
            *dedup = settings.quota_alert_dedup.clone();
        }

        let alerts = collect_alerts(&settings).await?;
        let now_ms = current_epoch_ms();
        let mut fresh = Vec::new();
        let mut dedup = self.dedup.lock().await;

        for alert in alerts {
            let key = dedupe_key(&alert.account_name, &alert.window_label, &alert.level);
            if let Some(previous) = dedup.get(&key) {
                if let Ok(previous_ms) = previous.parse::<i64>() {
                    if now_ms - previous_ms < DEDUPE_WINDOW_MS {
                        continue;
                    }
                }
            }
            dedup.insert(key, now_ms.to_string());
            fresh.push(alert);
        }

        if !fresh.is_empty() {
            let mut next_settings = settings;
            next_settings.quota_alert_dedup = dedup.clone();
            let _ = save_desktop_settings(&next_settings);
            for alert in fresh {
                self.send_notification(&alert)?;
            }
        }

        Ok(())
    }

    fn send_notification(&self, alert: &QuotaAlert) -> Result<(), String> {
        let title = match alert.level.as_str() {
            "exhausted" => format!("{} quota exhausted", capitalize(&alert.provider)),
            "critical" => format!("{} quota critical", capitalize(&alert.provider)),
            _ => format!("{} quota warning", capitalize(&alert.provider)),
        };
        let body = format!(
            "{} — {} at {:.0}%",
            alert.account_name, alert.window_label, alert.used_percent
        );

        self.app
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|error| error.to_string())
    }
}

fn capitalize(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn current_epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

async fn collect_alerts(settings: &DesktopSettings) -> Result<Vec<QuotaAlert>, String> {
    let auth_files = list_auth_files().await?;
    let warn = settings.quota_alert_thresholds.warn;
    let critical = settings.quota_alert_thresholds.critical;
    let semaphore = Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT));
    let mut join_set = tokio::task::JoinSet::new();

    for file in auth_files {
        if is_disabled_auth_file(&file) {
            continue;
        }
        let Some(provider) = provider_from_auth_file(&file) else {
            continue;
        };
        let account_name = file
            .get("name")
            .and_then(|value| value.as_str())
            .unwrap_or("unknown")
            .to_string();
        let permit = semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|error| error.to_string())?;
        join_set.spawn(async move {
            let _permit = permit;
            let body = match fetch_provider_body(provider, &file).await {
                Ok(body) => body,
                Err(_) => return Vec::new(),
            };
            let windows = parse_provider_windows(provider, &body);
            build_alerts(provider, &account_name, &windows, warn, critical)
        });
    }

    let mut alerts = Vec::new();
    while let Some(result) = join_set.join_next().await {
        match result {
            Ok(batch) => alerts.extend(batch),
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(alerts)
}

fn build_alerts(
    provider: &str,
    account_name: &str,
    windows: &[QuotaWindowSummary],
    warn: u8,
    critical: u8,
) -> Vec<QuotaAlert> {
    let mut alerts = Vec::new();
    for window in windows {
        let Some(used_percent) = window.used_percent else {
            continue;
        };
        let Some(level) = classify_used_percent(used_percent, warn, critical) else {
            continue;
        };
        alerts.push(QuotaAlert {
            provider: provider.to_string(),
            account_name: account_name.to_string(),
            window_label: window.label.clone(),
            used_percent,
            level: level.to_string(),
        });
    }
    alerts
}

async fn list_auth_files() -> Result<Vec<Value>, String> {
    let response = forward_management_request(ManagementRequest {
        method: "GET".to_string(),
        path: "/v0/management/auth-files".to_string(),
        body: None,
        form: None,
    })
    .await
    .map_err(|error| error.to_string())?;

    if response.status < 200 || response.status >= 300 {
        return Err(format!("auth-files request failed: HTTP {}", response.status));
    }

    Ok(normalize_auth_files(response.body))
}

fn normalize_auth_files(payload: Value) -> Vec<Value> {
    if let Some(array) = payload.as_array() {
        return array.clone();
    }
    if let Some(object) = payload.as_object() {
        for key in ["data", "files", "auth_files", "authFiles"] {
            if let Some(array) = object.get(key).and_then(|value| value.as_array()) {
                return array.clone();
            }
        }
    }
    Vec::new()
}

async fn fetch_provider_body(provider: &str, file: &Value) -> Result<Value, String> {
    let auth_index = resolve_auth_index(file).ok_or_else(|| "missing auth index".to_string())?;

    match provider {
        "claude" => {
            api_call_get(&auth_index, CLAUDE_USAGE_URL, claude_headers()).await
        }
        "codex" => api_call_get(&auth_index, CODEX_USAGE_URL, codex_headers()).await,
        "kimi" => api_call_get(&auth_index, KIMI_USAGE_URL, kimi_headers()).await,
        "xai" => api_call_get(&auth_index, XAI_BILLING_URL, xai_headers()).await,
        "antigravity" => {
            let project_id = resolve_antigravity_project_id(file)
                .ok_or_else(|| "missing antigravity project id".to_string())?;
            let body = json!({ "project": project_id });
            for url in ANTIGRAVITY_QUOTA_URLS {
                match api_call_post(&auth_index, url, antigravity_headers(), body.clone()).await {
                    Ok(response) => return Ok(response),
                    Err(_) => continue,
                }
            }
            Err("antigravity quota fetch failed".to_string())
        }
        _ => Err("unsupported provider".to_string()),
    }
}

async fn api_call_get(auth_index: &str, url: &str, header: Value) -> Result<Value, String> {
    api_call(auth_index, "GET", url, header, Value::String(String::new())).await
}

async fn api_call_post(
    auth_index: &str,
    url: &str,
    header: Value,
    data: Value,
) -> Result<Value, String> {
    api_call(
        auth_index,
        "POST",
        url,
        header,
        Value::String(data.to_string()),
    )
    .await
}

async fn api_call(
    auth_index: &str,
    method: &str,
    url: &str,
    header: Value,
    data: Value,
) -> Result<Value, String> {
    let response = forward_management_request(ManagementRequest {
        method: "POST".to_string(),
        path: "/v0/management/api-call".to_string(),
        body: Some(json!({
            "auth_index": auth_index,
            "method": method,
            "url": url,
            "header": header,
            "data": match data {
                Value::String(text) => text,
                other => other.to_string(),
            }
        })),
        form: None,
    })
    .await
    .map_err(|error| error.to_string())?;

    if response.status < 200 || response.status >= 300 {
        return Err(format!("api-call failed: HTTP {}", response.status));
    }

    let status_code = response
        .body
        .get("status_code")
        .or_else(|| response.body.get("statusCode"))
        .and_then(|value| value.as_u64())
        .unwrap_or(0) as u16;
    if status_code < 200 || status_code >= 300 {
        return Err(format!("provider request failed: HTTP {status_code}"));
    }

    Ok(response
        .body
        .get("body")
        .or_else(|| response.body.get("body_text"))
        .or_else(|| response.body.get("bodyText"))
        .cloned()
        .unwrap_or(Value::Null))
}

fn claude_headers() -> Value {
    json!({
        "Authorization": "Bearer $TOKEN$",
        "Content-Type": "application/json",
        "anthropic-beta": "oauth-2025-04-20"
    })
}

fn codex_headers() -> Value {
    json!({
        "Authorization": "Bearer $TOKEN$",
        "Content-Type": "application/json",
        "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal"
    })
}

fn kimi_headers() -> Value {
    json!({ "Authorization": "Bearer $TOKEN$" })
}

fn xai_headers() -> Value {
    json!({ "Authorization": "Bearer $TOKEN$" })
}

fn antigravity_headers() -> Value {
    json!({
        "Authorization": "Bearer $TOKEN$",
        "Content-Type": "application/json",
        "User-Agent": "antigravity/cli/1.0.8 darwin/arm64"
    })
}