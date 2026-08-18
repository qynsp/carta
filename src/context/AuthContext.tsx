import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithTelegram: (initData: string) => Promise<void>;
  switchDevUser: (userId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
  devPersonas: Array<{ id: string; username: string; firstName: string; role: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pool_jwt_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [devPersonas, setDevPersonas] = useState<Array<{ id: string; username: string; firstName: string; role: string }>>([]);

  const fetchDevPersonas = async () => {
    try {
      const res = await fetch('/api/auth/dev-personas');
      if (res.ok) {
        const data = await res.json();
        setDevPersonas(data.personas || []);
      }
    } catch (e) {
      console.error('Failed to load personas:', e);
    }
  };

  const refreshProfile = async () => {
    const currentToken = token || localStorage.getItem('pool_jwt_token');
    if (!currentToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token expired or invalid, auto-login with default demo user in dev
        await switchDevUser('u-dawit-101');
      }
    } catch (err) {
      console.error('Profile refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithTelegram = async (initData: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('pool_jwt_token', data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const switchDevUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/dev-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('pool_jwt_token', data.token);
      }
    } catch (err) {
      console.error('Dev switch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pool_jwt_token');
  };

  useEffect(() => {
    fetchDevPersonas();

    // Check if running inside Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initData && tg.initData.length > 0) {
      tg.ready();
      tg.expand();
      loginWithTelegram(tg.initData);
    } else {
      // Default to Dawit or stored token
      if (!token) {
        switchDevUser('u-dawit-101');
      } else {
        refreshProfile();
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithTelegram,
        switchDevUser,
        refreshProfile,
        logout,
        devPersonas,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
