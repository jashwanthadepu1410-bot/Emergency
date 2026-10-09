import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Siren,
  Shield,
  Hospital,
  Activity,
  LogOut,
  Radio,
  Wifi,
  WifiOff,
  History,
  Sliders
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import { UserRole } from '../types';

export const Navbar: React.FC = () => {
  const { user, logout, quickSwitchPersona } = useAuth();
  const location = useLocation();
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    setSocketConnected(s.connected);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const roles: { role: UserRole; label: string; icon: React.ReactNode; path: string }[] = [
    { role: 'driver', label: 'Ambulance', icon: <Siren className="w-4 h-4 text-red-400" />, path: '/ambulance' },
    { role: 'police', label: 'Police', icon: <Shield className="w-4 h-4 text-blue-400" />, path: '/police' },
    { role: 'hospital', label: 'Hospital', icon: <Hospital className="w-4 h-4 text-emerald-400" />, path: '/hospital' },
    { role: 'admin', label: 'Command', icon: <Sliders className="w-4 h-4 text-amber-400" />, path: '/admin' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-navy-900/90 backdrop-blur-md border-b border-navy-800 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 text-red-500 shadow-lg group-hover:scale-105 transition-transform">
              <Siren className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-400 to-amber-400">
                  EMERGENCY X
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20 rounded">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-wide font-medium">
                Because Every Second Matters
              </p>
            </div>
          </Link>

          {/* Quick Persona Switcher */}
          <div className="hidden md:flex items-center space-x-1.5 bg-navy-950/80 p-1 rounded-xl border border-navy-800">
            {roles.map((r) => {
              const isCurrent = user?.role === r.role;
              return (
                <button
                  key={r.role}
                  onClick={() => quickSwitchPersona(r.role)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-navy-800 text-white shadow border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900/60'
                  }`}
                  title={`Switch to ${r.label} Sector`}
                >
                  {r.icon}
                  <span>{r.label}</span>
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Status & Controls */}
          <div className="flex items-center space-x-4">
            {/* Live Socket Status */}
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                socketConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
              title={socketConnected ? 'Connected to Real-Time Grid' : 'Disconnected from Real-Time Grid'}
            >
              {socketConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">LIVE SYNC</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">OFFLINE</span>
                </>
              )}
            </div>

            {/* History Link */}
            <Link
              to="/history"
              className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition ${
                location.pathname === '/history' ? 'bg-navy-800 text-white' : ''
              }`}
              title="Emergency History & Audit"
            >
              <History className="w-4 h-4" />
            </Link>

            {/* User Profile / Logout */}
            {user ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-navy-800">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {user.role} {user.jurisdiction ? `• ${user.jurisdiction}` : ''}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg bg-navy-800/80 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-navy-700 transition"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-md transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
