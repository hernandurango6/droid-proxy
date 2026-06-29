export interface ManagementRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ManagementResponse {
  status: number;
  body: unknown;
  error?: string;
}