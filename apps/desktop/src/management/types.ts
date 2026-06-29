export interface ManagementFormField {
  name: string;
  filename?: string;
  content_type?: string;
  data_base64: string;
}

export interface ManagementRequest {
  method: string;
  path: string;
  body?: unknown;
  form?: ManagementFormField[];
}

export interface ManagementResponse {
  status: number;
  body: unknown;
  error?: string;
}