import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../api/client';
import { authApi } from '../../api/endpoints';
import type { RegisterRequest, User } from '../../api/schema';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session of this tab; a 401 clears the token (see ApiClient).
  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    authApi
      .me({ silent: true })
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        setAccessToken(token);
      })
      .catch(() => {
        api.setToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback((response: { accessToken: string; user: User }) => {
    api.setToken(response.accessToken);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      startSession(await authApi.login({ email, password }));
    },
    [startSession]
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      startSession(await authApi.register(data));
    },
    [startSession]
  );

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
    setAccessToken(null);
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, isAuthenticated: !!user, loading, login, register, logout }),
    [user, accessToken, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
