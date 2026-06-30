import fs from "fs";
import path from "path";
import { getAuthDir, getConfigPath, resolveResourcesDir } from "../constants/paths";
import { resolveBackendPort } from "../constants/ports";
import { envFlag } from "./env";
import {
  normalizeOpenAICompatibleProviders,
  renderOpenAICompatibilityYaml,
  type OpenAICompatibleProvider
} from "./openai-compatible";

export interface WriteConfigOptions {
  rootDir: string;
  managementSecretKey: string;
  env?: NodeJS.ProcessEnv;
  backendPort?: number;
  configPath?: string;
  authDir?: string;
  templateFileName?: string;
  openAICompatibleProviders?: OpenAICompatibleProvider[];
}

export function renderConfigFromTemplate(
  template: string,
  options: {
    backendPort: number;
    managementSecretKey: string;
    debug: boolean;
    requestRetry: string;
    requestTimeout: string;
  }
): string {
  return template
    .replaceAll("__BACKEND_PORT__", String(options.backendPort))
    .replaceAll("__MANAGEMENT_SECRET_KEY__", options.managementSecretKey)
    .replaceAll("__DEBUG__", String(options.debug))
    .replaceAll("__REQUEST_RETRY__", options.requestRetry)
    .replaceAll("__REQUEST_TIMEOUT__", options.requestTimeout);
}

export function mergePreservedYamlBlocks(
  renderedConfig: string,
  existingConfig: string,
  managedKeys: string[] = []
): string {
  const renderedKeys = topLevelYamlKeys(renderedConfig);
  for (const key of managedKeys) renderedKeys.add(key);
  const preservedBlocks = topLevelYamlBlocks(existingConfig)
    .filter((block) => !renderedKeys.has(block.key))
    .map((block) => block.text.trimEnd())
    .filter(Boolean);

  const rendered = renderedConfig.trimEnd();
  if (preservedBlocks.length === 0) return `${rendered}\n`;
  return `${rendered}\n${preservedBlocks.join("\n")}\n`;
}

function topLevelYamlKeys(config: string): Set<string> {
  return new Set(topLevelYamlBlocks(config).map((block) => block.key));
}

function topLevelYamlBlocks(config: string): Array<{ key: string; text: string }> {
  const lines = config.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<{ key: string; text: string }> = [];
  let current: { key: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = /^([A-Za-z0-9_-]+):(?:\s|$)/.exec(line);
    if (match) {
      if (current) {
        blocks.push({ key: current.key, text: current.lines.join("\n") });
      }
      current = { key: match[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push({ key: current.key, text: current.lines.join("\n") });
  }
  return blocks;
}

export function writeConfig(options: WriteConfigOptions): string {
  const env = options.env ?? process.env;
  const authDir = options.authDir ?? getAuthDir();
  const configPath = options.configPath ?? getConfigPath();
  const templatePath = path.join(
    resolveResourcesDir(options.rootDir, env),
    options.templateFileName ?? "config.template.yaml"
  );

  fs.mkdirSync(authDir, { recursive: true });

  const template = fs.readFileSync(templatePath, "utf8");
  const renderedBaseConfig = renderConfigFromTemplate(template, {
    backendPort: options.backendPort ?? resolveBackendPort(env),
    managementSecretKey: options.managementSecretKey,
    debug: envFlag("DROIDPROXY_DEBUG", env),
    requestRetry: env.DROIDPROXY_REQUEST_RETRY || "3",
    requestTimeout: env.DROIDPROXY_REQUEST_TIMEOUT || "10m"
  });
  const providerYaml = renderOpenAICompatibilityYaml(
    normalizeOpenAICompatibleProviders(options.openAICompatibleProviders)
  );
  const renderedConfig = providerYaml
    ? `${renderedBaseConfig.trimEnd()}\n${providerYaml}`
    : renderedBaseConfig;
  const existingConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const managedKeys = options.openAICompatibleProviders !== undefined ? ["openai-compatibility"] : [];
  const config = existingConfig
    ? mergePreservedYamlBlocks(renderedConfig, existingConfig, managedKeys)
    : `${renderedConfig.trimEnd()}\n`;

  fs.writeFileSync(configPath, config);
  return configPath;
}
