import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

export async function readIncomingMessageBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export function requestJSON({
  host,
  port,
  path: requestPath,
  timeoutMs
}: {
  host: string;
  port: number;
  path: string;
  timeoutMs: number;
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path: requestPath, method: "GET", timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });
    req.end();
  });
}

export function forwardRequest({
  host,
  port,
  method,
  path: requestPath,
  headers,
  body,
  clientRes
}: {
  host: string;
  port: number;
  method?: string;
  path: string;
  headers: Record<string, unknown>;
  body: Buffer;
  clientRes: ServerResponse;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upstreamReq = http.request({
      host,
      port,
      method,
      path: requestPath,
      headers: headers as http.OutgoingHttpHeaders
    }, (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.statusMessage, upstreamRes.headers);
      upstreamRes.pipe(clientRes);
      upstreamRes.on("end", resolve);
    });

    upstreamReq.on("error", reject);
    if (body.length > 0) {
      upstreamReq.write(body);
    }
    upstreamReq.end();
  });
}