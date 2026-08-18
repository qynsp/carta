import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithTelegram: (initData: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pool_jwt_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initGuestSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('pool_jwt_token', data.token);
      }
    } catch (err) {
      console.error('Guest session init failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    const currentToken = token || localStorage.getItem('pool_jwt_token');
    if (!currentToken) {
      await initGuestSession();
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
        // Token expired or invalid, re-init guest session
        localStorage.removeItem('pool_jwt_token');
        await initGuestSession();
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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pool_jwt_token');
  };

  useEffect(() => {
    // Check if running inside Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initData && tg.initData.length > 0) {
      tg.ready();
      tg.expand();
      loginWithTelegram(tg.initData);
    } else if (token) {
      refreshProfile();
    } else {
      initGuestSession();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithTelegram,
        refreshProfile,
        logout,
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
