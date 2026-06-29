import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../hooks/useToast";
import { LOGIN_PROVIDERS, providerLabel } from "../lib/labels";
import { droidproxy } from "../lib/tauri";
import type {
  Account,
  ConfigPayload,
  FactoryModel,
  FactoryModelsStatus,
  ModelEntry,
  StatusPayload
} from "../lib/types";

function factoryModelMatches(model: FactoryModel, query: string): boolean {
  if (!query) return true;
  return [model.displayName, model.model, model.provider, model.id].some((value) =>
    String(value || "").toLowerCase().includes(query)
  );
}

export function DashboardPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [factory, setFactory] = useState<FactoryModelsStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [commandCodeInput, setCommandCodeInput] = useState("");
  const [factorySearch, setFactorySearch] = useState("");
  const [modelsExpanded, setModelsExpanded] = useState(
    () => localStorage.getItem("droidproxy.modelsExpanded") === "true"
  );

  const endpoint = status?.proxy.baseUrl || status?.proxy.url || "";

  const refreshAll = useCallback(async () => {
    const results = await Promise.allSettled([
      droidproxy.lab.status().then(setStatus),
      droidproxy.lab.config().then(setConfig),
      droidproxy.lab.accounts().then((data) => setAccounts(data.accounts || [])),
      droidproxy.lab.models().then((data) => {
        if (data.error) {
          setModels([]);
          setModelsError(data.message || data.error);
        } else {
          setModels(data.models || []);
          setModelsError(null);
        }
      }),
      droidproxy.lab.factoryModels().then(setFactory),
      droidproxy.lab.logs().then((data) => setLogs(data.logs || []))
    ]);

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      console.error("Dashboard refresh failures", failed);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
    const timer = window.setInterval(() => void refreshAll(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshAll]);

  const overallReady = Boolean(status?.proxy.running && status?.backend.running);
  const control = status?.control;
  const legacyDashboard = status?.dashboard;

  const filteredFactoryModels = useMemo(() => {
    const query = factorySearch.trim().toLowerCase();
    return (factory?.models || []).filter((model) => factoryModelMatches(model, query));
  }, [factory?.models, factorySearch]);

  const managementKey = config?.managementKeyMasked
    || (config?.managementKeyConfigured ? "(configured, masked)" : "not configured");

  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    showToast(message);
  }

  async function saveCommandCodeKeys(event: React.FormEvent) {
    event.preventDefault();
    const result = await droidproxy.lab.commandCodeKeys(commandCodeInput);
    setCommandCodeInput("");
    showToast(`Saved ${result.count} CommandCode key${result.count === 1 ? "" : "s"}.`);
    await refreshAll();
  }

  async function clearCommandCodeKeys() {
    const result = await droidproxy.lab.commandCodeKeys("");
    setCommandCodeInput("");
    showToast(`Saved ${result.count} CommandCode keys.`);
    await refreshAll();
  }

  async function applyFactoryModels() {
    const result = await droidproxy.lab.applyFactoryModels();
    showToast(`Applied ${result.count} Factory custom models.`);
    await refreshAll();
  }

  async function updateFactorySelection(mode: "all" | "none") {
    const ids =
      mode === "all"
        ? filteredFactoryModels.map((model) => model.id)
        : [];
    await droidproxy.lab.factoryModelsSelection(ids);
    await refreshAll();
    showToast(mode === "all" ? "All Factory models selected." : "Factory model selection cleared.");
  }

  async function toggleFactoryModel(modelId: string, checked: boolean) {
    if (!factory) return;
    const visibleIds = new Set(filteredFactoryModels.map((model) => model.id));
    const selected = new Set(factory.selectedIds);
    if (checked) selected.add(modelId);
    else selected.delete(modelId);

    const ids = factory.selectedIds
      .filter((id) => !visibleIds.has(id))
      .concat([...selected].filter((id) => visibleIds.has(id)));

    await droidproxy.lab.factoryModelsSelection(ids);
    await refreshAll();
  }

  function toggleModels() {
    const next = !modelsExpanded;
    setModelsExpanded(next);
    localStorage.setItem("droidproxy.modelsExpanded", String(next));
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>DroidProxy</h1>
          <p id="endpoint">{endpoint || "Loading endpoint..."}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => void copyText(endpoint, "Endpoint copied.")}>
            Copy Endpoint
          </button>
          <button type="button" onClick={() => void refreshAll()}>
            Refresh
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel status-panel">
          <div className="panel-header">
            <h2>Status</h2>
            <span className={`pill ${overallReady ? "ok" : "warn"}`}>
              {overallReady ? "Ready" : "Partial"}
            </span>
          </div>
          <div className="status-grid">
            <div>
              <span className="label">Proxy</span>
              <strong>{status?.proxy.running ? "Running" : "Stopped"}</strong>
              <small>{status?.proxy.baseUrl || status?.proxy.url || "-"}</small>
            </div>
            <div>
              <span className="label">Backend</span>
              <strong>
                {status?.backend.running
                  ? `Running · PID ${status.backend.pid}`
                  : "Stopped"}
              </strong>
              <small>{status?.backend.url || "-"}</small>
            </div>
            <div>
              <span className="label">{control ? "Control API" : "Dashboard"}</span>
              <strong>
                {(control?.running ?? legacyDashboard?.running) ? "Running" : "Stopped"}
              </strong>
              <small>{control?.url || legacyDashboard?.url || "-"}</small>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>OAuth</h2>
            <button type="button" onClick={() => void droidproxy.lab.openPath("auth")}>
              Open Auth Folder
            </button>
          </div>
          <div className="button-grid">
            {LOGIN_PROVIDERS.map((provider) => (
              <button
                key={provider}
                type="button"
                className={provider === "claude" || provider === "codex" ? "primary" : ""}
                onClick={() => {
                  void droidproxy.lab.login(provider).then(() => {
                    showToast(`${providerLabel(provider)} login started. Complete the browser flow.`);
                    window.setTimeout(() => void refreshAll(), 2000);
                  });
                }}
              >
                Login {providerLabel(provider)}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Management Center</h2>
            <button
              type="button"
              className="primary"
              onClick={() => void droidproxy.lab.openPath("management")}
            >
              Open Advanced UI
            </button>
          </div>
          <dl className="config-list">
            <div>
              <dt>URL</dt>
              <dd>{config?.managementUrl || status?.management.url || "-"}</dd>
            </div>
            <div>
              <dt>Key</dt>
              <dd>{managementKey}</dd>
            </div>
          </dl>
          <div className="panel-actions">
            <button
              type="button"
              onClick={() =>
                void copyText(config?.managementUrl || status?.management.url || "", "Management URL copied.")
              }
            >
              Copy URL
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Accounts</h2>
            <span className="pill muted">{accounts.length}</span>
          </div>
          <div className={`list ${accounts.length ? "" : "empty"}`}>
            {accounts.length === 0 ? (
              "No accounts found."
            ) : (
              accounts.map((account) => (
                <div className="list-item" key={`${account.file}-${account.email}`}>
                  <div>
                    <strong>{account.email}</strong>
                    <span>{account.file}</span>
                  </div>
                  <span>
                    {account.type}
                    {account.disabled ? " · disabled" : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>CommandCode Keys</h2>
            <span className="pill muted">{config?.configuredCommandCodeApiKeys.length || 0}</span>
          </div>
          <form className="key-form" onSubmit={(event) => void saveCommandCodeKeys(event)}>
            <label className="search-box">
              <span>API keys</span>
              <textarea
                rows={5}
                spellCheck={false}
                placeholder="Paste one key per line or separate them with commas"
                value={commandCodeInput}
                onChange={(event) => setCommandCodeInput(event.target.value)}
              />
            </label>
            <div className="panel-actions">
              <button className="primary" type="submit">
                Save Keys
              </button>
              <button type="button" onClick={() => void clearCommandCodeKeys()}>
                Clear
              </button>
            </div>
          </form>
          <div className={`list ${config?.configuredCommandCodeApiKeys.length ? "" : "empty"}`}>
            {!config?.configuredCommandCodeApiKeys.length ? (
              "No configured keys."
            ) : (
              config.configuredCommandCodeApiKeys.map((entry) => (
                <div className="list-item" key={`${entry.key}-${entry.source}`}>
                  <div>
                    <strong>{entry.key}</strong>
                    <span>{entry.source || "Configured"}</span>
                  </div>
                  <span>round robin</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Models</h2>
            <div className="header-actions">
              <span className="pill muted">{models.length}</span>
              <button
                type="button"
                aria-expanded={modelsExpanded}
                onClick={toggleModels}
              >
                {modelsExpanded ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {modelsExpanded && (
            <div>
              <div className={`list ${models.length || modelsError ? "" : "empty"}`}>
                {modelsError ? (
                  modelsError
                ) : models.length === 0 ? (
                  "No models loaded."
                ) : (
                  models.map((model) => (
                    <div className="list-item" key={model.id}>
                      <div>
                        <strong>{model.id}</strong>
                        <span>{model.owned_by || "unknown"}</span>
                      </div>
                      <span>{model.object || "model"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Factory Custom Models</h2>
            <span className={`pill ${factory?.installed ? "ok" : "warn"}`}>
              {factory?.installed ? "Installed" : "Not Applied"}
            </span>
          </div>
          <p className="panel-copy">
            Writes DroidProxy model aliases into Factory settings and creates a timestamped backup first.
          </p>
          <div className="panel-actions">
            <button type="button" className="primary" onClick={() => void applyFactoryModels()}>
              Apply Models
            </button>
            <button type="button" onClick={() => void updateFactorySelection("all")}>
              Select All
            </button>
            <button type="button" onClick={() => void updateFactorySelection("none")}>
              Clear
            </button>
          </div>
          <label className="search-box">
            <span>Search models</span>
            <input
              type="search"
              placeholder="Claude, GPT, Gemini, Kimi..."
              value={factorySearch}
              onChange={(event) => setFactorySearch(event.target.value)}
            />
          </label>
          <dl className="config-list factory-meta">
            <div>
              <dt>Settings</dt>
              <dd>{factory?.settingsPath || "-"}</dd>
            </div>
            <div>
              <dt>Expected</dt>
              <dd>
                {factory
                  ? `${factory.installedCount}/${factory.selectedCount} selected models present (${factory.expectedCount} available)`
                  : "-"}
              </dd>
            </div>
          </dl>
          <div className={`selection-list ${filteredFactoryModels.length ? "" : "empty"}`}>
            {filteredFactoryModels.length === 0 ? (
              "No matching models."
            ) : (
              filteredFactoryModels.map((model) => (
                <label className="selection-item" key={model.id}>
                  <input
                    type="checkbox"
                    checked={factory?.selectedIds.includes(model.id) || false}
                    onChange={(event) => void toggleFactoryModel(model.id, event.target.checked)}
                  />
                  <div>
                    <strong>{model.displayName}</strong>
                    <span>
                      {model.model} · {model.provider} · {model.id}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-header">
            <h2>Config</h2>
            <button type="button" onClick={() => void droidproxy.lab.openPath("config")}>
              Open Config
            </button>
          </div>
          <dl className="config-list">
            <div>
              <dt>Config</dt>
              <dd>{config?.configPath || "-"}</dd>
            </div>
            <div>
              <dt>Auth</dt>
              <dd>{config?.authDir || "-"}</dd>
            </div>
            <div>
              <dt>Factory</dt>
              <dd>{config?.factorySettingsPath || "-"}</dd>
            </div>
            <div>
              <dt>Debug</dt>
              <dd>{config?.debug ? "enabled" : "disabled"}</dd>
            </div>
            <div>
              <dt>CommandCode</dt>
              <dd>
                {config
                  ? `${config.commandCodeApiKeyCount} key${config.commandCodeApiKeyCount === 1 ? "" : "s"}`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>Fast Mode</dt>
              <dd>
                {[config?.gpt54FastMode ? "gpt-5.4" : null, config?.gpt55FastMode ? "gpt-5.5" : null]
                  .filter(Boolean)
                  .join(", ") || "disabled"}
              </dd>
            </div>
            <div>
              <dt>Timeout</dt>
              <dd>
                {config ? `${config.requestTimeout}, retry ${config.requestRetry}` : "-"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel logs-panel">
          <div className="panel-header">
            <h2>Logs</h2>
            <span className="pill muted">{logs.length}</span>
          </div>
          <pre id="logs">{logs.join("\n")}</pre>
        </section>
      </main>
    </>
  );
}