import React, { useState, useEffect } from 'react';
import {
  Hospital as HospitalIcon,
  CheckCircle2,
  Clock,
  Radio,
  Building,
  UserCheck,
  AlertTriangle,
  HeartPulse,
  Activity,
  Bed,
  PhoneCall,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket, joinRoleRoom, joinEmergencyRoom } from '../services/socket';
import { EmergencySession, Hospital, HospitalReadinessStatus } from '../types';
import { EmergencyMap } from '../components/EmergencyMap';
import { StatusBadge } from '../components/StatusBadge';

export const HospitalDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeEmergency, setActiveEmergency] = useState<EmergencySession | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<Hospital | null>(null);
  const [readinessStatus, setReadinessStatus] = useState<HospitalReadinessStatus>('alert_received');
  const [submitting, setSubmitting] = useState(false);
  const [readinessNotes, setReadinessNotes] = useState('');
  const [rerouteAlert, setRerouteAlert] = useState<string | null>(null);

  // Hospital capacity live management
  const [icuBeds, setIcuBeds] = useState(14);
  const [totalBeds, setTotalBeds] = useState(240);

  useEffect(() => {
    fetchActiveEmergency();
    fetchHospitalDetails();
  }, []);

  const fetchActiveEmergency = async () => {
    try {
      const res = await api.getActiveEmergency();
      if (res.active && res.emergency) {
        setActiveEmergency(res.emergency);
        if (res.emergency.readiness?.status) {
          setReadinessStatus(res.emergency.readiness.status as HospitalReadinessStatus);
        }
        joinEmergencyRoom(res.emergency.id);
      } else {
        setActiveEmergency(null);
      }
    } catch (err) {
      console.error('Error fetching active emergency:', err);
    }
  };

  const fetchHospitalDetails = async () => {
    try {
      const hospId = user?.hospital_id || 'hosp-1';
      const res = await api.getHospitals();
      const current = res.hospitals.find(h => h.id === hospId) || res.hospitals[0];
      if (current) {
        setHospitalInfo(current);
        setIcuBeds(current.available_icu_beds);
        setTotalBeds(current.total_beds);
      }
    } catch (err) {
      console.error('Error fetching hospital info:', err);
    }
  };

  // Real-time Socket listeners
  useEffect(() => {
    const socket = getSocket();
    const hospId = user?.hospital_id || 'hosp-1';
    joinRoleRoom('hospital', hospId);

    const handleHospitalAlert = (data: any) => {
      // console.log('[Socket] Hospital emergency alert received:', data);
      setActiveEmergency(data.session);
      setReadinessStatus('alert_received');
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

    const handleHospitalStatusUpdate = (data: any) => {
      setReadinessStatus(data.status);
    };

    const handleRouteChanged = (data: any) => {
      setRerouteAlert(data.message || 'Ambulance rerouted to Alternate Corridor');
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

    const handleArrival = () => {
      setReadinessStatus('patient_arrived');
    };

    const handleEmergencyCompleted = () => {
      setActiveEmergency(null);
      setRerouteAlert(null);
    };

    socket.on('hospital_emergency_alert', handleHospitalAlert);
    socket.on('emergency_activated', handleHospitalAlert);
    socket.on('ambulance_location_updated', handleLocationUpdate);
    socket.on('hospital_status_updated', handleHospitalStatusUpdate);
    socket.on('route_changed', handleRouteChanged);
    socket.on('ambulance_arrived', handleArrival);
    socket.on('emergency_completed', handleEmergencyCompleted);

    return () => {
      socket.off('hospital_emergency_alert', handleHospitalAlert);
      socket.off('emergency_activated', handleHospitalAlert);
      socket.off('ambulance_location_updated', handleLocationUpdate);
      socket.off('hospital_status_updated', handleHospitalStatusUpdate);
      socket.off('route_changed', handleRouteChanged);
      socket.off('ambulance_arrived', handleArrival);
      socket.off('emergency_completed', handleEmergencyCompleted);
    };
  }, [user]);

  // Step 7: Update Hospital Readiness Status
  const handleUpdateStatus = async (newStatus: HospitalReadinessStatus) => {
    if (!activeEmergency) return;
    setSubmitting(true);
    try {
      await api.updateHospitalReadiness(
        activeEmergency.id,
        newStatus,
        readinessNotes || `Updated by ${user?.name || 'Staff'}`
      );
      setReadinessStatus(newStatus);
      setReadinessNotes('');
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Update ICU Capacity
  const handleUpdateCapacity = async (deltaIcu: number) => {
    const hospId = user?.hospital_id || 'hosp-1';
    const newIcu = Math.max(0, icuBeds + deltaIcu);
    setIcuBeds(newIcu);
    try {
      await api.updateHospitalCapacity(hospId, newIcu, totalBeds);
    } catch (err) {
      console.error('Failed to update capacity:', err);
    }
  };

  const readinessSteps: { status: HospitalReadinessStatus; label: string; desc: string; icon: any }[] = [
    {
      status: 'alert_received',
      label: '1. Alert Received',
      desc: 'Initial dispatch alert acknowledged by ER triage',
      icon: Radio
    },
    {
      status: 'team_preparing',
      label: '2. Medical Team Preparing',
      desc: 'Trauma surgeon, anesthesiologist, and nurses paged',
      icon: Clock
    },
    {
      status: 'er_ready',
      label: '3. ER Bay Ready',
      desc: 'Trauma Bay 2 cleared with ventilators & crash cart',
      icon: Building
    },
    {
      status: 'ready_to_receive',
      label: '4. Ready to Receive Patient',
      desc: 'Team assembled at emergency ambulance drop bay',
      icon: UserCheck
    },
    {
      status: 'patient_arrived',
      label: '5. Patient Arrived',
      desc: 'Ambulance docked. Direct patient admission',
      icon: CheckCircle2
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hospital Header Profile & Capacity */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <HospitalIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">
                {hospitalInfo?.name || 'City General Hospital'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {hospitalInfo?.trauma_level || 'Level 1 Trauma Center'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Address: {hospitalInfo?.address || '100 Metro Health Blvd'} • ER Contact: {hospitalInfo?.contact_phone || '+1-800-CITY-ER'}
            </p>
          </div>
        </div>

        {/* ICU Bed Capacity Live Adjuster */}
        <div className="flex items-center space-x-3 bg-navy-950/80 p-2 rounded-2xl border border-navy-800">
          <div className="text-right px-2">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Available ICU Beds</div>
            <div className="text-xl font-black text-cyan-400 font-mono">{icuBeds}</div>
          </div>
          <div className="flex flex-col space-y-1">
            <button
              onClick={() => handleUpdateCapacity(1)}
              className="px-2 py-0.5 bg-navy-800 hover:bg-navy-700 text-slate-300 text-xs rounded border border-navy-700 font-bold"
            >
              +
            </button>
            <button
              onClick={() => handleUpdateCapacity(-1)}
              className="px-2 py-0.5 bg-navy-800 hover:bg-navy-700 text-slate-300 text-xs rounded border border-navy-700 font-bold"
            >
              -
            </button>
          </div>
        </div>
      </div>

      {/* Reroute Alert Banner */}
      {rerouteAlert && (
        <div className="bg-gradient-to-r from-purple-950 via-navy-900 to-purple-950 border border-purple-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
            <div>
              <div className="text-xs font-bold text-purple-300 uppercase">Route Change Alert</div>
              <p className="text-xs text-slate-200">{rerouteAlert}</p>
            </div>
          </div>
          <button
            onClick={() => setRerouteAlert(null)}
            className="text-xs px-3 py-1 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-lg"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Active Inbound Alert HUD */}
      {activeEmergency ? (
        <div className="bg-gradient-to-r from-red-950/80 via-navy-900 to-red-950/80 border-2 border-red-500 rounded-3xl p-5 shadow-2xl animate-beacon">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center animate-pulse shadow-lg">
                <HeartPulse className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white animate-pulse">
                    INCOMING EMERGENCY PATIENT
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Session: {activeEmergency.id}
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-0.5">
                  Vehicle {activeEmergency.vehicle_number || 'AMB-101'} Inbound
                </h2>
                <p className="text-xs text-slate-300">
                  Pickup origin: <strong>{activeEmergency.pickup_address}</strong> • Driver: {activeEmergency.driver_name || 'Rajesh Sharma'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-right">
              <div className="bg-navy-950/80 p-3 rounded-2xl border border-navy-800">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Live Estimated ETA</div>
                <div className="text-2xl font-black text-red-400 font-mono">
                  {Math.round(activeEmergency.eta_seconds / 60)}:
                  {String(activeEmergency.eta_seconds % 60).padStart(2, '0')}
                </div>
              </div>

              <div className="bg-navy-950/80 p-3 rounded-2xl border border-navy-800">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Distance Remaining</div>
                <div className="text-2xl font-black text-blue-400 font-mono">
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
          <div className="text-sm font-semibold text-slate-300">No Inbound Emergency En Route</div>
          <p className="text-xs text-slate-500 mt-1">
            ER Trauma Bays on standby. Alerts will ping automatically when a vehicle selects this hospital.
          </p>
        </div>
      )}

      {/* Main Grid: Interactive Map + 5-Stage Preparation Workflow */}
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
              hospitalInfo
                ? { lat: hospitalInfo.lat, lng: hospitalInfo.lng, name: hospitalInfo.name }
                : undefined
            }
            primaryRoute={activeEmergency?.routeCoordinates || []}
            activeRouteType={activeEmergency?.active_route_type || 'primary'}
            junctions={activeEmergency?.junctions || []}
            height="520px"
          />
        </div>

        {/* Right 1 Col: 5-Stage Preparation Workflow */}
        <div className="space-y-4">
          <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>🏥 ER Team Preparation Stages</span>
              </h3>
              <StatusBadge status={readinessStatus} type="hospital" size="sm" />
            </div>

            {/* Preparation Steps */}
            <div className="space-y-3">
              {readinessSteps.map((step, idx) => {
                const IconComponent = step.icon;
                const isCurrent = readinessStatus === step.status;
                const isPassed =
                  readinessSteps.findIndex(s => s.status === readinessStatus) >= idx;

                return (
                  <button
                    key={step.status}
                    onClick={() => handleUpdateStatus(step.status)}
                    disabled={submitting || !activeEmergency}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-start space-x-3 ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/30'
                        : isPassed
                        ? 'bg-navy-950/60 border-slate-700/60 text-slate-300'
                        : 'bg-navy-950/30 border-navy-800/60 text-slate-500 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl border mt-0.5 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : isPassed
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                          : 'bg-navy-900 text-slate-600 border-navy-800'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                          {step.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500 text-navy-950 font-black uppercase">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
