use serde_json::Value;
#[derive(Debug, Clone, PartialEq)]
pub struct QuotaWindowSummary {
    pub id: String,
    pub label: String,
    pub used_percent: Option<f64>,
}

fn normalize_number(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim().parse().ok(),
        _ => None,
    }
}

fn normalize_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

fn normalize_fraction(value: &Value) -> Option<f64> {
    if let Some(number) = normalize_number(value) {
        return Some(number);
    }
    if let Value::String(text) = value {
        let trimmed = text.trim();
        if trimmed.ends_with('%') {
            return trimmed[..trimmed.len() - 1].trim().parse::<f64>().ok().map(|v| v / 100.0);
        }
    }
    None
}

fn parse_json_body(body: &Value) -> Option<Value> {
    if body.is_null() {
        return None;
    }
    if let Value::String(text) = body {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return None;
        }
        return serde_json::from_str(trimmed).ok();
    }
    Some(body.clone())
}

pub fn parse_claude_windows(body: &Value) -> Vec<QuotaWindowSummary> {
    let payload = match parse_json_body(body) {
        Some(value) => value,
        None => return Vec::new(),
    };
    let object = match payload.as_object() {
        Some(value) => value,
        None => return Vec::new(),
    };

    let windows = [
        ("five_hour", "five-hour", "Five-hour window"),
        ("seven_day", "seven-day", "Seven-day window"),
        (
            "seven_day_oauth_apps",
            "seven-day-oauth-apps",
            "Seven-day OAuth apps window",
        ),
        ("seven_day_opus", "seven-day-opus", "Seven-day Opus window"),
        (
            "seven_day_sonnet",
            "seven-day-sonnet",
            "Seven-day Sonnet window",
        ),
        (
            "seven_day_cowork",
            "seven-day-cowork",
            "Seven-day Cowork window",
        ),
        ("iguana_necktie", "iguana-necktie", "Iguana necktie window"),
    ];

    windows
        .into_iter()
        .filter_map(|(key, id, label)| {
            let window = object.get(key)?;
            let utilization = window.get("utilization").and_then(normalize_number);
            Some(QuotaWindowSummary {
                id: id.to_string(),
                label: label.to_string(),
                used_percent: utilization,
            })
        })
        .collect()
}

pub fn parse_antigravity_windows(body: &Value) -> Vec<QuotaWindowSummary> {
    let payload = match parse_json_body(body) {
        Some(value) => value,
        None => return Vec::new(),
    };
    let nested_body = payload
        .get("body")
        .and_then(|nested| parse_json_body(nested));
    let object = payload.as_object().or_else(|| {
        nested_body.as_ref().and_then(|value| value.as_object())
    });
    let object = match object {
        Some(value) => value,
        None => return Vec::new(),
    };
    let groups = object.get("groups").and_then(|v| v.as_array());
    let groups = match groups {
        Some(value) => value,
        None => return Vec::new(),
    };

    let mut windows = Vec::new();
    for group in groups {
        let buckets = group
            .get("buckets")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();
        for bucket in buckets {
            let remaining = bucket
                .get("remainingFraction")
                .or_else(|| bucket.get("remaining_fraction"))
                .and_then(normalize_fraction);
            let Some(remaining) = remaining else {
                continue;
            };
            let clamped = remaining.clamp(0.0, 1.0);
            let used_percent = ((1.0 - clamped) * 10000.0).round() / 100.0;
            let id = bucket
                .get("bucketId")
                .or_else(|| bucket.get("bucket_id"))
                .and_then(normalize_string)
                .unwrap_or_else(|| "bucket".to_string());
            let label = bucket
                .get("displayName")
                .or_else(|| bucket.get("display_name"))
                .and_then(normalize_string)
                .unwrap_or_else(|| id.clone());
            windows.push(QuotaWindowSummary {
                id,
                label,
                used_percent: Some(used_percent),
            });
        }
    }
    windows
}

fn pick_window<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|key| value.get(*key))
}

