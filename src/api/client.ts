import toast from 'react-hot-toast';
import { tokenStorage } from './token-storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/** Endpoints where a 401 means "wrong credentials" and must not trigger a redirect. */
const AUTH_ENTRY_POINTS = ['/auth/login', '/auth/register'];

interface ErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
}

export interface RequestOptions {
  /** Do not show the global error toast (the caller renders the error itself). */
  silent?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join(', '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

function toMessages(body: ErrorBody | null, status: number): string[] {
  const message = body?.message;
  if (Array.isArray(message) && message.length > 0) return message;
  if (typeof message === 'string' && message) return [message];
  return [`HTTP ${status}`];
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.accessToken = tokenStorage.get();
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      tokenStorage.set(token);
    } else {
      tokenStorage.clear();
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit = {},
    options: RequestOptions = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, { ...init, headers });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ErrorBody | null;
      const messages = toMessages(body, response.status);

      if (response.status === 401 && !AUTH_ENTRY_POINTS.includes(endpoint.split('?')[0])) {
        this.setToken(null);
        window.location.href = '/login';
        throw new ApiError(401, ['Unauthorized']);
      }

      if (!options.silent) {
        toast.error(messages.join('\n'));
      }
      throw new ApiError(response.status, messages);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { method: 'GET' }, options);
  }

  post<T>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return this.request<T>(
      endpoint,
      { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) },
      options
    );
  }

  put<T>(endpoint: string, data: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }, options);
  }

  patch<T>(endpoint: string, data: unknown, options?: RequestOptions) {
    return this.request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }, options);
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { method: 'DELETE' }, options);
  }
}

export const api = new ApiClient(API_BASE_URL);
