import type { IncomingMessage } from "node:http";
import { readIncomingMessageBody } from "../proxy/http";

export async function readJSONRequest(req: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readIncomingMessageBody(req);
  const text = body.toString("utf8");
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}