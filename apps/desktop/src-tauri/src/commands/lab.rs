use crate::settings::mask_secret_key;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const CONTROL_HOST: &str = "127.0.0.1";
const CONTROL_PORT: u16 = 8420;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabOpenPathRequest {
    pub target: String,
}

pub async fn lab_get(path: &str) -> Result<Value, String> {
    lab_request(Method::GET, path, None).await
}

pub async fn lab_post(path: &str, body: Option<Value>) -> Result<Value, String> {
    lab_request(Method::POST, path, body).await
}

async fn lab_request(method: Method, path: &str, body: Option<Value>) -> Result<Value, String> {
    let url = format!("http://{CONTROL_HOST}:{CONTROL_PORT}{path}");
    let client = reqwest::Client::new();
    let mut builder = client.request(method, &url);

    if let Some(payload) = body {
        builder = builder.json(&payload);
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("sidecar request failed: {error}"))?;

    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("invalid sidecar response: {error}"))?;

    if !status.is_success() {
        return Err(format!("sidecar returned {status}: {value}"));
    }

    Ok(value)
}

pub async fn lab_status() -> Result<Value, String> {
    let mut status = lab_get("/api/status").await?;
    sanitize_status_payload(&mut status);
    Ok(status)
}

pub async fn lab_config() -> Result<Value, String> {
    let mut config = lab_get("/api/config").await?;
    sanitize_config_payload(&mut config);
    Ok(config)
}

pub async fn lab_open_path(request: LabOpenPathRequest) -> Result<Value, String> {
    let path = match request.target.as_str() {
        "auth" => "/api/open-auth-dir",
        "config" => "/api/open-config",
        "management" => "/api/open-management",
        _ => {
            return Err(format!("invalid open_path target: {}", request.target));
        }
    };
    lab_post(path, Some(json!({}))).await
}

fn sanitize_status_payload(value: &mut Value) {
    if let Some(management) = value.get_mut("management").and_then(|entry| entry.as_object_mut()) {
        let key_configured = management
            .get("secretKey")
            .and_then(|entry| entry.as_str())
            .map(|key| !key.is_empty())
            .unwrap_or(false);
        management.remove("secretKey");
        management.insert("keyConfigured".into(), json!(key_configured));
    }
}

fn sanitize_config_payload(value: &mut Value) {
    if let Some(config) = value.as_object_mut() {
        let key_configured = config
            .get("managementSecretKey")
            .and_then(|entry| entry.as_str())
            .map(|key| key.len() >= 24)
            .unwrap_or(false);

        if let Some(key) = config
            .get("managementSecretKey")
            .and_then(|entry| entry.as_str())
        {
            config.insert(
                "managementKeyMasked".into(),
                json!(mask_secret_key(key)),
            );
        }

        config.remove("managementSecretKey");
        config.insert("managementKeyConfigured".into(), json!(key_configured));
    }
}

#[cfg(test)]
mod tests {
    use super::{sanitize_config_payload, sanitize_status_payload};
    use serde_json::json;

    #[test]
    fn strips_management_secret_from_status() {
        let mut payload = json!({
            "management": { "url": "http://127.0.0.1:8418/management.html", "secretKey": "x".repeat(32) }
        });
        sanitize_status_payload(&mut payload);
        assert_eq!(payload["management"]["keyConfigured"], json!(true));
        assert!(payload["management"].get("secretKey").is_none());
    }

    #[test]
    fn masks_management_secret_in_config() {
        let mut payload = json!({
            "managementSecretKey": "abcdefghijklmnopqrstuvwxyz"
        });
        sanitize_config_payload(&mut payload);
        assert_eq!(payload["managementKeyMasked"], json!("abcd...wxyz"));
        assert_eq!(payload["managementKeyConfigured"], json!(true));
        assert!(payload.get("managementSecretKey").is_none());
    }
}