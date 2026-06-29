import type { ServerResponse } from "node:http";
import { getCommandCodeAuthPath } from "../constants/paths";
import { sendJSON } from "../http/send-json";
import type { CommandCodeApiKeyRotator, CommandCodeKeySources } from "./api-keys";
import { resolveCommandCodeApiKeys } from "./api-keys";
import { openAIToCommandCode } from "./convert";
import { fetchCommandCodeWithApiKeys } from "./fetch";
import { commandCodeUpstreamModel } from "./models";
import { collectCommandCodeCompletion, streamCommandCodeAsOpenAI } from "./stream";

export interface CommandCodeRequestContext extends CommandCodeKeySources {
  apiUrl?: string;
  authPath?: string;
  rotator?: CommandCodeApiKeyRotator;
  onLog?: (message: string) => void;
  cwd?: string;
  platform?: string;
}

export async function handleCommandCodeRequest(
  parsedBody: Record<string, unknown>,
  clientRes: ServerResponse,
  ctx: CommandCodeRequestContext = {}
): Promise<void> {
  const authPath = ctx.authPath ?? getCommandCodeAuthPath();
  const apiKeys = resolveCommandCodeApiKeys({
    env: ctx.env,
    savedKeys: ctx.savedKeys,
    authPath
  });

  if (apiKeys.length === 0) {
    sendJSON(clientRes, 401, {
      error: "commandcode_auth_missing",
      message: `Set DROIDPROXY_COMMANDCODE_API_KEYS, DROIDPROXY_COMMANDCODE_API_KEY, or login with CommandCode so ${authPath} contains apiKey/apiKeys.`
    });
    return;
  }

  const upstreamModel = commandCodeUpstreamModel(parsedBody.model);
  const wantsStream = parsedBody.stream !== false;
  const commandBody = openAIToCommandCode(upstreamModel, parsedBody, true, {
    cwd: ctx.cwd,
    platform: ctx.platform
  });
  const response = await fetchCommandCodeWithApiKeys(apiKeys, JSON.stringify(commandBody), {
    apiUrl: ctx.apiUrl,
    rotator: ctx.rotator,
    onLog: ctx.onLog
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    sendJSON(clientRes, response.status || 502, {
      error: "commandcode_upstream_error",
      status: response.status,
      message: text.slice(0, 1000)
    });
    return;
  }

  if (wantsStream) {
    await streamCommandCodeAsOpenAI(response, upstreamModel, clientRes);
    return;
  }

  const completion = await collectCommandCodeCompletion(response, upstreamModel);
  sendJSON(clientRes, 200, completion);
}