pub fn parse_codex_windows(body: &Value) -> Vec<QuotaWindowSummary> {
    let payload = match parse_json_body(body) {
        Some(value) => value,
        None => return Vec::new(),
    };
    let object = match payload.as_object() {
        Some(value) => value,
        None => return Vec::new(),
    };

    let mut windows = Vec::new();
    let rate_limit = object
        .get("rate_limit")
        .or_else(|| object.get("rateLimit"));
    if let Some(limit) = rate_limit {
        add_codex_rate_windows(limit, &mut windows, "", "");
    }
    let code_review = object
        .get("code_review_rate_limit")
        .or_else(|| object.get("codeReviewRateLimit"));
    if let Some(limit) = code_review {
        add_codex_rate_windows(limit, &mut windows, "code-review-", "Code review ");
    }
    windows
}

fn add_codex_rate_windows(limit: &Value, windows: &mut Vec<QuotaWindowSummary>, id_prefix: &str, label_prefix: &str) {
    let primary = pick_window(limit, &["primary_window", "primaryWindow"]);
    let secondary = pick_window(limit, &["secondary_window", "secondaryWindow"]);
    if let Some(window) = primary {
        if let Some(used) = pick_window(window, &["used_percent", "usedPercent"]).and_then(normalize_number) {
            windows.push(QuotaWindowSummary {
                id: format!("{id_prefix}five-hour"),
                label: format!("{label_prefix}5-hour window"),
                used_percent: Some(used),
            });
        }
    }
    if let Some(window) = secondary {
        if let Some(used) = pick_window(window, &["used_percent", "usedPercent"]).and_then(normalize_number) {
            windows.push(QuotaWindowSummary {
                id: format!("{id_prefix}weekly"),
                label: format!("{label_prefix}Weekly window"),
                used_percent: Some(used),
            });
        }
    }
}

pub fn parse_kimi_windows(body: &Value) -> Vec<QuotaWindowSummary> {
    let payload = match parse_json_body(body) {
        Some(value) => value,
        None => return Vec::new(),
    };
    let object = match payload.as_object() {
        Some(value) => value,
        None => return Vec::new(),
    };

    let mut windows = Vec::new();
    if let Some(usage) = object.get("usage").and_then(|value| value.as_object()) {
        if let Some(used_percent) = kimi_used_percent(usage) {
            windows.push(QuotaWindowSummary {
                id: "summary".to_string(),
                label: "Weekly limit".to_string(),
                used_percent: Some(used_percent),
            });
        }
    }

    if let Some(limits) = object.get("limits").and_then(|value| value.as_array()) {
        for (index, item) in limits.iter().enumerate() {
            let detail = item
                .get("detail")
                .and_then(|value| value.as_object())
                .or_else(|| item.as_object());
            let Some(detail) = detail else {
                continue;
            };
            if let Some(used_percent) = kimi_used_percent(detail) {
                windows.push(QuotaWindowSummary {
                    id: format!("limit-{index}"),
                    label: format!("Limit {}", index + 1),
                    used_percent: Some(used_percent),
                });
            }
        }
    }
    windows
}

fn kimi_used_percent(data: &serde_json::Map<String, Value>) -> Option<f64> {
    let limit = data.get("limit").and_then(normalize_number)?;
    let used = data
        .get("used")
        .and_then(normalize_number)
        .or_else(|| {
            let remaining = data.get("remaining").and_then(normalize_number)?;
            Some(limit - remaining)
        })?;
    if limit > 0.0 {
        Some(((used / limit) * 10000.0).round() / 100.0)
    } else if used > 0.0 {
        Some(100.0)
    } else {
        Some(0.0)
    }
}

pub fn parse_xai_windows(body: &Value) -> Vec<QuotaWindowSummary> {
    let payload = match parse_json_body(body) {
        Some(value) => value,
        None => return Vec::new(),
    };
    let config = payload.get("config");
    let config = match config.and_then(|value| value.as_object()) {
        Some(value) => value,
        None => return Vec::new(),
    };

    let monthly_limit = config
        .get("monthlyLimit")
        .or_else(|| config.get("monthly_limit"))
        .and_then(normalize_xai_cents);
    let used = config.get("used").and_then(normalize_xai_cents);
    let used_percent = match (monthly_limit, used) {
        (Some(limit), Some(used)) if limit > 0.0 => Some(((used / limit) * 10000.0).round() / 100.0),
        _ => None,
    };

    if used_percent.is_none() {
        return Vec::new();
    }

    vec![QuotaWindowSummary {
        id: "monthly".to_string(),
        label: "Monthly billing".to_string(),
        used_percent,
    }]
}

