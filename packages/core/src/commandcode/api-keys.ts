import fs from "node:fs";
import { parseCommandCodeApiKeys } from "../config/commandcode-keys";
import { getCommandCodeAuthPath } from "../constants/paths";

export interface CommandCodeApiKeyEntry {
  apiKey: string;
  source: string;
}

export interface CommandCodeKeySources {
  env?: NodeJS.ProcessEnv;
  savedKeys?: string[];
  authPath?: string;
}

function addCommandCodeApiKeyEntries(
  entries: CommandCodeApiKeyEntry[],
  value: unknown,
  source: string
): void {
  for (const apiKey of parseCommandCodeApiKeys(value)) {
    entries.push({ apiKey, source });
  }
}

export function resolveCommandCodeApiKeyEntries(sources: CommandCodeKeySources = {}): CommandCodeApiKeyEntry[] {
  const env = sources.env ?? process.env;
  const authPath = sources.authPath ?? getCommandCodeAuthPath();
  const entries: CommandCodeApiKeyEntry[] = [];

  addCommandCodeApiKeyEntries(entries, env.DROIDPROXY_COMMANDCODE_API_KEYS, "Environment");
  addCommandCodeApiKeyEntries(entries, env.COMMANDCODE_API_KEYS, "Environment");
  addCommandCodeApiKeyEntries(entries, env.DROIDPROXY_COMMANDCODE_API_KEY, "Environment");
  addCommandCodeApiKeyEntries(entries, env.COMMANDCODE_API_KEY, "Environment");

  for (const apiKey of sources.savedKeys ?? []) {
    addCommandCodeApiKeyEntries(entries, apiKey, "Dashboard");
  }

  try {
    const auth = JSON.parse(fs.readFileSync(authPath, "utf8")) as {
      apiKeys?: unknown;
      apiKey?: unknown;
    };
    if (Array.isArray(auth?.apiKeys)) {
      for (const apiKey of auth.apiKeys) {
        addCommandCodeApiKeyEntries(entries, apiKey, "CommandCode auth");
      }
    }
    addCommandCodeApiKeyEntries(entries, auth?.apiKey, "CommandCode auth");
  } catch {
    // Missing auth file is fine when other key sources are configured.
  }

  const unique = new Map<string, CommandCodeApiKeyEntry>();
  for (const entry of entries) {
    if (!unique.has(entry.apiKey)) unique.set(entry.apiKey, entry);
  }
  return [...unique.values()];
}

export function resolveCommandCodeApiKeys(sources: CommandCodeKeySources = {}): string[] {
  return resolveCommandCodeApiKeyEntries(sources).map((entry) => entry.apiKey);
}

export class CommandCodeApiKeyRotator {
  private index = 0;

  next(apiKeys: string[]): { apiKey: string; index: number } {
    const selected = this.index % apiKeys.length;
    this.index = (this.index + 1) % apiKeys.length;
    return { apiKey: apiKeys[selected], index: selected };
  }

  reset(): void {
    this.index = 0;
  }
}