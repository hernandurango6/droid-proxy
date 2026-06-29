const providers = ["claude", "codex", "gemini", "antigravity", "kimi", "xai"];
const state = {
  endpoint: "",
  modelsExpanded: localStorage.getItem("droidproxy.modelsExpanded") === "true",
  factoryModels: [],
  factorySelectedIds: []
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  renderLoginButtons();
  $("#refresh").addEventListener("click", refreshAll);
  $("#copy-endpoint").addEventListener("click", copyEndpoint);
  $("#open-auth").addEventListener("click", () => postJSON("/api/open-auth-dir", {}));
  $("#open-config").addEventListener("click", () => postJSON("/api/open-config", {}));
  $("#open-management").addEventListener("click", () => postJSON("/api/open-management", {}));
  $("#copy-management-url").addEventListener("click", () => copyText($("#management-url").textContent, "Management URL copied."));
  $("#copy-management-key").addEventListener("click", () => copyText($("#management-key").textContent, "Management key copied."));
  $("#commandcode-key-form").addEventListener("submit", saveCommandCodeKeys);
  $("#clear-commandcode-keys").addEventListener("click", clearCommandCodeKeys);
  $("#apply-factory-models").addEventListener("click", applyFactoryModels);
  $("#select-all-factory-models").addEventListener("click", () => updateFactorySelection("all"));
  $("#clear-factory-models").addEventListener("click", () => updateFactorySelection("none"));
  $("#factory-model-search").addEventListener("input", renderFactorySelectionFromState);
  $("#toggle-models").addEventListener("click", toggleModels);
  renderModelsCollapsedState();
  refreshAll();
  setInterval(refreshAll, 5000);
});

function renderLoginButtons() {
  const container = $("#login-grid");
  container.innerHTML = "";
  for (const provider of providers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = provider === "claude" || provider === "codex" ? "primary" : "";
    button.textContent = `Login ${label(provider)}`;
    button.addEventListener("click", async () => {
      await postJSON("/api/login", { provider });
      showToast(`${label(provider)} login started. Complete the browser flow.`);
      setTimeout(refreshAll, 2000);
    });
    container.appendChild(button);
  }
}

async function refreshAll() {
  await Promise.allSettled([
    loadStatus(),
    loadConfig(),
    loadAccounts(),
    loadModels(),
    loadFactoryModels(),
    loadLogs()
  ]);
}

async function loadStatus() {
  const data = await getJSON("/api/status");
  state.endpoint = data.proxy.baseUrl;
  $("#endpoint").textContent = data.proxy.baseUrl;
  $("#proxy-status").textContent = data.proxy.running ? "Running" : "Stopped";
  $("#proxy-url").textContent = data.proxy.baseUrl;
  $("#backend-status").textContent = data.backend.running ? `Running · PID ${data.backend.pid}` : "Stopped";
  $("#backend-url").textContent = data.backend.url;
  $("#dashboard-status").textContent = data.dashboard.running ? "Running" : "Stopped";
  $("#dashboard-url").textContent = data.dashboard.url;

  const overall = $("#overall-status");
  overall.textContent = data.proxy.running && data.backend.running ? "Ready" : "Partial";
  overall.className = `pill ${data.proxy.running && data.backend.running ? "ok" : "warn"}`;
}

async function loadConfig() {
  const data = await getJSON("/api/config");
  $("#config-path").textContent = data.configPath;
  $("#auth-dir").textContent = data.authDir;
  $("#factory-path").textContent = data.factorySettingsPath;
  $("#management-url").textContent = data.managementUrl;
  $("#management-key").textContent = data.managementSecretKey;
  $("#debug-flag").textContent = data.debug ? "enabled" : "disabled";
  $("#commandcode-keys").textContent = `${data.commandCodeApiKeyCount || 0} key${data.commandCodeApiKeyCount === 1 ? "" : "s"}`;
  renderCommandCodeKeys(data.configuredCommandCodeApiKeys || []);
  $("#fast-mode").textContent = [
    data.gpt54FastMode ? "gpt-5.4" : null,
    data.gpt55FastMode ? "gpt-5.5" : null
  ].filter(Boolean).join(", ") || "disabled";
  $("#timeout").textContent = `${data.requestTimeout}, retry ${data.requestRetry}`;
}

