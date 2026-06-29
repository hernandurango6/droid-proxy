const providers = ["claude", "codex", "gemini", "antigravity", "kimi", "xai"];
const quotaProviders = ["claude", "antigravity", "codex", "kimi", "xai"];
const QUOTA_REFRESH_MS = 120_000;
const state = {
  endpoint: "",
  modelsExpanded: localStorage.getItem("droidproxy.modelsExpanded") === "true",
  factoryModels: [],
  factorySelectedIds: [],
  quotaLoading: false,
  quotaData: null
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
  $("#refresh-quota").addEventListener("click", () => loadQuota({ manual: true }));
  renderModelsCollapsedState();
  refreshAll();
  loadQuota();
  setInterval(refreshAll, 5000);
  setInterval(() => loadQuota(), QUOTA_REFRESH_MS);
});

function renderLoginButtons() {
  const container = $("#login-grid");
  container.innerHTML = "";
  for (const provider of providers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `provider-tile${provider === "claude" || provider === "codex" ? " is-primary" : ""}`;
    button.innerHTML = `<strong>${escapeHTML(label(provider))}</strong><span>Start OAuth flow</span>`;
    button.addEventListener("click", async () => {
      await postJSON("/api/login", { provider });
      showToast(`${label(provider)} login started. Complete the browser flow.`);
      setTimeout(refreshAll, 2000);
    });
    container.appendChild(button);
  }
}

async function refreshAll() {
  const refreshButton = $("#refresh");
  refreshButton.disabled = true;
  try {
    await Promise.allSettled([
      loadStatus(),
      loadConfig(),
      loadAccounts(),
      loadModels(),
      loadFactoryModels(),
      loadLogs()
    ]);
  } finally {
    refreshButton.disabled = false;
  }
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

  setVitalState("proxy", data.proxy.running);
  setVitalState("backend", data.backend.running);
  setVitalState("dashboard", data.dashboard.running);

  const overall = $("#overall-status");
  const ready = data.proxy.running && data.backend.running;
  overall.textContent = ready ? "Ready" : "Partial";
  overall.className = `status-chip ${ready ? "ok" : "warn"}`;
}

