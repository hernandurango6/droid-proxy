use crate::settings::load_management_secret_key;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const MANAGEMENT_WINDOW_LABEL: &str = "management";
const MANAGEMENT_URL: &str = "http://127.0.0.1:8418/management.html#/quota";
const API_BASE: &str = "http://127.0.0.1:8418";

pub fn open_management_webview(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MANAGEMENT_WINDOW_LABEL) {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let secret_key = load_management_secret_key().map_err(|error| error.to_string())?;
    let init_script = build_auth_init_script(&secret_key);
    let url = MANAGEMENT_URL
        .parse()
        .map_err(|error| format!("invalid management URL: {error}"))?;

    WebviewWindowBuilder::new(app, MANAGEMENT_WINDOW_LABEL, WebviewUrl::External(url))
        .title("Management Center")
        .inner_size(1120.0, 820.0)
        .initialization_script(&init_script)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn build_auth_init_script(secret_key: &str) -> String {
    let key_json =
        serde_json::to_string(secret_key).unwrap_or_else(|_| "\"\"".to_string());
    let api_base_json =
        serde_json::to_string(API_BASE).unwrap_or_else(|_| "\"\"".to_string());

    format!(
        r#"
(function() {{
  const managementKey = {key_json};
  const apiBase = {api_base_json};
  const ENC_PREFIX = "enc::v1::";
  const SECRET_SALT = "cli-proxy-api-webui::secure-storage";
  const STORAGE_KEY_AUTH = "cli-proxy-auth";

  function encodeText(text) {{
    return new TextEncoder().encode(text);
  }}

  function decodeText(bytes) {{
    return new TextDecoder().decode(bytes);
  }}

  function getKeyBytes() {{
    try {{
      const host = window.location.host;
      const ua = navigator.userAgent;
      return encodeText(`${{SECRET_SALT}}|${{host}}|${{ua}}`);
    }} catch (_) {{
      return encodeText(SECRET_SALT);
    }}
  }}

  function xorBytes(data, keyBytes) {{
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) {{
      result[i] = data[i] ^ keyBytes[i % keyBytes.length];
    }}
    return result;
  }}

  function toBase64(bytes) {{
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {{
      binary += String.fromCharCode(bytes[i]);
    }}
    return btoa(binary);
  }}

  function obfuscateData(value) {{
    const keyBytes = getKeyBytes();
    const encrypted = xorBytes(encodeText(value), keyBytes);
    return `${{ENC_PREFIX}}${{toBase64(encrypted)}}`;
  }}

  const persisted = {{
    state: {{
      apiBase,
      managementKey,
      rememberPassword: true,
      serverVersion: null,
      serverBuildDate: null,
      serverRuntimeKind: "unknown"
    }},
    version: 0
  }};

  localStorage.setItem(STORAGE_KEY_AUTH, obfuscateData(JSON.stringify(persisted)));
  localStorage.setItem("isLoggedIn", "true");
}})();
"#
    )
}

#[cfg(test)]
mod tests {
    use super::build_auth_init_script;

    #[test]
    fn init_script_embeds_management_key_and_storage_key() {
        let script = build_auth_init_script("abcdefghijklmnopqrstuvwxyz012345");
        assert!(script.contains("cli-proxy-auth"));
        assert!(script.contains("abcdefghijklmnopqrstuvwxyz012345"));
        assert!(script.contains("enc::v1::"));
    }
}