function renderCommandCodeKeys(keys) {
  $("#configured-commandcode-key-count").textContent = String(keys.length);
  const container = $("#commandcode-key-list");
  container.className = keys.length ? "list" : "list empty";
  container.innerHTML = keys.length ? "" : "No configured keys.";

  for (const entry of keys) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<div><strong>${escapeHTML(entry.key)}</strong><span>${escapeHTML(entry.source || "Configured")}</span></div><span>round robin</span>`;
    container.appendChild(item);
  }
}

async function saveCommandCodeKeys(event) {
  event.preventDefault();
  const keys = $("#commandcode-key-input").value;
  const result = await postJSON("/api/commandcode-keys", { keys });
  $("#commandcode-key-input").value = "";
  showToast(`Saved ${result.count} CommandCode key${result.count === 1 ? "" : "s"}.`);
  await loadConfig();
}

async function clearCommandCodeKeys() {
  const result = await postJSON("/api/commandcode-keys", { keys: "" });
  $("#commandcode-key-input").value = "";
  showToast(`Saved ${result.count} CommandCode keys.`);
  await loadConfig();
}

async function loadFactoryModels() {
  const data = await getJSON("/api/factory-models");
  const status = $("#factory-status");
  status.textContent = data.installed ? "Installed" : "Not Applied";
  status.className = `pill ${data.installed ? "ok" : "warn"}`;
  $("#factory-settings-path").textContent = data.settingsPath;
  $("#factory-expected").textContent = `${data.installedCount}/${data.selectedCount} selected models present (${data.expectedCount} available)`;
  state.factoryModels = data.models || [];
  state.factorySelectedIds = data.selectedIds || [];
  renderFactorySelectionFromState();
}

async function loadAccounts() {
  const data = await getJSON("/api/accounts");
  const accounts = data.accounts || [];
  $("#account-count").textContent = String(accounts.length);
  const container = $("#accounts");
  container.className = accounts.length ? "list" : "list empty";
  container.innerHTML = accounts.length ? "" : "No accounts found.";

  for (const account of accounts) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<div><strong>${escapeHTML(account.email)}</strong><span>${escapeHTML(account.file)}</span></div><span>${escapeHTML(account.type)}${account.disabled ? " · disabled" : ""}</span>`;
    container.appendChild(item);
  }
}

async function loadModels() {
  const container = $("#models");
  try {
    const data = await getJSON("/api/models");
    const models = data.models || [];
    $("#model-count").textContent = String(models.length);
    container.className = models.length ? "list" : "list empty";
    container.innerHTML = models.length ? "" : "No models loaded.";

    for (const model of models) {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<div><strong>${escapeHTML(model.id)}</strong><span>${escapeHTML(model.owned_by || "unknown")}</span></div><span>${escapeHTML(model.object || "model")}</span>`;
      container.appendChild(item);
    }
  } catch (error) {
    $("#model-count").textContent = "0";
    container.className = "list empty";
    container.textContent = error.message;
  }
}

function toggleModels() {
  state.modelsExpanded = !state.modelsExpanded;
  localStorage.setItem("droidproxy.modelsExpanded", String(state.modelsExpanded));
  renderModelsCollapsedState();
}

function renderModelsCollapsedState() {
  const body = $("#models-body");
  const button = $("#toggle-models");
  body.hidden = !state.modelsExpanded;
  button.textContent = state.modelsExpanded ? "Hide" : "Show";
  button.setAttribute("aria-expanded", String(state.modelsExpanded));
}

async function loadLogs() {
  const data = await getJSON("/api/logs");
  const logs = data.logs || [];
  $("#log-count").textContent = String(logs.length);
  $("#logs").textContent = logs.join("\n");
}

async function copyEndpoint() {
  await copyText(state.endpoint, "Endpoint copied.");
}

async function applyFactoryModels() {
  const result = await postJSON("/api/apply-factory-models", {});
  showToast(`Applied ${result.count} Factory custom models.`);
  await loadFactoryModels();
}

function renderFactorySelectionFromState() {
  const selected = new Set(state.factorySelectedIds);
  const query = $("#factory-model-search").value.trim().toLowerCase();
  const models = state.factoryModels.filter((model) => factoryModelMatches(model, query));
  const container = $("#factory-model-selection");
  container.innerHTML = "";

  if (models.length === 0) {
    container.className = "selection-list empty";
    container.textContent = "No matching models.";
    return;
  }

  container.className = "selection-list";

  for (const model of models) {
    const label = document.createElement("label");
    label.className = "selection-item";
    label.innerHTML = `
      <input type="checkbox" value="${escapeHTML(model.id)}" ${selected.has(model.id) ? "checked" : ""}>
      <div>
        <strong>${escapeHTML(model.displayName)}</strong>
        <span>${escapeHTML(model.model)} · ${escapeHTML(model.provider)} · ${escapeHTML(model.id)}</span>
      </div>
    `;
    label.querySelector("input").addEventListener("change", saveFactorySelectionFromDOM);
    container.appendChild(label);
  }
}

function factoryModelMatches(model, query) {
  if (!query) return true;
  return [
    model.displayName,
    model.model,
    model.provider,
    model.id
  ].some((value) => String(value || "").toLowerCase().includes(query));
}

async function updateFactorySelection(mode) {
  const models = [...document.querySelectorAll("#factory-model-selection input")];
  const ids = mode === "all" ? models.map((input) => input.value) : [];
  await postJSON("/api/factory-models/selection", { ids });
  await loadFactoryModels();
  showToast(mode === "all" ? "All Factory models selected." : "Factory model selection cleared.");
}

async function saveFactorySelectionFromDOM() {
  const visibleIds = new Set([...document.querySelectorAll("#factory-model-selection input")].map((input) => input.value));
  const visibleSelectedIds = new Set([...document.querySelectorAll("#factory-model-selection input:checked")].map((input) => input.value));
  const ids = state.factorySelectedIds
    .filter((id) => !visibleIds.has(id))
    .concat([...visibleSelectedIds]);
  await postJSON("/api/factory-models/selection", { ids });
  await loadFactoryModels();
}

async function copyText(text, message) {
  await navigator.clipboard.writeText(text);
  showToast(message);
}

async function getJSON(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function label(value) {
  if (value === "xai") return "xAI";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}
