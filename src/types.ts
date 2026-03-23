export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiRequest {
  id: string;
  name?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  bodyType: 'none' | 'json' | 'text' | 'xml';
  body: string;
  timestamp: number;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  time: number;
  size: number;
  data: any;
  headers: Record<string, string>;
  error?: string;
}
