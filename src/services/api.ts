import { ApiResponse } from '../types';

const TOKEN_KEY = 'powerwatch_admin_jwt';
let inMemoryToken: string | null = null;

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || inMemoryToken;
  } catch {
    return inMemoryToken;
  }
}

export function setStoredToken(token: string): void {
  inMemoryToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('LocalStorage unavailable or full, persisting in-memory only.', e);
  }
}

export function clearStoredToken(): void {
  inMemoryToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors on clear
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`, {
    ...options,
    headers
  });

  const json: ApiResponse<T> = await response.json();

  if (!response.ok || !json.success) {
    const details = json.errors && json.errors.length > 0 ? ` (${json.errors.join('; ')})` : '';
    const errorMsg = `${json.message || ''}${details}`.trim() || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    (error as any).status = response.status;
    (error as any).errors = json.errors;
    throw error;
  }

  return json.data as T;
}
