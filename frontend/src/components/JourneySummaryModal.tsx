import React from 'react';
import { CheckCircle2, Award, Clock, ArrowRight, X, ShieldAlert } from 'lucide-react';

interface JourneySummaryModalProps {
  summary: {
    emergencyId: string;
    ambulanceNumber: string;
    destinationHospital: string;
    totalJourneyMinutes: string;
    totalJourneySeconds: number;
    rerouteCount: number;
    activeRouteUsed: string;
    junctionFeedbackCounts: { status: string; count: number }[];
    completedAt: string;
  } | null;
  onClose: () => void;
}

export const JourneySummaryModal: React.FC<JourneySummaryModalProps> = ({ summary, onClose }) => {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-navy-900 border border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Emergency Journey Completed</h3>
              <p className="text-xs text-slate-400 font-mono">Session ID: {summary.emergencyId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-navy-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlight Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-navy-950/80 border border-navy-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Time Elapsed</div>
            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
              {summary.totalJourneyMinutes} mins
            </div>
            <div className="text-[10px] text-slate-500">({summary.totalJourneySeconds} seconds)</div>
          </div>

          <div className="bg-navy-950/80 border border-navy-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Hospital Arrived</div>
            <div className="text-sm font-bold text-white truncate mt-1">
              {summary.destinationHospital}
            </div>
            <div className="text-[10px] text-slate-500">Patient in ER Bay</div>
          </div>

          <div className="bg-navy-950/80 border border-navy-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Route Adjustments</div>
            <div className="text-xl font-extrabold text-purple-400 font-mono mt-0.5">
              {summary.rerouteCount}
            </div>
            <div className="text-[10px] text-slate-500">Corridor: {summary.activeRouteUsed}</div>
          </div>

          <div className="bg-navy-950/80 border border-navy-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Ambulance Unit</div>
            <div className="text-sm font-bold text-white mt-1">
              {summary.ambulanceNumber}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold">Status: Available Again</div>
          </div>
        </div>

        {/* Junction Clearance Summary */}
        <div className="bg-navy-950/60 rounded-xl p-3 border border-navy-800 mb-5">
          <div className="text-xs font-semibold text-slate-300 mb-2">Police Junction Clearances:</div>
          <div className="flex flex-wrap gap-2">
            {summary.junctionFeedbackCounts?.map((jf, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-xs rounded-lg font-medium bg-navy-800 border border-slate-700 text-slate-300"
              >
                {jf.status.replace('_', ' ').toUpperCase()}: <strong className="text-white ml-1">{jf.count}</strong>
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition"
        >
          Close & Return to Dashboard
        </button>
      </div>
    </div>
  );
};
