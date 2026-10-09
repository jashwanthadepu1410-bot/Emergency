import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Siren,
  Shield,
  Hospital,
  Activity,
  ArrowRight,
  Radio,
  Zap,
  Globe,
  Layers,
  MapPin,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const Landing: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sectors = [
    {
      role: 'driver' as UserRole,
      title: 'Ambulance Sector',
      desc: 'Activate Emergency Mode, track live route navigation, select hospitals, and receive AI reroute recommendations.',
      path: '/ambulance',
      icon: <Siren className="w-7 h-7" />,
      color: 'from-red-600 to-rose-600',
      border: 'border-red-500/40 hover:border-red-500/80',
      bg: 'bg-red-950/30',
      features: ['GPS Live Tracking', 'Hospital Selection', 'AI Alternate Routing', 'Junction Status Feed']
    },
    {
      role: 'police' as UserRole,
      title: 'Police Sector',
      desc: 'Receive real-time emergency dispatch alerts, manage junction clearances, and coordinate green corridor operations.',
      path: '/police',
      icon: <Shield className="w-7 h-7" />,
      color: 'from-blue-600 to-indigo-600',
      border: 'border-blue-500/40 hover:border-blue-500/80',
      bg: 'bg-blue-950/30',
      features: ['Live Ambulance Map', 'Junction Clearance', 'Route Change Alerts', 'Feedback Submission']
    },
    {
      role: 'hospital' as UserRole,
      title: 'Hospital Sector',
      desc: 'Receive incoming patient alerts, prepare ER teams with 5-stage readiness workflow, and track ambulance ETA.',
      path: '/hospital',
      icon: <Hospital className="w-7 h-7" />,
      color: 'from-emerald-600 to-teal-600',
      border: 'border-emerald-500/40 hover:border-emerald-500/80',
      bg: 'bg-emerald-950/30',
      features: ['Patient Incoming Alert', 'ER Team Preparation', 'Live ETA Countdown', 'Capacity Management']
    },
    {
      role: 'admin' as UserRole,
      title: 'Central Command',
      desc: 'System-wide oversight with configurable timeouts, fleet telemetry, junction analytics, and real-time audit logs.',
      path: '/admin',
      icon: <Activity className="w-7 h-7" />,
      color: 'from-amber-600 to-orange-600',
      border: 'border-amber-500/40 hover:border-amber-500/80',
      bg: 'bg-amber-950/30',
      features: ['System Telemetry', 'Timeout Configuration', 'Audit Log Feed', 'Fleet Management']
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="relative w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shadow-xl">
            <Siren className="w-9 h-9 text-red-500 animate-pulse" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full animate-ping" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-400 to-amber-400">
          EMERGENCY X
        </h1>
        <p className="text-lg text-slate-300 font-medium max-w-2xl mx-auto">
          AI-Powered Emergency Traffic Coordination System
        </p>
        <p className="text-sm text-slate-500 font-semibold tracking-wide italic">
          "Because Every Second Matters."
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-navy-900/80 border border-navy-800 rounded-xl text-xs text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Real-Time Socket Sync</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-navy-900/80 border border-navy-800 rounded-xl text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Interactive Leaflet Maps</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-navy-900/80 border border-navy-800 rounded-xl text-xs text-slate-300">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>Rule-Based Traffic AI Engine</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-navy-900/80 border border-navy-800 rounded-xl text-xs text-slate-300">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>3-Sector Multi-Agency Coordination</span>
          </div>
        </div>
      </div>

      {/* Sector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sectors.map((sector) => {
          const isCurrentRole = user?.role === sector.role || user?.role === 'admin';

          return (
            <button
              key={sector.role}
              onClick={() => navigate(sector.path)}
              className={`group relative overflow-hidden text-left p-6 rounded-3xl border-2 transition-all duration-300 shadow-xl hover:shadow-2xl ${sector.border} ${sector.bg}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${sector.color} opacity-60 group-hover:opacity-100 transition`} />

              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-2xl bg-navy-900/80 border border-navy-800 shadow-lg text-white group-hover:scale-110 transition-transform">
                  {sector.icon}
                </div>
                {isCurrentRole && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Your Role
                  </span>
                )}
              </div>

              <h3 className="text-lg font-black text-white mb-1.5">{sector.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{sector.desc}</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {sector.features.map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center space-x-1.5 text-[11px] text-slate-300 bg-navy-900/60 px-2 py-1 rounded-lg border border-navy-800/60"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 group-hover:text-white transition">
                <span>Enter {sector.title} Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {/* How It Works */}
      <div className="bg-navy-900/60 border border-navy-800 rounded-3xl p-6 shadow-xl">
        <h3 className="text-sm font-black uppercase tracking-wider text-center text-slate-300 mb-6">
          End-to-End Emergency Corridor Workflow
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
          {[
            { step: '1', title: 'Pickup & Activate', icon: <MapPin className="w-5 h-5 text-red-400" />, desc: 'Driver reaches patient, selects hospital, activates Emergency Mode' },
            { step: '2', title: 'Police Clear Route', icon: <Shield className="w-5 h-5 text-blue-400" />, desc: 'Officers receive alerts, clear junctions, or report obstructions' },
            { step: '3', title: 'AI Reroute Engine', icon: <Zap className="w-5 h-5 text-purple-400" />, desc: 'Traffic evaluation triggers alternate bypass when corridors are blocked' },
            { step: '4', title: 'Hospital Receives', icon: <Hospital className="w-5 h-5 text-emerald-400" />, desc: 'ER team prepares through 5-stage readiness, patient handoff confirmed' }
          ].map((item) => (
            <div key={item.step} className="bg-navy-950/60 p-4 rounded-2xl border border-navy-800 space-y-2">
              <div className="w-10 h-10 mx-auto rounded-xl bg-navy-800 flex items-center justify-center border border-navy-700 shadow">
                {item.icon}
              </div>
              <div className="text-xs font-bold text-white">{item.title}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
