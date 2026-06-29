import { CLAUDE_REDACTED_THINKING_BETA, CLAUDE_VISIBLE_THINKING_BETAS } from "../constants/claude-betas";
import { envFlag } from "../config/env";
import { findHeaderName, hasEnabledThinking, isClaudeModel, isGeminiOAuthCodeAssistModel } from "./model-detection";
import { isResponsesAPIPath } from "./paths";

export function rewriteClaudeThinkingBetas(
  headers: Record<string, unknown>,
  parsedBody: Record<string, unknown> | null
): Record<string, unknown> {
  if (!parsedBody || !isClaudeModel(parsedBody.model) || !hasEnabledThinking(parsedBody)) {
    return headers;
  }

  const betaHeaderName = findHeaderName(headers, "anthropic-beta") || "anthropic-beta";
  const existing = String(headers[betaHeaderName] || "");
  const betas = existing
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value.toLowerCase() !== CLAUDE_REDACTED_THINKING_BETA);

  for (const beta of CLAUDE_VISIBLE_THINKING_BETAS) {
    if (!betas.some((value) => value.toLowerCase() === beta.toLowerCase())) {
      betas.push(beta);
    }
  }

  return { ...headers, [betaHeaderName]: betas.join(",") };
}

export function rewriteGeminiResponsesPath(requestPath: string, parsedBody: Record<string, unknown> | null): string {
  if (!parsedBody || !isGeminiOAuthCodeAssistModel(parsedBody.model)) {
    return requestPath;
  }

  const [pathname, query = ""] = requestPath.split("?", 2);
  if (pathname !== "/v1/responses" && pathname !== "/api/v1/responses") {
    return requestPath;
  }

  return `/v1/chat/completions${query ? `?${query}` : ""}`;
}

export interface FastModeResult {
  changed: boolean;
  body?: string;
  parsedBody?: Record<string, unknown>;
}

export function processOpenAIFastMode(
  requestPath: string,
  body: Buffer,
  parsedBody: Record<string, unknown> | null
): FastModeResult {
  if (!isResponsesAPIPath(requestPath) || !parsedBody || parsedBody.service_tier !== undefined) {
    return { changed: false };
  }

  const model = String(parsedBody.model || "");
  const enabled = (model === "gpt-5.4" && envFlag("DROIDPROXY_GPT54_FAST_MODE"))
    || (model === "gpt-5.5" && envFlag("DROIDPROXY_GPT55_FAST_MODE"));

  if (!enabled) {
    return { changed: false };
  }

  const source = body.toString("utf8");
  const inserted = injectTopLevelJSONField(source, `"service_tier":"priority"`);
  if (!inserted) {
    return { changed: false };
  }

  return {
    changed: true,
    body: inserted,
    parsedBody: { ...parsedBody, service_tier: "priority" }
  };
}

export function injectTopLevelJSONField(source: string, fieldSource: string): string | null {
  const openIndex = source.indexOf("{");
  if (openIndex < 0) return null;

  let i = openIndex + 1;
  while (i < source.length && /\s/.test(source[i])) i += 1;

  const needsComma = source[i] !== "}";
  return `${source.slice(0, i)}${fieldSource}${needsComma ? "," : ""}${source.slice(i)}`;
}

export function logRequestReasoning(
  parsedBody: Record<string, unknown> | null,
  onDebugLog?: (line: string) => void
): void {
  if (!parsedBody || typeof parsedBody !== "object" || !onDebugLog) return;

  const fields: Record<string, unknown> = {};
  for (const key of ["reasoning", "reasoning_effort", "thinking", "output_config", "service_tier", "generationConfig"]) {
    if (parsedBody[key] !== undefined) fields[key] = parsedBody[key];
  }

  const model = parsedBody.model || "unknown";
  const summary = Object.keys(fields).map((key) => `${key}=${JSON.stringify(fields[key])}`).join(" ");
  const line = `REQUEST REASONING: model=${model}${summary ? ` ${summary}` : ""}`;
  onDebugLog(line);
}