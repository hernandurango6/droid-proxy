import { invoke } from "@tauri-apps/api/core";

interface LabStatus {
  backend?: { running?: boolean; url?: string };
  proxy?: { running?: boolean; baseUrl?: string; url?: string };
  control?: { running?: boolean; url?: string };
  management?: { url?: string; keyConfigured?: boolean };
}

const healthEl = document.getElementById("health-status");
const proxyEl = document.getElementById("proxy-url");
const backendEl = document.getElementById("backend-url");
const jsonEl = document.getElementById("status-json");
const refreshBtn = document.getElementById("refresh-btn");
const restartBtn = document.getElementById("restart-btn");

async function refreshStatus(): Promise<void> {
  if (!healthEl || !proxyEl || !backendEl || !jsonEl) return;

  try {
    const status = await invoke<LabStatus>("lab_status");
    const healthy = Boolean(status.backend?.running && status.proxy?.running && status.control?.running);
    healthEl.textContent = healthy ? "ok" : "degraded";
    proxyEl.textContent = status.proxy?.baseUrl || status.proxy?.url || "—";
    backendEl.textContent = status.backend?.url || "—";
    jsonEl.textContent = JSON.stringify(status, null, 2);
  } catch (error) {
    healthEl.textContent = "unavailable";
    jsonEl.textContent = String(error);
  }
}

refreshBtn?.addEventListener("click", () => {
  void refreshStatus();
});

restartBtn?.addEventListener("click", () => {
  void invoke("supervisor_restart").then(() => refreshStatus());
});

void refreshStatus();
setInterval(() => {
  void refreshStatus();
}, 5000);