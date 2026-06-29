pub mod lab;
pub mod mgmt;

use lab::LabOpenPathRequest;
use mgmt::{ManagementRequest, ManagementResponse};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::supervisor::SupervisorState;

#[tauri::command]
pub async fn lab_status() -> Result<Value, String> {
    lab::lab_status().await
}

#[tauri::command]
pub async fn lab_config() -> Result<Value, String> {
    lab::lab_config().await
}

#[tauri::command]
pub async fn lab_accounts() -> Result<Value, String> {
    lab::lab_get("/api/accounts").await
}

#[tauri::command]
pub async fn lab_logs() -> Result<Value, String> {
    lab::lab_get("/api/logs").await
}

#[tauri::command]
pub async fn lab_models() -> Result<Value, String> {
    lab::lab_get("/api/models").await
}

#[tauri::command]
pub async fn lab_factory_models() -> Result<Value, String> {
    lab::lab_get("/api/factory-models").await
}

#[tauri::command]
pub async fn lab_factory_models_selection(ids: Vec<String>) -> Result<Value, String> {
    lab::lab_post("/api/factory-models/selection", Some(serde_json::json!({ "ids": ids }))).await
}

#[tauri::command]
pub async fn lab_commandcode_keys(keys: String) -> Result<Value, String> {
    lab::lab_post("/api/commandcode-keys", Some(serde_json::json!({ "keys": keys }))).await
}

#[tauri::command]
pub async fn lab_apply_factory_models() -> Result<Value, String> {
    lab::lab_post("/api/apply-factory-models", Some(serde_json::json!({}))).await
}

#[tauri::command]
pub async fn lab_login(provider: String) -> Result<Value, String> {
    lab::lab_post("/api/login", Some(serde_json::json!({ "provider": provider }))).await
}

#[tauri::command]
pub async fn lab_open_path(request: LabOpenPathRequest) -> Result<Value, String> {
    lab::lab_open_path(request).await
}

#[tauri::command]
pub async fn mgmt_request(req: ManagementRequest) -> Result<ManagementResponse, Value> {
    mgmt::forward_management_request(req).await
}

#[tauri::command]
pub async fn supervisor_restart(state: State<'_, Arc<SupervisorState>>) -> Result<(), String> {
    state.restart().await
}

#[tauri::command]
pub async fn open_management_webview(app: AppHandle) -> Result<(), String> {
    crate::management_webview::open_management_webview(&app)
}