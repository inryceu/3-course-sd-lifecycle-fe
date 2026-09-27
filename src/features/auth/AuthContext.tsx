import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../../api/client';
import { authApi } from '../../api/endpoints';
import type { User } from '../../types';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!token || !refreshToken) {
      setLoading(false);
      return;
    }

    try {
      api.setToken(token);
      const profile = await authApi.getProfile();
      setUser(profile);
      setAccessToken(token);
    } catch {
      api.setToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, password: string) => {
    const { accessToken: newAccessToken, refreshToken } = await authApi.login({ email, password });
    api.setToken(newAccessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const profile = await authApi.getProfile();
    setUser(profile);
    setAccessToken(newAccessToken);
  };

  const register = async (data: { email: string; password: string; displayName: string }) => {
    const { accessToken: newAccessToken, refreshToken } = await authApi.register(data);
    api.setToken(newAccessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const profile = await authApi.getProfile();
    setUser(profile);
    setAccessToken(newAccessToken);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      api.setToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isAuthenticated: !!user, loading, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}