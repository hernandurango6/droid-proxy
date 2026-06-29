use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;
use tokio::time::sleep;

const HEALTH_URL: &str = "http://127.0.0.1:8420/health";
const HEALTH_RETRIES: usize = 30;
const HEALTH_INTERVAL_MS: u64 = 500;

pub struct SupervisorState {
    inner: Arc<Mutex<SupervisorInner>>,
}

struct SupervisorInner {
    app: AppHandle,
    child: Option<Child>,
    root_dir: PathBuf,
    sidecar_launch: SidecarLaunch,
}

#[derive(Clone)]
enum SidecarLaunch {
    Executable { path: PathBuf },
    NodeScript { node: PathBuf, script: PathBuf },
}

impl SupervisorState {
    pub fn new(app: AppHandle) -> Result<Self, String> {
        let root_dir = resolve_repo_root(&app)?;
        let sidecar_launch = resolve_sidecar_launch(&app, &root_dir)?;
        Ok(Self {
            inner: Arc::new(Mutex::new(SupervisorInner {
                app,
                child: None,
                root_dir,
                sidecar_launch,
            })),
        })
    }

    pub async fn start_background(self: &Arc<Self>) {
        let state = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = state.ensure_running().await {
                eprintln!("supervisor start failed: {error}");
            }
            state.monitor_loop().await;
        });
    }

    pub async fn restart(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().await;
        inner.stop_child()?;
        inner.spawn_child()?;
        drop(inner);
        self.wait_until_healthy().await
    }

    async fn ensure_running(&self) -> Result<(), String> {
        if self.is_healthy().await {
            return Ok(());
        }

        let mut inner = self.inner.lock().await;
        if inner.child.is_none() {
            inner.spawn_child()?;
        }
        drop(inner);
        self.wait_until_healthy().await
    }

    async fn monitor_loop(self: Arc<Self>) {
        loop {
            sleep(Duration::from_secs(3)).await;
            if self.is_healthy().await {
                continue;
            }

            eprintln!("sidecar unhealthy — restarting");
            if let Err(error) = self.restart().await {
                eprintln!("sidecar restart failed: {error}");
            }
        }
    }

    async fn wait_until_healthy(&self) -> Result<(), String> {
        for _ in 0..HEALTH_RETRIES {
            if self.is_healthy().await {
                return Ok(());
            }
            sleep(Duration::from_millis(HEALTH_INTERVAL_MS)).await;
        }
        Err("sidecar health probe timed out".into())
    }

    async fn is_healthy(&self) -> bool {
        let client = reqwest::Client::new();
        let response = client.get(HEALTH_URL).send().await;
        let Ok(response) = response else {
            return false;
        };
        if !response.status().is_success() {
            return false;
        }
        let Ok(body) = response.json::<Value>().await else {
            return false;
        };
        body.get("status").and_then(|value| value.as_str()) == Some("ok")
    }
}

impl SupervisorInner {
    fn spawn_child(&mut self) -> Result<(), String> {
        self.stop_child()?;

        let mut command = match &self.sidecar_launch {
            SidecarLaunch::Executable { path } => {
                let mut cmd = Command::new(path);
                cmd.current_dir(&self.root_dir);
                cmd
            }
            SidecarLaunch::NodeScript { node, script } => {
                let mut cmd = Command::new(node);
                cmd.arg(script);
                cmd.current_dir(&self.root_dir);
                cmd
            }
        };

        command
            .env("DROIDPROXY_ROOT", &self.root_dir)
            .env("DROIDPROXY_HOST", "127.0.0.1")
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        if let Ok(resource_dir) = self.app.path().resource_dir() {
            command.env("TAURI_RESOURCE_DIR", resource_dir);
        }

        let child = command
            .spawn()
            .map_err(|error| format!("failed to spawn sidecar: {error}"))?;

        self.child = Some(child);
        Ok(())
    }

    fn stop_child(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        Ok(())
    }
}

fn resolve_repo_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Some(parent) = resource_dir.parent() {
            let candidate = parent.to_path_buf();
            if has_backend_binary(&candidate) {
                return Ok(candidate);
            }
        }
    }

    let mut current = std::env::current_dir().map_err(|error| error.to_string())?;
    for _ in 0..8 {
        if has_backend_binary(&current) {
            return Ok(current);
        }
        if !current.pop() {
            break;
        }
    }

    Err("could not resolve DroidProxy root directory".into())
}

fn has_backend_binary(root: &Path) -> bool {
    root.join("resources")
        .join("bin")
        .join("cli-proxy-api.exe")
        .exists()
}

fn resolve_sidecar_launch(app: &AppHandle, root_dir: &Path) -> Result<SidecarLaunch, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("bin").join("droidproxy-sidecar.exe");
        if bundled.exists() {
            return Ok(SidecarLaunch::Executable { path: bundled });
        }
    }

    let repo_sidecar = root_dir
        .join("apps")
        .join("sidecar")
        .join("dist")
        .join("droidproxy-sidecar.exe");
    if repo_sidecar.exists() {
        return Ok(SidecarLaunch::Executable { path: repo_sidecar });
    }

    let script = root_dir.join("apps").join("sidecar").join("dist").join("main.js");
    if script.exists() {
        let node = which_node()?;
        return Ok(SidecarLaunch::NodeScript { node, script });
    }

    Err("sidecar binary not found — run pnpm sidecar:build first".into())
}

fn which_node() -> Result<PathBuf, String> {
    let output = Command::new("where")
        .arg("node")
        .output()
        .map_err(|error| format!("failed to locate node.exe: {error}"))?;

    if !output.status.success() {
        return Err("node.exe not found on PATH".into());
    }

    let path = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();

    if path.is_empty() {
        return Err("node.exe not found on PATH".into());
    }

    Ok(PathBuf::from(path))
}

