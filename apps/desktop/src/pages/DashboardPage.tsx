import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { LOGIN_PROVIDERS, providerLabel } from "@/lib/labels";
import { droidproxy } from "@/lib/tauri";
import type {
  Account,
  ConfigPayload,
  FactoryModel,
  FactoryModelsStatus,
  ModelEntry,
  StatusPayload
} from "@/lib/types";

function factoryModelMatches(model: FactoryModel, query: string): boolean {
  if (!query) return true;
  return [model.displayName, model.model, model.provider, model.id].some((value) =>
    String(value || "").toLowerCase().includes(query)
  );
}

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <Badge variant={ready ? "default" : "secondary"}>
      {ready ? "Ready" : "Partial"}
    </Badge>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
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
  const overallReady = Boolean(status?.proxy.running && status?.backend.running);
  const control = status?.control;
  const legacyDashboard = status?.dashboard;

  const filteredFactoryModels = useMemo(() => {
    const query = factorySearch.trim().toLowerCase();
    return (factory?.models || []).filter((model) => factoryModelMatches(model, query));
  }, [factory?.models, factorySearch]);

  const managementKey =
    config?.managementKeyMasked ||
    (config?.managementKeyConfigured ? "(configured, masked)" : "not configured");

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
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
  }, []);

  useEffect(() => {
    void refreshAll();
    const timer = window.setInterval(() => void refreshAll(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshAll]);

  async function saveCommandCodeKeys(event: React.FormEvent) {
    event.preventDefault();
    const result = await droidproxy.lab.commandCodeKeys(commandCodeInput);
    setCommandCodeInput("");
    toast.success(`Saved ${result.count} CommandCode key${result.count === 1 ? "" : "s"}.`);
    await refreshAll();
  }

  async function clearCommandCodeKeys() {
    const result = await droidproxy.lab.commandCodeKeys("");
    setCommandCodeInput("");
    toast.success(`Saved ${result.count} CommandCode keys.`);
    await refreshAll();
  }

  async function applyFactoryModels() {
    const result = await droidproxy.lab.applyFactoryModels();
    toast.success(`Applied ${result.count} Factory custom models.`);
    await refreshAll();
  }

  async function updateFactorySelection(mode: "all" | "none") {
    const ids = mode === "all" ? filteredFactoryModels.map((model) => model.id) : [];
    await droidproxy.lab.factoryModelsSelection(ids);
    await refreshAll();
    toast.success(mode === "all" ? "All Factory models selected." : "Factory model selection cleared.");
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

  function openManagement() {
    navigate({ pathname: "/management", hash: "#/" });
  }

  return (
    <AppShell endpoint={endpoint} onRefresh={() => void refreshAll()}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Status</CardTitle>
              <CardDescription>Sidecar-supervised lab runtime</CardDescription>
            </div>
            <StatusBadge ready={overallReady} />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Proxy</p>
              <p className="font-medium">{status?.proxy.running ? "Running" : "Stopped"}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {status?.proxy.baseUrl || status?.proxy.url || "-"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Backend</p>
              <p className="font-medium">
                {status?.backend.running ? `Running · PID ${status.backend.pid}` : "Stopped"}
              </p>
              <p className="font-mono text-xs text-muted-foreground">{status?.backend.url || "-"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{control ? "Control API" : "Dashboard"}</p>
              <p className="font-medium">
                {(control?.running ?? legacyDashboard?.running) ? "Running" : "Stopped"}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {control?.url || legacyDashboard?.url || "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>OAuth</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void droidproxy.lab.openPath("auth")}>
              Open auth folder
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {LOGIN_PROVIDERS.map((provider) => (
              <Button
                key={provider}
                variant={provider === "claude" || provider === "codex" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  void droidproxy.lab.login(provider).then(() => {
                    toast.message(`${providerLabel(provider)} login started`);
                    window.setTimeout(() => void refreshAll(), 2000);
                  });
                }}
              >
                Login {providerLabel(provider)}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Management Center</CardTitle>
              <CardDescription>Full Management Center embedded in-app via IPC</CardDescription>
            </div>
            <Button size="sm" onClick={openManagement}>
              Open Management
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">URL</p>
              <p className="font-mono text-xs">{config?.managementUrl || status?.management.url || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Key</p>
              <p className="font-mono text-xs">{managementKey}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Accounts</CardTitle>
            <Badge variant="secondary">{accounts.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts found.</p>
            ) : (
              accounts.map((account) => (
                <div key={`${account.file}-${account.email}`} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{account.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.file} · {account.type}
                    {account.disabled ? " · disabled" : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>CommandCode Keys</CardTitle>
            <Badge variant="secondary">{config?.configuredCommandCodeApiKeys.length || 0}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="space-y-2" onSubmit={(event) => void saveCommandCodeKeys(event)}>
              <Textarea
                rows={4}
                spellCheck={false}
                placeholder="Paste one key per line or separate them with commas"
                value={commandCodeInput}
                onChange={(event) => setCommandCodeInput(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm">Save keys</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void clearCommandCodeKeys()}>
                  Clear
                </Button>
              </div>
            </form>
            <div className="space-y-2">
              {(config?.configuredCommandCodeApiKeys || []).map((entry) => (
                <div key={`${entry.key}-${entry.source}`} className="rounded-lg border p-2 text-xs">
                  <p className="font-medium">{entry.key}</p>
                  <p className="text-muted-foreground">{entry.source || "Configured"} · round robin</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Models</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{models.length}</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = !modelsExpanded;
                  setModelsExpanded(next);
                  localStorage.setItem("droidproxy.modelsExpanded", String(next));
                }}
              >
                {modelsExpanded ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {modelsExpanded && (
            <CardContent className="space-y-2">
              {modelsError ? (
                <p className="text-sm text-destructive">{modelsError}</p>
              ) : models.length === 0 ? (
                <p className="text-sm text-muted-foreground">No models loaded.</p>
              ) : (
                models.map((model) => (
                  <div key={model.id} className="rounded-lg border p-2 text-xs">
                    <p className="font-medium">{model.id}</p>
                    <p className="text-muted-foreground">
                      {model.owned_by || "unknown"} · {model.object || "model"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Factory Custom Models</CardTitle>
              <CardDescription>
                Writes DroidProxy model aliases into Factory settings with timestamped backup.
              </CardDescription>
            </div>
            <Badge variant={factory?.installed ? "default" : "secondary"}>
              {factory?.installed ? "Installed" : "Not applied"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void applyFactoryModels()}>Apply models</Button>
              <Button variant="outline" size="sm" onClick={() => void updateFactorySelection("all")}>
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={() => void updateFactorySelection("none")}>
                Clear
              </Button>
            </div>
            <Input
              placeholder="Search Claude, GPT, Gemini, Kimi..."
              value={factorySearch}
              onChange={(event) => setFactorySearch(event.target.value)}
            />
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>Settings: {factory?.settingsPath || "-"}</p>
              <p>
                Expected:{" "}
                {factory
                  ? `${factory.installedCount}/${factory.selectedCount} selected (${factory.expectedCount} available)`
                  : "-"}
              </p>
            </div>
            <ScrollArea className="h-72 rounded-lg border p-2">
              <div className="space-y-2">
                {filteredFactoryModels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching models.</p>
                ) : (
                  filteredFactoryModels.map((model) => (
                    <label key={model.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={factory?.selectedIds.includes(model.id) || false}
                        onChange={(event) => void toggleFactoryModel(model.id, event.target.checked)}
                      />
                      <span>
                        <span className="font-medium">{model.displayName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {model.model} · {model.provider} · {model.id}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Config</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void droidproxy.lab.openPath("config")}>
              Open config
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><span className="text-muted-foreground">Config:</span> {config?.configPath || "-"}</p>
            <p><span className="text-muted-foreground">Auth:</span> {config?.authDir || "-"}</p>
            <p><span className="text-muted-foreground">Factory:</span> {config?.factorySettingsPath || "-"}</p>
            <p><span className="text-muted-foreground">Debug:</span> {config?.debug ? "enabled" : "disabled"}</p>
            <p>
              <span className="text-muted-foreground">CommandCode:</span>{" "}
              {config ? `${config.commandCodeApiKeyCount} keys` : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Fast mode:</span>{" "}
              {[config?.gpt54FastMode ? "gpt-5.4" : null, config?.gpt55FastMode ? "gpt-5.5" : null]
                .filter(Boolean)
                .join(", ") || "disabled"}
            </p>
            <p>
              <span className="text-muted-foreground">Timeout:</span>{" "}
              {config ? `${config.requestTimeout}, retry ${config.requestRetry}` : "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Logs</CardTitle>
            <Badge variant="secondary">{logs.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 rounded-lg border bg-muted/30 p-3">
              <pre className="font-mono text-xs whitespace-pre-wrap">{logs.join("\n")}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}