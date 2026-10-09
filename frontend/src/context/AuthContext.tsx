import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { joinRoleRoom } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  quickSwitchPersona: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('emergency_x_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
          joinRoleRoom(res.user.role, res.user.ambulance_id || res.user.hospital_id);
        } catch (err) {
          console.error('Failed to restore session:', err);
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password = 'password123') => {
    setLoading(true);
    try {
      // Default demo passwords if not provided
      let pwd = password;
      if (email === 'driver@emergencyx.com') pwd = 'driver123';
      else if (email === 'police@emergencyx.com') pwd = 'police123';
      else if (email === 'hospital@emergencyx.com') pwd = 'hospital123';
      else if (email === 'admin@emergencyx.com') pwd = 'admin123';

      const res = await api.login(email, pwd);
      localStorage.setItem('emergency_x_token', res.token);
      setToken(res.token);
      setUser(res.user);
      joinRoleRoom(res.user.role, res.user.ambulance_id || res.user.hospital_id);
    } finally {
      setLoading(false);
    }
  };

  const quickSwitchPersona = async (role: UserRole) => {
    const roleEmailMap: Record<UserRole, string> = {
      driver: 'driver@emergencyx.com',
      police: 'police@emergencyx.com',
      hospital: 'hospital@emergencyx.com',
      admin: 'admin@emergencyx.com'
    };
    await login(roleEmailMap[role]);
  };

  const logout = () => {
    localStorage.removeItem('emergency_x_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, quickSwitchPersona }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
