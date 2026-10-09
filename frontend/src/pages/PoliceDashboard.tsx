import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Compass,
  Radio,
  Sparkles,
  MapPin,
  ChevronRight,
  TrendingUp,
  Volume2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket, joinRoleRoom, joinEmergencyRoom } from '../services/socket';
import { EmergencySession, EmergencyJunction } from '../types';
import { EmergencyMap } from '../components/EmergencyMap';
import { StatusBadge } from '../components/StatusBadge';

export const PoliceDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeEmergency, setActiveEmergency] = useState<EmergencySession | null>(null);
  const [assignedJunctions, setAssignedJunctions] = useState<EmergencyJunction[]>([]);
  const [submittingJunctionId, setSubmittingJunctionId] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string>('');
  const [routeChangeAlert, setRouteChangeAlert] = useState<string | null>(null);
  const [recentFeedbacks, setRecentFeedbacks] = useState<any[]>([]);

  useEffect(() => {
    fetchActiveEmergency();
    fetchAssignments();
  }, []);

  const fetchActiveEmergency = async () => {
    try {
      const res = await api.getActiveEmergency();
      if (res.active && res.emergency) {
        setActiveEmergency(res.emergency);
        setAssignedJunctions(res.emergency.junctions || []);
        joinEmergencyRoom(res.emergency.id);
      } else {
        setActiveEmergency(null);
      }
    } catch (err) {
      console.error('Error fetching active emergency:', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await api.getPoliceAssignments();
      if (res.assignments) {
        setAssignedJunctions(res.assignments);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  // Real-time socket listeners
  useEffect(() => {
    const socket = getSocket();
    joinRoleRoom('police');

    const handlePoliceAlert = (data: any) => {
      // console.log('[Socket] Police emergency alert:', data);
      setActiveEmergency(data.session);
      setAssignedJunctions(data.session?.junctions || []);
      joinEmergencyRoom(data.emergencyId);
    };

    const handleLocationUpdate = (data: any) => {
      setActiveEmergency((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pickup_lat: data.lat,
          pickup_lng: data.lng,
          eta_seconds: data.remainingEtaSeconds,
          distance_meters: data.remainingDistanceMeters
        };
      });
    };

    const handleJunctionUpdate = (data: any) => {
      setAssignedJunctions((prev) =>
        prev.map((j) => (j.junction_id === data.junctionId ? { ...j, status: data.status, officer_name: data.officerName } : j))
      );
    };

    const handleRouteChanged = (data: any) => {
      setRouteChangeAlert(data.message || 'Ambulance rerouted to Alternate Corridor');
      setActiveEmergency((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          active_route_type: 'alternate',
          routeCoordinates: data.routeCoordinates,
          eta_seconds: data.etaSeconds
        };
      });
    };

    const handleEmergencyCompleted = () => {
      setActiveEmergency(null);
      setAssignedJunctions([]);
      setRouteChangeAlert(null);
    };

    socket.on('police_emergency_alert', handlePoliceAlert);
    socket.on('emergency_activated', handlePoliceAlert);
    socket.on('ambulance_location_updated', handleLocationUpdate);
    socket.on('junction_status_updated', handleJunctionUpdate);
    socket.on('route_changed', handleRouteChanged);
    socket.on('emergency_completed', handleEmergencyCompleted);

    return () => {
      socket.off('police_emergency_alert', handlePoliceAlert);
      socket.off('emergency_activated', handlePoliceAlert);
      socket.off('ambulance_location_updated', handleLocationUpdate);
      socket.off('junction_status_updated', handleJunctionUpdate);
      socket.off('route_changed', handleRouteChanged);
      socket.off('emergency_completed', handleEmergencyCompleted);
    };
  }, []);

  // Step 4: Police Clears Traffic Junctions
  const handleSubmitFeedback = async (junctionId: string, status: string) => {
    if (!activeEmergency) return;
    setSubmittingJunctionId(junctionId);
    try {
      const res = await api.submitJunctionFeedback(
        junctionId,
        activeEmergency.id,
        status,
        feedbackNote || `Action submitted by ${user?.name || 'Officer'}`
      );

      // Update local state
      setAssignedJunctions((prev) =>
        prev.map((j) => (j.junction_id === junctionId ? { ...j, status: status as any } : j))
      );

      setRecentFeedbacks((prev) => [
        {
          junctionId,
          status,
          timestamp: new Date().toLocaleTimeString(),
          officer: user?.name
        },
        ...prev.slice(0, 9)
      ]);

      setFeedbackNote('');
    } catch (err: any) {
      alert(`Feedback submission failed: ${err.message}`);
    } finally {
      setSubmittingJunctionId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Officer Header Info */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">
                {user?.name || 'Inspector Vikram Vance'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                TRAFFIC POLICE DIVISION
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Jurisdiction: <strong>{user?.jurisdiction || 'Downtown Zone 1'}</strong> • Badge: <strong>{user?.badge_number || 'TP-7729'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-navy-950 border border-navy-800 text-slate-300">
            Assigned Junctions: <strong className="text-white ml-1">{assignedJunctions.length}</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-navy-950 border border-navy-800 text-slate-300">
            Clearance Status: <strong className="text-emerald-400 ml-1">Live Feed</strong>
          </div>
        </div>
      </div>

      {/* Reroute Alert Notification Banner */}
      {routeChangeAlert && (
        <div className="bg-gradient-to-r from-purple-950 via-navy-900 to-purple-950 border border-purple-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
            <div>
              <div className="text-xs font-bold text-purple-300 uppercase">Route Change Alert</div>
              <p className="text-xs text-slate-200">{routeChangeAlert}</p>
            </div>
          </div>
          <button
            onClick={() => setRouteChangeAlert(null)}
            className="text-xs px-3 py-1 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-lg"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Active Emergency Alert Banner */}
      {activeEmergency ? (
        <div className="bg-gradient-to-r from-red-950/80 via-navy-900 to-red-950/80 border-2 border-red-500 rounded-3xl p-5 shadow-2xl animate-beacon">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center animate-pulse shadow-lg">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white">
                    PRIORITY 1: GREEN CORRIDOR REQUIRED
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Session: {activeEmergency.id}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-0.5">
                  Ambulance {activeEmergency.vehicle_number || 'AMB-101'} Inbound to {activeEmergency.hospital_name || 'Hospital'}
                </h2>
                <p className="text-xs text-slate-300">
                  Ensure all intersections along the planned route are cleared immediately for uninterrupted passage.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-right">
              <div className="bg-navy-950/80 p-3 rounded-2xl border border-navy-800">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Ambulance ETA</div>
                <div className="text-xl font-black text-red-400 font-mono">
                  ~{Math.round(activeEmergency.eta_seconds / 60)} mins
                </div>
              </div>

              <div className="bg-navy-950/80 p-3 rounded-2xl border border-navy-800">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Distance</div>
                <div className="text-xl font-black text-blue-400 font-mono">
                  {(activeEmergency.distance_meters / 1000).toFixed(1)} km
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-navy-900/60 border border-navy-800 rounded-2xl p-6 text-center text-slate-400">
          <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-navy-800 flex items-center justify-center text-slate-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-slate-300">No Active Emergency Inbound</div>
          <p className="text-xs text-slate-500 mt-1">
            Stand by for live dispatch alerts when ambulances activate Emergency Mode.
          </p>
        </div>
      )}

      {/* Main Grid: Interactive Map + Assigned Junctions Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Map */}
        <div className="lg:col-span-2 space-y-4">
          <EmergencyMap
            ambulanceLocation={
              activeEmergency
                ? { lat: activeEmergency.pickup_lat, lng: activeEmergency.pickup_lng }
                : undefined
            }
            destinationLocation={
              activeEmergency
                ? { lat: activeEmergency.destination_lat, lng: activeEmergency.destination_lng, name: activeEmergency.hospital_name }
                : undefined
            }
            primaryRoute={activeEmergency?.routeCoordinates || []}
            activeRouteType={activeEmergency?.active_route_type || 'primary'}
            junctions={assignedJunctions}
            height="540px"
          />
        </div>

        {/* Right 1 Col: Assigned Junction Management & Clearance Feedback */}
        <div className="space-y-4">
          <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>🚦 Assigned Traffic Junctions</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {assignedJunctions.length} Junctions
              </span>
            </div>

            {/* Junction Feedback Cards */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {assignedJunctions.map((junc, idx) => {
                const isSubmitting = submittingJunctionId === junc.junction_id;

                return (
                  <div
                    key={junc.junction_id || idx}
                    className="p-4 rounded-2xl bg-navy-950/80 border border-navy-800/80 hover:border-slate-700 transition space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">
                          {idx + 1}. {junc.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Code: {junc.code} • {junc.jurisdiction}
                        </div>
                      </div>
                      <StatusBadge status={junc.status} type="junction" size="sm" />
                    </div>

                    {/* Distance and ETA */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 bg-navy-900/80 px-2.5 py-1.5 rounded-lg border border-navy-800">
                      <span>Dist: <strong>{junc.distanceMeters || '~'}m</strong></span>
                      <span>ETA to junction: <strong className="text-amber-400">~{Math.round(junc.etaSeconds / 60)} mins</strong></span>
                    </div>

                    {/* Step 4: Clearance Feedback Action Buttons */}
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase mb-2">
                        Submit Clearance Feedback:
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* 1. Junction Cleared */}
                        <button
                          onClick={() => handleSubmitFeedback(junc.junction_id, 'cleared')}
                          disabled={isSubmitting}
                          className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl text-[11px] font-bold bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Cleared</span>
                        </button>

                        {/* 2. Junction Not Cleared */}
                        <button
                          onClick={() => handleSubmitFeedback(junc.junction_id, 'not_cleared')}
                          disabled={isSubmitting}
                          className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl text-[11px] font-bold bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 transition shadow-sm"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Not Cleared</span>
                        </button>

                        {/* 3. Unable to Clear */}
                        <button
                          onClick={() => handleSubmitFeedback(junc.junction_id, 'unable_to_clear')}
                          disabled={isSubmitting}
                          className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl text-[11px] font-bold bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 transition shadow-sm"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Unable to Clear</span>
                        </button>

                        {/* 4. Assistance Required */}
                        <button
                          onClick={() => handleSubmitFeedback(junc.junction_id, 'assistance_required')}
                          disabled={isSubmitting}
                          className="flex items-center justify-center space-x-1 py-2 px-2 rounded-xl text-[11px] font-bold bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition shadow-sm"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Need Assist</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {assignedJunctions.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500">
                  No junctions currently assigned to your sector jurisdiction.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
