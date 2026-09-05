import { apiRequest, setStoredToken, clearStoredToken, getStoredToken } from './api';
import { AdminUser, AuthResponse } from '../types';

export const authService = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const data = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data && data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async getCurrentUser(): Promise<AdminUser | null> {
    const token = getStoredToken();
    if (!token) return null;
    try {
      const user = await apiRequest<AdminUser>('/auth/me');
      return user;
    } catch {
      clearStoredToken();
      return null;
    }
  },

  logout(): void {
    clearStoredToken();
  },

  isAuthenticated(): boolean {
    return Boolean(getStoredToken());
  }
};
