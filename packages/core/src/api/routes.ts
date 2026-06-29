import type { IncomingMessage, ServerResponse } from "node:http";
import { parseCommandCodeApiKeys, maskApiKey } from "../config/commandcode-keys";
import { envFlag } from "../config/env";
import { LOGIN_FLAGS } from "../constants/login-flags";
import { resolveCommandCodeApiKeyEntries } from "../commandcode/api-keys";
import { sendJSON } from "../http/send-json";
import { readJSONRequest } from "./read-json";
import type { DashboardApiContext } from "./types";

export async function handleDashboardAPI(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: DashboardApiContext
): Promise<void> {
  if (req.method === "GET" && url.pathname === "/api/status") {
    sendJSON(res, 200, ctx.statusPayload());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/accounts") {
    sendJSON(res, 200, { accounts: ctx.getAccounts() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/logs") {
    sendJSON(res, 200, { logs: ctx.appLogs });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    const configuredCommandCodeKeys = resolveCommandCodeApiKeyEntries({
      env: ctx.env,
      savedKeys: ctx.getSavedCommandCodeApiKeys(),
      authPath: ctx.commandCodeAuthPath
    });
    const commandCodeKeyCount = configuredCommandCodeKeys.length;
    const savedCommandCodeKeys = ctx.getSavedCommandCodeApiKeys();
    sendJSON(res, 200, {
      configPath: ctx.configPath,
      authDir: ctx.authDir,
      commandCodeAuthPath: ctx.commandCodeAuthPath,
      commandCodeAuth: commandCodeKeyCount > 0,
      commandCodeApiKeyCount: commandCodeKeyCount,
      configuredCommandCodeApiKeys: configuredCommandCodeKeys.map((entry) => ({
        key: maskApiKey(entry.apiKey),
        source: entry.source
      })),
      savedCommandCodeApiKeyCount: savedCommandCodeKeys.length,
      savedCommandCodeApiKeys: savedCommandCodeKeys.map(maskApiKey),
      commandCodeUrl: ctx.commandCodeApiUrl,
      factorySettingsPath: ctx.factorySettingsPath,
      managementUrl: ctx.managementUrl,
      managementSecretKey: ctx.settings.managementSecretKey,
      debug: envFlag("DROIDPROXY_DEBUG", ctx.env),
      gpt54FastMode: envFlag("DROIDPROXY_GPT54_FAST_MODE", ctx.env),
      gpt55FastMode: envFlag("DROIDPROXY_GPT55_FAST_MODE", ctx.env),
      requestRetry: ctx.env.DROIDPROXY_REQUEST_RETRY || "3",
      requestTimeout: ctx.env.DROIDPROXY_REQUEST_TIMEOUT || "10m"
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/commandcode-keys") {
    const body = await readJSONRequest(req);
    const input = typeof body.keys === "string" ? body.keys : "";
    const keys = parseCommandCodeApiKeys(input);
    ctx.settings.commandCodeApiKeys = keys;
    ctx.saveSettings();
    ctx.commandCodeApiKeyRotator.reset();
    sendJSON(res, 200, {
      count: keys.length,
      keys: keys.map(maskApiKey)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/factory-models") {
    sendJSON(res, 200, ctx.factoryModelsStatus());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/factory-models/selection") {
    const body = await readJSONRequest(req);
    const ids = Array.isArray(body.ids) ? body.ids as string[] : null;
    if (!ids) {
      sendJSON(res, 400, { error: "invalid_selection" });
      return;
    }
    ctx.saveFactoryModelSelection(ids);
    sendJSON(res, 200, ctx.factoryModelsStatus());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-management") {
    ctx.openPath(ctx.managementUrl);
    sendJSON(res, 202, { opened: true, url: ctx.managementUrl });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/models") {
    try {
      const models = await ctx.fetchModels();
      sendJSON(res, 200, { models });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJSON(res, 502, { error: "models_unavailable", message, models: [] });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJSONRequest(req);
    const provider = body.provider;
    if (!provider || typeof provider !== "string" || !LOGIN_FLAGS[provider as keyof typeof LOGIN_FLAGS]) {
      sendJSON(res, 400, { error: "invalid_provider", providers: Object.keys(LOGIN_FLAGS) });
      return;
    }
    ctx.runLoginDetached(provider);
    sendJSON(res, 202, { started: true, provider });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-auth-dir") {
    ctx.openPath(ctx.authDir);
    sendJSON(res, 202, { opened: true, path: ctx.authDir });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-config") {
    ctx.writeConfig();
    ctx.openPath(ctx.configPath);
    sendJSON(res, 202, { opened: true, path: ctx.configPath });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/apply-factory-models") {
    const result = ctx.applyFactoryCustomModels();
    sendJSON(res, 200, result);
    return;
  }

  sendJSON(res, 404, { error: "not_found" });
}