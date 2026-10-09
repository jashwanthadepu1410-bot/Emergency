import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren, Shield, Hospital, Activity, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail: string, userRole: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await login(userEmail);
      const rolePathMap: Record<UserRole, string> = {
        driver: '/ambulance',
        police: '/police',
        hospital: '/hospital',
        admin: '/admin'
      };
      navigate(rolePathMap[userRole] || '/');
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  const personas = [
    {
      role: 'driver' as UserRole,
      title: 'Ambulance Sector',
      subtitle: 'Driver: Rajesh Sharma (AMB-101)',
      email: 'driver@emergencyx.com',
      icon: <Siren className="w-6 h-6 text-red-400" />,
      color: 'border-red-500/30 hover:border-red-500/60 bg-red-950/20',
      tag: 'Ambulance Driver'
    },
    {
      role: 'police' as UserRole,
      title: 'Police Sector',
      subtitle: 'Inspector Vikram Vance (Downtown Zone 1)',
      email: 'police@emergencyx.com',
      icon: <Shield className="w-6 h-6 text-blue-400" />,
      color: 'border-blue-500/30 hover:border-blue-500/60 bg-blue-950/20',
      tag: 'Traffic Police'
    },
    {
      role: 'hospital' as UserRole,
      title: 'Hospital Sector',
      subtitle: 'Dr. Elena Rostova (City General Hospital)',
      email: 'hospital@emergencyx.com',
      icon: <Hospital className="w-6 h-6 text-emerald-400" />,
      color: 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-950/20',
      tag: 'ER Medical Team'
    },
    {
      role: 'admin' as UserRole,
      title: 'Command & Admin',
      subtitle: 'Central Dispatch Command Center',
      email: 'admin@emergencyx.com',
      icon: <Activity className="w-6 h-6 text-amber-400" />,
      color: 'border-amber-500/30 hover:border-amber-500/60 bg-amber-950/20',
      tag: 'System Administrator'
    }
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Left: Quick Persona Switcher for Instant Testing */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              1-Click Testing Access
            </div>
            <h2 className="text-xl font-black text-white">Select Sector Persona</h2>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Instantly authenticate as any authorized sector to experience multi-agency emergency coordination.
            </p>

            <div className="space-y-3">
              {personas.map((p) => (
                <button
                  key={p.role}
                  onClick={() => handleQuickLogin(p.email, p.role)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-200 group ${p.color}`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="p-2.5 rounded-xl bg-navy-900 border border-slate-700/60 group-hover:scale-105 transition-transform">
                      {p.icon}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-200">{p.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-navy-950/80 text-slate-400 border border-navy-800">
                          {p.tag}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {p.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-navy-800 text-[11px] text-slate-500 text-center">
            Password for all demo accounts: <code className="text-slate-300 font-mono">driver123 / police123 / hospital123 / admin123</code>
          </div>
        </div>

        {/* Right: Traditional Email/Password Login */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white tracking-tight">Sign In to Emergency X</h2>
            <p className="text-xs text-slate-400 mt-1">
              Authorized emergency services coordination portal
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="driver@emergencyx.com"
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-navy-950 border border-navy-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-4 py-2.5 bg-navy-950 border border-navy-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-sm text-slate-100 placeholder-slate-600 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-950 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Authenticate & Enter Grid</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
