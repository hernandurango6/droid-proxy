use serde_json::Value;
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

pub fn settings_path() -> PathBuf {
    let home = dirs::home_dir().expect("home directory");
    home.join(AUTH_DIR_NAME).join(SETTINGS_FILE_NAME)
}

pub fn load_management_secret_key() -> Result<String, SettingsError> {
    let path = settings_path();
    if !path.exists() {
        return Err(SettingsError::NotFound(path.display().to_string()));
    }

    let raw = fs::read_to_string(&path)?;
    let value: Value = serde_json::from_str(&raw)?;
    let key = value
        .get("managementSecretKey")
        .and_then(|entry| entry.as_str())
        .unwrap_or("");

    if key.len() < 24 {
        return Err(SettingsError::MissingKey);
    }

    Ok(key.to_string())
}

pub fn mask_secret_key(key: &str) -> String {
    if key.len() <= 8 {
        return "*".repeat(key.len());
    }
    format!("{}...{}", &key[..4], &key[key.len() - 4..])
}

#[cfg(test)]
mod tests {
    use super::mask_secret_key;

    #[test]
    fn masks_long_keys() {
        let masked = mask_secret_key("abcdefghijklmnopqrstuvwxyz");
        assert_eq!(masked, "abcd...wxyz");
    }
}