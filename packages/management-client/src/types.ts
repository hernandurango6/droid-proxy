export interface ManagementClientOptions {
  baseUrl: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface ManagementRequestInit {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ManagementResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  text: string;
}

export interface AuthFileItem {
  name: string;
  type?: string;
  disabled?: boolean;
  auth_index?: string;
  authIndex?: string;
  email?: string;
  login?: string;
  [key: string]: unknown;
}

export interface ApiCallRequest {
  authIndex: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
  timeoutMs?: number;
}

export interface ApiCallResult {
  statusCode: number;
  body?: unknown;
  bodyText?: string;
  header?: Record<string, string[]>;
  error?: string;
}

export interface ManagementVersionInfo {
  version?: string;
  [key: string]: unknown;
}