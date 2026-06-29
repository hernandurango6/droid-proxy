export function envFlag(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return ["1", "true", "yes", "on"].includes(String(env[name] || "").toLowerCase());
}