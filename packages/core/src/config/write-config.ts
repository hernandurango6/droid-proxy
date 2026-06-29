import fs from "fs";
import path from "path";
import { getAuthDir, getConfigPath, resolveResourcesDir } from "../constants/paths";
import { resolveBackendPort } from "../constants/ports";
import { envFlag } from "./env";

export interface WriteConfigOptions {
  rootDir: string;
  managementSecretKey: string;
  env?: NodeJS.ProcessEnv;
  backendPort?: number;
  configPath?: string;
  authDir?: string;
  templateFileName?: string;
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
  const config = renderConfigFromTemplate(template, {
    backendPort: options.backendPort ?? resolveBackendPort(env),
    managementSecretKey: options.managementSecretKey,
    debug: envFlag("DROIDPROXY_DEBUG", env),
    requestRetry: env.DROIDPROXY_REQUEST_RETRY || "3",
    requestTimeout: env.DROIDPROXY_REQUEST_TIMEOUT || "10m"
  });

  fs.writeFileSync(configPath, config);
  return configPath;
}