export function isModelsPath(requestPath: string): boolean {
  const pathname = String(requestPath || "").split("?", 1)[0];
  return pathname === "/v1/models" || pathname === "/api/v1/models";
}

export function isChatCompletionsPath(requestPath: string): boolean {
  const pathname = String(requestPath || "").split("?", 1)[0];
  return pathname === "/v1/chat/completions" || pathname === "/api/v1/chat/completions";
}

export function isResponsesAPIPath(requestPath: string): boolean {
  const pathname = String(requestPath || "").split("?", 1)[0];
  return pathname === "/v1/responses" || pathname === "/api/v1/responses";
}