function setVitalState(service, running) {
  const vital = document.querySelector(`.vital[data-service="${service}"]`);
  if (!vital) return;
  vital.classList.toggle("is-live", Boolean(running));
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
  container.className = keys.length ? "data-list" : "data-list empty";
  container.innerHTML = keys.length ? "" : "No configured keys.";

  for (const entry of keys) {
    const item = document.createElement("div");
    item.className = "data-row-item";
    item.innerHTML = `<div><strong>${escapeHTML(entry.key)}</strong><span>${escapeHTML(entry.source || "Configured")}</span></div><span class="data-meta">round robin</span>`;
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
  status.textContent = data.installed ? "Installed" : "Not applied";
  status.className = `status-chip ${data.installed ? "ok" : "warn"}`;
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
  container.className = accounts.length ? "data-list" : "data-list empty";
  container.innerHTML = accounts.length ? "" : "No accounts found.";

  for (const account of accounts) {
    const item = document.createElement("div");
    item.className = "data-row-item";
    item.innerHTML = `<div><strong>${escapeHTML(account.email)}</strong><span>${escapeHTML(account.file)}</span></div><span class="data-meta">${escapeHTML(account.type)}${account.disabled ? " · disabled" : ""}</span>`;
    container.appendChild(item);
  }
}

async function loadModels() {
  const container = $("#models");
  try {
    const data = await getJSON("/api/models");
    const models = data.models || [];
    $("#model-count").textContent = String(models.length);
    container.className = models.length ? "data-list" : "data-list empty";
    container.innerHTML = models.length ? "" : "No models loaded.";

    for (const model of models) {
      const item = document.createElement("div");
      item.className = "data-row-item";
      item.innerHTML = `<div><strong>${escapeHTML(model.id)}</strong><span>${escapeHTML(model.owned_by || "unknown")}</span></div><span class="data-meta">${escapeHTML(model.object || "model")}</span>`;
      container.appendChild(item);
    }
  } catch (error) {
    $("#model-count").textContent = "0";
    container.className = "data-list empty";
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

async function loadQuota({ manual = false } = {}) {
  if (state.quotaLoading) return;
  state.quotaLoading = true;
  const refreshButton = $("#refresh-quota");
  const updated = $("#quota-updated");
  refreshButton.disabled = true;
  updated.textContent = "Loading…";
  updated.className = "status-chip muted";

  try {
    const data = await getJSON("/api/quota");
    state.quotaData = data;
    renderQuotaBoard(data);
    const fetchedAt = data.fetchedAt ? formatTimestamp(data.fetchedAt) : "just now";
    updated.textContent = `Updated ${fetchedAt}`;
    updated.className = "status-chip ok";
    if (manual) {
      showToast("Quota usage refreshed.");
    }
  } catch (error) {
    state.quotaData = null;
    renderQuotaError(error.message);
    updated.textContent = "Unavailable";
    updated.className = "status-chip warn";
    if (manual) {
      showToast(`Quota refresh failed: ${error.message}`);
    }
  } finally {
    state.quotaLoading = false;
    refreshButton.disabled = false;
  }
}

function renderQuotaError(message) {
  $("#quota-alerts").hidden = true;
  $("#quota-alerts").innerHTML = "";
  const board = $("#quota-board");
  board.className = "quota-board empty";
  board.textContent = message || "Quota data is unavailable. Check that the backend and management API are running.";
}

function renderQuotaBoard(data) {
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const thresholds = data.thresholds || { warn: 80, critical: 95 };

  renderQuotaAlerts(alerts);

  const board = $("#quota-board");
  if (accounts.length === 0) {
    board.className = "quota-board empty";
    board.textContent = "No quota-enabled auth files found. Add OAuth accounts first.";
    return;
  }

  board.className = "quota-board";
  board.innerHTML = "";

  const track = document.createElement("div");
  track.className = "quota-track";
  track.setAttribute("role", "list");
  track.setAttribute("aria-label", "Quota accounts");

  let lastProvider = null;
  for (const provider of quotaProviders) {
    const providerAccounts = accounts.filter((account) => account.provider === provider);
    for (const account of providerAccounts) {
      const card = renderQuotaAccountCard(account, thresholds);
      card.setAttribute("role", "listitem");
      if (account.provider !== lastProvider) {
        card.classList.add("quota-account-group-start");
        lastProvider = account.provider;
      }
      track.appendChild(card);
    }
  }

  board.appendChild(track);
}

function renderQuotaAlerts(alerts) {
  const container = $("#quota-alerts");
  if (!alerts.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  container.className = "quota-alerts";
  container.innerHTML = `<p class="quota-alerts-title">${alerts.length} active threshold alert${alerts.length === 1 ? "" : "s"}</p>`;

  for (const alert of alerts.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = `quota-alert quota-alert-${alert.level}`;
    item.innerHTML = `
      <strong>${escapeHTML(providerLabel(alert.provider))}</strong>
      <span>${escapeHTML(shortName(alert.accountName))} · ${escapeHTML(alert.windowLabel)}</span>
      <span class="quota-alert-level">${escapeHTML(alert.level)} · ${formatPercent(alert.usedPercent)}</span>
    `;
    container.appendChild(item);
  }

  if (alerts.length > 8) {
    const more = document.createElement("p");
    more.className = "quota-alerts-more";
    more.textContent = `+${alerts.length - 8} more alerts`;
    container.appendChild(more);
  }
}

function renderQuotaAccountCard(account, thresholds) {
  const card = document.createElement("article");
  card.className = `quota-account quota-account-${account.provider} quota-account-${account.status}`;

  const title = document.createElement("div");
  title.className = "quota-account-head";
  title.innerHTML = `
    <div class="quota-account-title">
      <span class="quota-provider-pill">${escapeHTML(providerLabel(account.provider))}</span>
      <strong>${escapeHTML(shortName(account.accountName))}</strong>
    </div>
  `;
  card.appendChild(title);

  if (account.status !== "success") {
    const error = document.createElement("p");
    error.className = "quota-account-error";
    error.textContent = account.error || "Quota unavailable for this account.";
    card.appendChild(error);
    return card;
  }

  if (account.provider === "codex") {
    card.appendChild(renderCodexMeta(account));
    card.appendChild(renderCodexResetCredits(account));
    card.appendChild(renderCodexActions(account));
  }

  if (account.provider === "antigravity") {
    card.appendChild(renderAntigravityPlan(account));
    card.appendChild(renderAntigravityGroups(account));
    card.appendChild(renderAntigravityActions(account));
    return card;
  }

  const windows = document.createElement("div");
  windows.className = "quota-window-list";

  for (const window of account.windows || []) {
    windows.appendChild(renderQuotaWindow(window, thresholds, account.provider));
  }

  if (!windows.childElementCount) {
    const empty = document.createElement("p");
    empty.className = "quota-account-error";
    empty.textContent = "No usage windows returned.";
    card.appendChild(empty);
    return card;
  }

  card.appendChild(windows);
  return card;
}

function renderAntigravityPlan(account) {
  const planLabel = account.antigravitySubscription?.planLabel || formatPlanLabel(account.planType);
  if (!planLabel) return document.createElement("div");

  const block = document.createElement("div");
  block.className = "quota-plan-banner";
  block.innerHTML = `<span class="quota-plan-banner-label">Plan</span><strong>${escapeHTML(planLabel)}</strong>`;
  return block;
}

function renderAntigravityGroups(account) {
  const groups = account.antigravityGroups || [];
  const container = document.createElement("div");
  container.className = "antigravity-groups";

  if (groups.length === 0) {
    container.className = "quota-account-error";
    container.textContent = "No Antigravity model groups returned.";
    return container;
  }

  const nowMs = Date.now() + (account.serverTimeOffsetMs || 0);

  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "antigravity-group";

    const head = document.createElement("div");
    head.className = "antigravity-group-head";
    head.innerHTML = `<h4>${escapeHTML(formatAntigravityGroupLabel(group.label))}</h4>`;
    const description = formatAntigravityGroupDescription(group.description);
    if (description) {
      const desc = document.createElement("p");
      desc.className = "antigravity-group-desc";
      desc.textContent = description;
      head.appendChild(desc);
    }
    section.appendChild(head);

    for (const bucket of group.buckets || []) {
      section.appendChild(renderAntigravityBucket(bucket, nowMs));
    }

    container.appendChild(section);
  }

  return container;
}

function renderAntigravityBucket(bucket, nowMs) {
  const row = document.createElement("div");
  row.className = "quota-window antigravity-bucket";

  const remainingFraction = Math.max(0, Math.min(1, bucket.remainingFraction ?? 0));
  const percentLabel = remainingFraction === 1
    ? "Quota available"
    : `${Math.round(remainingFraction * 100)}% remaining`;
  const resetLabel = formatAntigravityResetLabel(bucket.resetTime, nowMs);
  const barPercent = remainingFraction * 100;
  const barClass = remainingFraction >= 0.7
    ? "quota-bar-ok"
    : remainingFraction >= 0.3
      ? "quota-bar-warn"
      : "quota-bar-critical";

  row.innerHTML = `
    <div class="quota-window-head">
      <span class="quota-window-label">${escapeHTML(formatAntigravityBucketLabel(bucket.label))}</span>
      <div class="quota-window-meta">
        <span class="quota-window-value">${escapeHTML(percentLabel)}</span>
        <span class="quota-window-reset">${escapeHTML(resetLabel)}</span>
      </div>
    </div>
    <div class="quota-bar" aria-hidden="true"><div class="quota-bar-fill ${barClass}" style="width:${barWidth(barPercent)}%"></div></div>
  `;
  return row;
}

function renderAntigravityActions() {
  const row = document.createElement("div");
  row.className = "quota-account-actions quota-account-actions-end";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "btn btn-ghost";
  refreshButton.textContent = "Refresh quota";
  refreshButton.addEventListener("click", () => loadQuota({ manual: true }));

  row.appendChild(refreshButton);
  return row;
}

function formatAntigravityGroupLabel(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const labels = {
    "gemini models": "Gemini models",
    "claude and gpt models": "Claude and GPT models"
  };
  return labels[key] || value;
}

function formatAntigravityBucketLabel(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const labels = {
    "weekly limit": "Weekly limit",
    "daily limit": "Daily limit",
    "5 hour limit": "5-hour limit",
    "5-hour limit": "5-hour limit",
    "five hour limit": "5-hour limit",
    "monthly limit": "Monthly limit"
  };
  return labels[key] || value;
}

function formatAntigravityGroupDescription(description) {
  if (!description) return "";
  const match = String(description).match(/^models within this group:\s*(.+)$/i);
  if (match) return `Models in this group: ${match[1].trim()}`;
  return description;
}

function formatAntigravityResetLabel(resetTime, nowMs) {
  if (!resetTime) return "—";
  const resetMs = new Date(resetTime).getTime();
  if (Number.isNaN(resetMs)) return "—";
  const deltaMs = resetMs - nowMs;
  if (deltaMs <= 0) return "Quota available";
  return `Refreshes in ${formatAntigravityDuration(deltaMs)}`;
}

function formatAntigravityDuration(deltaMs) {
  const totalMinutes = Math.max(1, Math.ceil(deltaMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

function renderCodexMeta(account) {
  const meta = document.createElement("dl");
  meta.className = "quota-meta-grid";

  if (account.planType) {
    meta.appendChild(renderMetaItem("Plan", formatPlanLabel(account.planType)));
  }
  if (account.subscriptionActiveUntil) {
    meta.appendChild(renderMetaItem("Renewal time", formatSubscriptionDate(account.subscriptionActiveUntil)));
  }
  if (account.rateLimitResetCreditsAvailableCount !== null && account.rateLimitResetCreditsAvailableCount !== undefined) {
    meta.appendChild(renderMetaItem("Manual resets", String(account.rateLimitResetCreditsAvailableCount)));
  }

  return meta.childElementCount ? meta : document.createElement("div");
}

function renderMetaItem(label, value) {
  const row = document.createElement("div");
  row.className = "quota-meta-item";
  row.innerHTML = `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd>`;
  return row;
}

function renderCodexResetCredits(account) {
  const credits = account.rateLimitResetCredits || [];
  if (credits.length === 0) {
    if (!account.rateLimitResetCreditsError) return document.createElement("div");
    const error = document.createElement("p");
    error.className = "quota-account-error";
    error.textContent = `Manual reset expiry unavailable: ${account.rateLimitResetCreditsError}`;
    return error;
  }

  const block = document.createElement("div");
  block.className = "quota-reset-credits";
  block.innerHTML = `<p class="quota-reset-credits-title">Manual reset expiry (GMT+8)</p>`;

  credits.forEach((credit, index) => {
    const row = document.createElement("div");
    row.className = "quota-reset-credit-row";
    row.innerHTML = `
      <span>Reset ${index + 1}</span>
      <span>${escapeHTML(formatShanghaiDateTime(credit.expiresAt) || credit.expiresAt)}</span>
    `;
    block.appendChild(row);
  });

  return block;
}

function renderCodexActions(account) {
  const row = document.createElement("div");
  row.className = "quota-account-actions";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "btn btn-secondary";
  resetButton.textContent = "Reset quota";
  resetButton.disabled = !(account.rateLimitResetCreditsAvailableCount > 0);
  resetButton.addEventListener("click", () => resetCodexQuota(account.accountName, resetButton));

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "btn btn-ghost";
  refreshButton.textContent = "Refresh quota";
  refreshButton.addEventListener("click", () => loadQuota({ manual: true }));

  row.appendChild(resetButton);
  row.appendChild(refreshButton);
  return row;
}

async function resetCodexQuota(accountName, button) {
  button.disabled = true;
  try {
    const data = await postJSON("/api/quota/codex-reset", { accountName });
    state.quotaData = data;
    renderQuotaBoard(data);
    const updated = $("#quota-updated");
    updated.textContent = `Updated ${formatTimestamp(data.fetchedAt)}`;
    updated.className = "status-chip ok";
    showToast("Codex quota reset applied.");
  } catch (error) {
    showToast(`Codex reset failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function renderQuotaWindow(window, thresholds, provider) {
  const row = document.createElement("div");
  row.className = "quota-window";

  const usedPercent = window.usedPercent;
  const displayPercent = displayQuotaPercent(usedPercent, provider);
  const level = classifyQuotaLevel(usedPercent, thresholds);
  const barClass = level === "exhausted" || level === "critical"
    ? "quota-bar-critical"
    : level === "warn"
      ? "quota-bar-warn"
      : "quota-bar-ok";

  row.innerHTML = `
    <div class="quota-window-head">
      <span class="quota-window-label">${escapeHTML(window.label)}</span>
      <div class="quota-window-meta">
        <span class="quota-window-value">${formatPercentLabel(displayPercent)}</span>
        <span class="quota-window-reset">${escapeHTML(window.resetLabel || "—")}</span>
      </div>
    </div>
    <div class="quota-bar" aria-hidden="true"><div class="quota-bar-fill ${barClass}" style="width:${barWidth(displayPercent)}%"></div></div>
  `;
  return row;
}

function displayQuotaPercent(usedPercent, provider) {
  if (usedPercent === null || !Number.isFinite(usedPercent)) return null;
  if (provider === "xai") return usedPercent;
  return Math.max(0, Math.min(100, 100 - usedPercent));
}

function formatPercentLabel(value) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatPlanLabel(planType) {
  const normalized = String(planType || "").trim().toLowerCase();
  if (normalized === "plus") return "Plus";
  if (normalized === "pro") return "Pro";
  if (normalized === "team") return "Team";
  if (normalized === "free") return "Free";
  return String(planType || "");
}

function formatSubscriptionDate(value) {
  const date = typeof value === "number"
    ? new Date(value > 1_000_000_000_000 ? value : value * 1000)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatShanghaiDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date).replace(",", "");
}

function classifyQuotaLevel(usedPercent, thresholds) {
  if (usedPercent === null || !Number.isFinite(usedPercent)) return null;
  if (usedPercent >= 100) return "exhausted";
  if (usedPercent >= thresholds.critical) return "critical";
  if (usedPercent >= thresholds.warn) return "warn";
  return "ok";
}

function barWidth(usedPercent) {
  if (usedPercent === null || !Number.isFinite(usedPercent)) return 0;
  return Math.max(0, Math.min(100, usedPercent));
}

function formatPercent(value) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100) / 100}%`;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortName(value) {
  return String(value || "").replace(/\.json$/i, "");
}

function providerLabel(provider) {
  if (provider === "xai") return "xAI";
  if (provider === "antigravity") return "Antigravity";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

async function loadLogs() {
  const data = await getJSON("/api/logs");
  const logs = data.logs || [];
  $("#log-count").textContent = String(logs.length);
  $("#logs").textContent = logs.length ? logs.join("\n") : "No log lines yet.";
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
    container.className = "check-list empty";
    container.textContent = "No matching models.";
    return;
  }

  container.className = "check-list";

  for (const model of models) {
    const label = document.createElement("label");
    label.className = "check-item";
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