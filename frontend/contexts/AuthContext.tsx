'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

interface User {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  role: string;
  active: boolean;
  created_at: string;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setAuthFromTokens: (accessToken: string, refreshToken: string) => Promise<void>;
}

interface RegisterData {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('access_token');

      if (storedUser && accessToken) {
        setUser(JSON.parse(storedUser));

        // Validate token by fetching profile
        try {
          const response = await axios.get(`${API_BASE}/auth/profile`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          setUser(response.data.data);
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('user');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      }

      setIsLoading(false);
    };

    loadUser();
  }, []);

  // Setup axios interceptor for auth token
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email,
      password,
    });

    const { user: userData, tokens } = response.data.data;

    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);

    setUser(userData);
    router.push('/');
  };

  const register = async (data: RegisterData) => {
    const response = await axios.post(`${API_BASE}/auth/register`, data);

    const { user: userData, tokens } = response.data.data;

    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);

    setUser(userData);
    router.push('/');
  };

  const logout = async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        await axios.post(
          `${API_BASE}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      }
    } catch (error) {
      // Ignore logout errors
    }

    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    setUser(null);
    router.push('/login');
  };

  const setAuthFromTokens = async (accessToken: string, refreshTokenStr: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshTokenStr);

    try {
      const response = await axios.get(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = response.data.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch {
      // fallback — at least mark as authenticated
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      throw new Error('Failed to fetch profile');
    }
  };

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await axios.post(`${API_BASE}/auth/refresh`, {
      refresh_token: refreshToken,
    });

    const { access_token } = response.data.data;
    localStorage.setItem('access_token', access_token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshToken,
        setAuthFromTokens,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
