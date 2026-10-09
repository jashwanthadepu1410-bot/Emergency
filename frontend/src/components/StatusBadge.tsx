import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Radio,
  Building,
  UserCheck
} from 'lucide-react';
import { JunctionStatus, HospitalReadinessStatus } from '../types';

interface StatusBadgeProps {
  status: JunctionStatus | HospitalReadinessStatus | string;
  type?: 'junction' | 'hospital' | 'emergency';
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'junction', size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 space-x-1',
    md: 'text-xs px-2.5 py-1 space-x-1.5',
    lg: 'text-sm px-3.5 py-1.5 space-x-2 font-bold'
  }[size];

  // Junction Statuses
  if (type === 'junction') {
    switch (status) {
      case 'cleared':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cleared</span>
          </span>
        );
      case 'not_cleared':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/30 ${sizeClasses}`}>
            <XCircle className="w-3.5 h-3.5" />
            <span>Not Cleared</span>
          </span>
        );
      case 'unable_to_clear':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${sizeClasses}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Unable to Clear</span>
          </span>
        );
      case 'assistance_required':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 ${sizeClasses}`}>
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Assistance Required</span>
          </span>
        );
      case 'no_response':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30 animate-pulse ${sizeClasses}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>No Response</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-slate-700/40 text-slate-300 border border-slate-600/40 ${sizeClasses}`}>
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Pending Clearance</span>
          </span>
        );
    }
  }

  // Hospital Readiness Statuses
  if (type === 'hospital') {
    switch (status) {
      case 'alert_received':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 ${sizeClasses}`}>
            <Radio className="w-3.5 h-3.5" />
            <span>Alert Received</span>
          </span>
        );
      case 'team_preparing':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${sizeClasses}`}>
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Team Preparing</span>
          </span>
        );
      case 'er_ready':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 ${sizeClasses}`}>
            <Building className="w-3.5 h-3.5" />
            <span>ER Bay Ready</span>
          </span>
        );
      case 'ready_to_receive':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm ${sizeClasses}`}>
            <UserCheck className="w-3.5 h-3.5" />
            <span>Ready for Patient</span>
          </span>
        );
      case 'patient_arrived':
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-emerald-600/30 text-emerald-300 border border-emerald-500/60 ${sizeClasses}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Patient Arrived</span>
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center rounded-full font-semibold bg-slate-700/40 text-slate-300 border border-slate-600 ${sizeClasses}`}>
            <span>{status}</span>
          </span>
        );
    }
  }

  // Emergency Session status
  switch (status) {
    case 'active':
      return (
        <span className={`inline-flex items-center rounded-full font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-ping" />
          ACTIVE EMERGENCY
        </span>
      );
    case 'rerouted':
      return (
        <span className={`inline-flex items-center rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 ${sizeClasses}`}>
          <span className="w-2 h-2 rounded-full bg-purple-400 mr-1.5 animate-pulse" />
          REROUTED BY AI
        </span>
      );
    case 'arrived':
      return (
        <span className={`inline-flex items-center rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 ${sizeClasses}`}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          ARRIVED AT ER
        </span>
      );
    case 'completed':
      return (
        <span className={`inline-flex items-center rounded-full font-medium bg-slate-700/50 text-slate-300 border border-slate-600 ${sizeClasses}`}>
          COMPLETED
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded-full font-medium bg-slate-800 text-slate-300 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};
