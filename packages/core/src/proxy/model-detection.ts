export function hasEnabledThinking(parsedBody: Record<string, unknown> | null): boolean {
  const thinking = parsedBody?.thinking as { type?: unknown } | undefined;
  const type = thinking?.type;
  return ["enabled", "adaptive", "auto"].includes(String(type || "").toLowerCase());
}

export function isClaudeModel(model: unknown): boolean {
  const value = String(model || "");
  return value.startsWith("claude-") || value.startsWith("gemini-claude-");
}

export function isGeminiOAuthCodeAssistModel(model: unknown): boolean {
  const value = String(model || "");
  return value.startsWith("gemini-") && value.endsWith("-preview");
}

export function findHeaderName(headers: Record<string, unknown>, targetLower: string): string | undefined {
  return Object.keys(headers).find((name) => name.toLowerCase() === targetLower);
}