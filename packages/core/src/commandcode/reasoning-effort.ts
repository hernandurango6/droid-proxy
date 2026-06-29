import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function normalizeCommandCodeEffort(value: unknown): string {
  const text = String(value || "").toLowerCase();
  return ["low", "medium", "high", "xhigh", "max"].includes(text) ? text : "";
}

export function commandCodeConfiguredEfforts(): Record<string, unknown> {
  try {
    const configPath = path.join(os.homedir(), ".commandcode", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      reasoningEffort?: Record<string, unknown>;
    };
    return config && typeof config.reasoningEffort === "object" ? config.reasoningEffort : {};
  } catch {
    return {};
  }
}

export function commandCodeReasoningEffort(model: string, body: Record<string, unknown>): string {
  const reasoning = body.reasoning as { effort?: unknown } | undefined;
  const thinking = body.thinking as { effort?: unknown; budget?: unknown } | undefined;
  const explicit = normalizeCommandCodeEffort(
    body.reasoning_effort
    || body.reasoningEffort
    || reasoning?.effort
    || thinking?.effort
    || thinking?.budget
  );
  if (explicit) return explicit;

  const configured = commandCodeConfiguredEfforts();
  return normalizeCommandCodeEffort(configured[model]);
}