fn normalize_xai_cents(value: &Value) -> Option<f64> {
    if let Some(object) = value.as_object() {
        return object.get("val").and_then(normalize_number);
    }
    normalize_number(value)
}

pub fn provider_from_auth_file(file: &Value) -> Option<&'static str> {
    let provider = file
        .get("provider")
        .or_else(|| file.get("type"))
        .and_then(normalize_string)?;
    let key = provider.to_lowercase().replace('_', "-");
    match key.as_str() {
        "claude" => Some("claude"),
        "codex" | "openai-codex" => Some("codex"),
        "antigravity" => Some("antigravity"),
        "kimi" => Some("kimi"),
        "xai" | "x-ai" | "grok" => Some("xai"),
        _ => None,
    }
}

pub fn is_disabled_auth_file(file: &Value) -> bool {
    match file.get("disabled") {
        Some(Value::Bool(value)) => *value,
        Some(Value::Number(value)) => value.as_i64().unwrap_or(0) != 0,
        Some(Value::String(text)) => text.trim().eq_ignore_ascii_case("true"),
        _ => false,
    }
}

pub fn resolve_auth_index(file: &Value) -> Option<String> {
    file.get("auth_index")
        .or_else(|| file.get("authIndex"))
        .and_then(normalize_string)
}

pub fn resolve_antigravity_project_id(file: &Value) -> Option<String> {
    if let Some(value) = file
        .get("project_id")
        .or_else(|| file.get("projectId"))
        .and_then(normalize_string)
    {
        return Some(value);
    }
    for key in ["metadata", "attributes"] {
        if let Some(object) = file.get(key).and_then(|value| value.as_object()) {
            if let Some(value) = object
                .get("project_id")
                .or_else(|| object.get("projectId"))
                .or_else(|| object.get("gemini_virtual_project"))
                .and_then(normalize_string)
            {
                return Some(value);
            }
        }
    }
    None
}

pub fn parse_provider_windows(provider: &str, body: &Value) -> Vec<QuotaWindowSummary> {
    match provider {
        "claude" => parse_claude_windows(body),
        "antigravity" => parse_antigravity_windows(body),
        "codex" => parse_codex_windows(body),
        "kimi" => parse_kimi_windows(body),
        "xai" => parse_xai_windows(body),
        _ => Vec::new(),
    }
}

pub fn classify_used_percent(used_percent: f64, warn: u8, critical: u8) -> Option<&'static str> {
    if used_percent >= 100.0 {
        Some("exhausted")
    } else if used_percent >= f64::from(critical) {
        Some("critical")
    } else if used_percent >= f64::from(warn) {
        Some("warn")
    } else {
        None
    }
}

pub fn dedupe_key(account: &str, window_label: &str, level: &str) -> String {
    format!("{account}:{window_label}:{level}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn fixture(name: &str) -> Value {
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.push("../../../packages/quota-parser/src/__tests__/fixtures");
        path.push(name);
        let raw = fs::read_to_string(path).expect("fixture");
        serde_json::from_str(&raw).expect("valid json")
    }

    #[test]
    fn parses_provider_fixtures() {
        let claude = parse_claude_windows(&fixture("claude-usage.json"));
        assert_eq!(claude[0].used_percent, Some(82.0));

        let agy = parse_antigravity_windows(&fixture("antigravity-usage.json"));
        assert!(agy.iter().any(|window| window.used_percent == Some(95.0)));

        let codex = parse_codex_windows(&fixture("codex-usage.json"));
        assert!(codex.iter().any(|window| window.used_percent == Some(80.0)));

        let kimi = parse_kimi_windows(&fixture("kimi-usage.json"));
        assert!(kimi.iter().any(|window| window.used_percent == Some(96.0)));

        let xai = parse_xai_windows(&fixture("xai-billing.json"));
        assert_eq!(xai[0].used_percent, Some(95.0));
    }
}