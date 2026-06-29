import { COMMANDCODE_MODELS } from "../constants/commandcode-models";

export function isCommandCodeModel(model: unknown): boolean {
  const value = String(model || "").toLowerCase();
  return value.startsWith("commandcode:") || value.startsWith("cmc:");
}

export function commandCodeUpstreamModel(model: unknown): string {
  const value = String(model || "");
  if (value.toLowerCase().startsWith("commandcode:")) return value.slice("commandcode:".length);
  if (value.toLowerCase().startsWith("cmc:")) return value.slice("cmc:".length);
  return value;
}

export function commandCodeOpenAIModels(): Array<Record<string, unknown>> {
  const now = Math.floor(Date.now() / 1000);
  return COMMANDCODE_MODELS.map((model) => ({
    id: `commandcode:${model.id}`,
    object: "model",
    created: now,
    owned_by: "commandcode"
  }));
}

export function commandCodeSlug(id: unknown): string {
  return String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}