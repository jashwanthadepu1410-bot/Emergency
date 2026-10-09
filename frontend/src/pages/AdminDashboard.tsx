import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Activity,
  CheckCircle2,
  Clock,
  Shield,
  Hospital,
  Siren,
  Save,
  RefreshCw,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable config states
  const [policeTimeout, setPoliceTimeout] = useState('30');
  const [hospitalTimeout, setHospitalTimeout] = useState('45');
  const [rerouteThreshold, setRerouteThreshold] = useState('60');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminOverview();
  }, []);

  const fetchAdminOverview = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOverview();
      setData(res);
      if (res.systemConfig) {
        if (res.systemConfig.police_timeout_seconds) setPoliceTimeout(res.systemConfig.police_timeout_seconds);
        if (res.systemConfig.hospital_timeout_seconds) setHospitalTimeout(res.systemConfig.hospital_timeout_seconds);
        if (res.systemConfig.traffic_reroute_savings_threshold_seconds) {
          setRerouteThreshold(res.systemConfig.traffic_reroute_savings_threshold_seconds);
        }
      }
    } catch (err) {
      console.error('Error fetching admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateAdminConfig('police_timeout_seconds', policeTimeout);
      await api.updateAdminConfig('hospital_timeout_seconds', hospitalTimeout);
      await api.updateAdminConfig('traffic_reroute_savings_threshold_seconds', rerouteThreshold);
      setSavedMessage('System parameters updated successfully!');
      setTimeout(() => setSavedMessage(null), 3500);
      fetchAdminOverview();
    } catch (err: any) {
      alert(`Config save failed: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Admin Header */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Sliders className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">Emergency X Central Command</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                SYSTEM ADMINISTRATOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live telemetry, timeout thresholds, AI decision policies, and system audit logs.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAdminOverview}
          className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-navy-700 flex items-center space-x-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Emergencies</span>
            <Siren className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {data?.metrics?.activeEmergencies || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Live in transit</div>
        </div>

        <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Ambulance Fleet</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {data?.metrics?.totalAmbulances || 3}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            {data?.metrics?.inServiceAmbulances || 0} in active emergency
          </div>
        </div>

        <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Junction Clear Rate</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-2">
            {data?.metrics?.clearanceRatePercent || 100}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.metrics?.clearedJunctions || 0} cleared checkpoints
          </div>
        </div>

        <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Completed Missions</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono mt-2">
            {data?.metrics?.totalCompleted || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Safe hospital handoffs</div>
        </div>
      </div>

      {/* 2-Column: Configuration Panel + Real-Time Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Configuration Form */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>⚙️ Configurable System Thresholds</span>
            </h3>
            {savedMessage && (
              <span className="text-xs text-emerald-400 font-semibold animate-pulse">
                {savedMessage}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Police Junction Response Timeout (Seconds)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Triggers automatic "No Response" status and initiates AI Traffic Evaluation if police officer does not respond within this window.
              </p>
              <input
                type="number"
                min="10"
                max="300"
                value={policeTimeout}
                onChange={(e) => setPoliceTimeout(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-navy-800 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hospital Alert Acknowledgment Timeout (Seconds)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Triggers escalation warnings on hospital dashboards if emergency alert is not acknowledged.
              </p>
              <input
                type="number"
                min="15"
                max="300"
                value={hospitalTimeout}
                onChange={(e) => setHospitalTimeout(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-navy-800 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                AI Traffic Reroute Savings Threshold (Seconds)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Minimum travel time savings required before the rule-based traffic engine recommends switching to the alternate bypass route.
              </p>
              <input
                type="number"
                min="20"
                max="600"
                value={rerouteThreshold}
                onChange={(e) => setRerouteThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-navy-950 border border-navy-800 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save System Thresholds</span>
            </button>
          </form>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Real-Time Audit Log Feed</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {data?.recentLogs?.length || 0} Recent Events
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {data?.recentLogs?.map((log: any) => (
              <div
                key={log.id}
                className="p-3 rounded-2xl bg-navy-950/70 border border-navy-800/80 text-xs text-slate-300 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-navy-800 text-amber-400 border border-slate-700 font-mono">
                    {log.event_type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {log.created_at}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium">
                  {log.details}
                </div>
                {log.actor_role && (
                  <div className="text-[10px] text-slate-500">
                    Role: <span className="text-slate-400 uppercase">{log.actor_role}</span>
                  </div>
                )}
              </div>
            ))}

            {(!data?.recentLogs || data.recentLogs.length === 0) && (
              <div className="text-center py-10 text-xs text-slate-500">
                No audit events recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
