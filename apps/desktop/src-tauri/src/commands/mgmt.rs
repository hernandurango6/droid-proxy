use crate::settings::{load_management_secret_key, SettingsError};
use regex::Regex;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::LazyLock;

const BACKEND_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 8418;

static PATH_ALLOWLIST: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^/v0/management(/|$)").expect("valid management path regex"));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagementRequest {
    pub method: String,
    pub path: String,
    #[serde(default)]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManagementResponse {
    pub status: u16,
    pub body: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForbiddenResponse {
    pub error: &'static str,
    pub status: u16,
}

pub fn validate_management_path(path: &str) -> Result<(), ForbiddenResponse> {
    if !PATH_ALLOWLIST.is_match(path) {
        return Err(ForbiddenResponse {
            error: "forbidden_path",
            status: 403,
        });
    }
    Ok(())
}

pub fn parse_management_method(method: &str) -> Result<Method, ForbiddenResponse> {
    match method.to_uppercase().as_str() {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "PATCH" => Ok(Method::PATCH),
        "DELETE" => Ok(Method::DELETE),
        _ => Err(ForbiddenResponse {
            error: "forbidden_path",
            status: 403,
        }),
    }
}

pub async fn forward_management_request(req: ManagementRequest) -> Result<ManagementResponse, Value> {
    validate_management_path(&req.path).map_err(|forbidden| {
        serde_json::to_value(forbidden).unwrap_or_else(|_| {
            serde_json::json!({ "error": "forbidden_path", "status": 403 })
        })
    })?;

    let method = parse_management_method(&req.method).map_err(|forbidden| {
        serde_json::to_value(forbidden).unwrap_or_else(|_| {
            serde_json::json!({ "error": "forbidden_path", "status": 403 })
        })
    })?;

    let secret_key = load_management_secret_key().map_err(map_settings_error)?;

    let url = format!("http://{BACKEND_HOST}:{BACKEND_PORT}{}", req.path);
    let client = reqwest::Client::new();
    let mut builder = client
        .request(method, &url)
        .header("Authorization", format!("Bearer {secret_key}"))
        .header("Accept", "application/json");

    if let Some(body) = req.body {
        builder = builder.json(&body);
    }

    let response = builder.send().await.map_err(|error| {
        serde_json::json!({
            "error": "management_request_failed",
            "message": error.to_string()
        })
    })?;

    let status = response.status().as_u16();
    let body = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| Value::Null);

    Ok(ManagementResponse {
        status,
        body,
        error: None,
    })
}

fn map_settings_error(error: SettingsError) -> Value {
    serde_json::json!({
        "error": "management_key_unavailable",
        "message": error.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::{parse_management_method, validate_management_path};

    #[test]
    fn allows_management_paths() {
        assert!(validate_management_path("/v0/management").is_ok());
        assert!(validate_management_path("/v0/management/version").is_ok());
    }

    #[test]
    fn rejects_non_management_paths() {
        let err = validate_management_path("/v1/chat/completions").unwrap_err();
        assert_eq!(err.error, "forbidden_path");
        assert_eq!(err.status, 403);

        let err = validate_management_path("/management.html").unwrap_err();
        assert_eq!(err.status, 403);
    }

    #[test]
    fn rejects_invalid_methods() {
        let err = parse_management_method("OPTIONS").unwrap_err();
        assert_eq!(err.status, 403);
    }
}