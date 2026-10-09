import React, { useState, useEffect } from 'react';
import { History, Siren, Hospital, Clock, Calendar, CheckCircle2, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';

export const EmergencyHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.getHistory();
      setHistory(res.history || []);
    } catch (err) {
      console.error('Failed to fetch emergency history:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-navy-800 text-purple-400 flex items-center justify-center border border-navy-700">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Emergency Dispatch History</h1>
            <p className="text-xs text-slate-400">
              Audit log of completed, rerouted, and active emergency missions.
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-xl text-xs font-semibold border border-navy-700 flex items-center space-x-1.5 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* History Table / List */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-950/80 uppercase font-semibold text-slate-400 border-b border-navy-800">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Session ID</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Destination Hospital</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reroutes</th>
                <th className="px-4 py-3">Est. Travel Time</th>
                <th className="px-4 py-3 rounded-r-xl">Activated Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60 font-medium">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-navy-950/40 transition">
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {item.id}
                  </td>
                  <td className="px-4 py-3 font-bold text-white">
                    {item.vehicle_number}
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {item.hospital_name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} type="emergency" size="sm" />
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {item.reroute_count > 0 ? (
                      <span className="text-purple-400 font-bold">{item.reroute_count} (Alt Bypass)</span>
                    ) : (
                      <span className="text-slate-500">0 (Direct)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    ~{Math.round(item.eta_seconds / 60)} mins ({(item.distance_meters / 1000).toFixed(1)} km)
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono">
                    {item.created_at}
                  </td>
                </tr>
              ))}

              {history.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No emergency dispatch history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
