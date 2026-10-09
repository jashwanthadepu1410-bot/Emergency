import React, { useState, useEffect } from 'react';
import {
  Siren,
  MapPin,
  Hospital as HospitalIcon,
  Navigation,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Layers,
  Sparkles,
  RefreshCw,
  Power,
  Volume2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket, joinEmergencyRoom } from '../services/socket';
import { EmergencySession, Hospital, TrafficAssessment } from '../types';
import { EmergencyMap } from '../components/EmergencyMap';
import { StatusBadge } from '../components/StatusBadge';
import { SimulationController } from '../components/SimulationController';
import { JourneySummaryModal } from '../components/JourneySummaryModal';

export const AmbulanceDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<EmergencySession | null>(null);
  const [nearbyHospitals, setNearbyHospitals] = useState<Hospital[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('hosp-1');

  // Pickup Location State
  const [pickupAddress, setPickupAddress] = useState<string>('MG Road Metro Junction, Downtown');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });
  const [gpsStatus, setGpsStatus] = useState<'prompt' | 'granted' | 'denied'>('granted');

  // AI Reroute recommendation modal state
  const [aiRecommendation, setAiRecommendation] = useState<TrafficAssessment | null>(null);

  // Post-Journey Summary modal
  const [journeySummary, setJourneySummary] = useState<any | null>(null);

  // Confirmations
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch active emergency and hospitals on mount
  useEffect(() => {
    fetchActiveEmergency();
    fetchHospitals(pickupCoords.lat, pickupCoords.lng);
  }, []);

  const fetchActiveEmergency = async () => {
    try {
      const res = await api.getActiveEmergency();
      if (res.active && res.emergency) {
        setActiveSession(res.emergency);
        joinEmergencyRoom(res.emergency.id);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error fetching active emergency:', err);
    }
  };

  const fetchHospitals = async (lat: number, lng: number) => {
    try {
      const res = await api.getNearbyHospitals(lat, lng);
      setNearbyHospitals(res.hospitals);
      if (res.hospitals.length > 0) {
        const recommended = res.hospitals.find(h => h.isRecommended) || res.hospitals[0];
        setSelectedHospitalId(recommended.id);
      }
    } catch (err) {
      console.error('Error fetching nearby hospitals:', err);
    }
  };

  // Real-Time Socket Listener
  useEffect(() => {
    const socket = getSocket();

    const handleJunctionUpdate = (data: any) => {
      // console.log('[Socket] Junction update received:', data);
      setActiveSession((prev) => {
        if (!prev) return prev;
        const updatedJunctions = prev.junctions?.map((j) =>
          j.junction_id === data.junctionId ? { ...j, status: data.status, officer_name: data.officerName } : j
        );
        return { ...prev, junctions: updatedJunctions };
      });
    };

    const handleLocationUpdate = (data: any) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          eta_seconds: data.remainingEtaSeconds,
          distance_meters: data.remainingDistanceMeters
        };
      });
    };

    const handleRerouteRecommendation = (data: any) => {
      // console.log('[Socket] AI Alternate Route Recommended:', data);
      setAiRecommendation(data.assessment);
    };

    const handleRouteChanged = (data: any) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          active_route_type: 'alternate',
          routeCoordinates: data.routeCoordinates,
          eta_seconds: data.etaSeconds,
          distance_meters: data.distanceMeters,
          reroute_count: prev.reroute_count + 1
        };
      });
      setAiRecommendation(null);
    };

    const handleHospitalStatusUpdate = (data: any) => {
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          readiness: {
            status: data.status,
            updated_at: data.timestamp,
            notes: data.notes
          }
        };
      });
    };

    const handleEmergencyCompleted = (data: any) => {
      setJourneySummary(data);
      setActiveSession(null);
    };

    socket.on('junction_status_updated', handleJunctionUpdate);
    socket.on('ambulance_location_updated', handleLocationUpdate);
    socket.on('alternate_route_recommended', handleRerouteRecommendation);
    socket.on('route_changed', handleRouteChanged);
    socket.on('hospital_status_updated', handleHospitalStatusUpdate);
    socket.on('emergency_completed', handleEmergencyCompleted);

    return () => {
      socket.off('junction_status_updated', handleJunctionUpdate);
      socket.off('ambulance_location_updated', handleLocationUpdate);
      socket.off('alternate_route_recommended', handleRerouteRecommendation);
      socket.off('route_changed', handleRouteChanged);
      socket.off('hospital_status_updated', handleHospitalStatusUpdate);
      socket.off('emergency_completed', handleEmergencyCompleted);
    };
  }, []);

  // Request HTML5 Browser GPS Permission
  const requestBrowserGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setPickupCoords({ lat, lng });
        setGpsStatus('granted');
        fetchHospitals(lat, lng);
      },
      (err) => {
        console.warn('GPS permission denied or unavailable:', err.message);
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Step 2: Activate Emergency Mode
  const handleActivateEmergency = async () => {
    setLoading(true);
    try {
      const res = await api.activateEmergency({
        ambulance_id: user?.ambulance_id || 'amb-101',
        hospital_id: selectedHospitalId,
        pickup_address: pickupAddress,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng
      });
      setActiveSession(res.emergency);
      joinEmergencyRoom(res.emergency.id);
      setShowActivateModal(false);
    } catch (err: any) {
      alert(`Failed to activate Emergency Mode: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Accept AI Alternate Route Recommendation
  const handleAcceptReroute = async () => {
    if (!activeSession) return;
    try {
      await api.rerouteEmergency(activeSession.id, aiRecommendation?.rationale);
      setAiRecommendation(null);
    } catch (err: any) {
      alert(`Rerouting failed: ${err.message}`);
    }
  };

  // Step 8: Confirm Arrival
  const handleConfirmArrival = async () => {
    if (!activeSession) return;
    try {
      await api.confirmArrival(activeSession.id);
      setActiveSession(prev => prev ? { ...prev, status: 'arrived' } : null);
    } catch (err: any) {
      alert(`Arrival confirmation error: ${err.message}`);
    }
  };

  // Step 8: Close Emergency Session
  const handleCloseEmergency = async () => {
    if (!activeSession) return;
    try {
      const res = await api.closeEmergency(activeSession.id);
      setJourneySummary(res.summary);
      setActiveSession(null);
      setShowCloseModal(false);
    } catch (err: any) {
      alert(`Error closing emergency: ${err.message}`);
    }
  };

  const selectedHospital = nearbyHospitals.find(h => h.id === selectedHospitalId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Emergency Status or Standby */}
      {activeSession ? (
        <div className="relative overflow-hidden bg-gradient-to-r from-red-950 via-navy-900 to-red-950 border-2 border-red-500 rounded-3xl p-5 shadow-2xl animate-beacon">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-xl animate-pulse">
                <Siren className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white animate-pulse">
                    CODE RED
                  </span>
                  <StatusBadge status={activeSession.status} type="emergency" size="sm" />
                  <span className="text-xs text-slate-400 font-mono">ID: {activeSession.id}</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-white mt-1">
                  EMERGENCY MODE ACTIVE — {activeSession.hospital_name || 'Destination Hospital'}
                </h1>
                <p className="text-xs text-red-200">
                  Continuous location streaming to Traffic Police and Hospital ER teams.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {activeSession.status !== 'arrived' ? (
                <button
                  onClick={handleConfirmArrival}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Patient Arrived</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold">
                  Patient Arrived at Hospital
                </div>
              )}

              <button
                onClick={() => setShowCloseModal(true)}
                className="px-4 py-2 bg-navy-800 hover:bg-red-900 text-slate-200 hover:text-white border border-slate-700 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
              >
                <Power className="w-4 h-4" />
                <span>End Emergency Mode</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-navy-800 text-slate-300 flex items-center justify-center border border-navy-700">
              <Siren className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">Ambulance Unit AMB-101</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  READY ON STANDBY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Driver: {user?.name || 'Rajesh Sharma'} • Advanced Life Support (ALS)
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowActivateModal(true)}
            className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-950 transition flex items-center justify-center space-x-2"
          >
            <Siren className="w-5 h-5 animate-pulse" />
            <span>ACTIVATE EMERGENCY MODE</span>
          </button>
        </div>
      )}

      {/* AI Traffic Reroute Alert Banner */}
      {aiRecommendation && activeSession && (
        <div className="bg-gradient-to-r from-purple-950 via-navy-900 to-purple-950 border-2 border-purple-500 rounded-2xl p-4 shadow-2xl animate-bounce">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-500/50">
                <Sparkles className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-purple-300 uppercase tracking-wider">
                    AI Traffic Alert: Faster Route Detected
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                    Save ~{Math.round(aiRecommendation.estimatedTimeSavingsSeconds / 60)} Mins
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {aiRecommendation.rationale}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAcceptReroute}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                Accept Recommended Reroute
              </button>
              <button
                onClick={() => setAiRecommendation(null)}
                className="px-3 py-2 bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white text-xs font-semibold rounded-xl transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Interactive Map + Side Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Map & Live Navigation HUD */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Navigation HUD Bar */}
          {activeSession && (
            <div className="grid grid-cols-3 gap-3 bg-navy-900/90 border border-navy-800 rounded-2xl p-3 shadow-lg">
              <div className="bg-navy-950/80 rounded-xl p-2.5 border border-navy-800 text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Estimated Arrival (ETA)</div>
                <div className="text-2xl font-black text-red-400 font-mono mt-0.5">
                  {Math.round(activeSession.eta_seconds / 60)}:
                  {String(activeSession.eta_seconds % 60).padStart(2, '0')}
                </div>
                <div className="text-[10px] text-slate-500">Live Traffic Adjusted</div>
              </div>

              <div className="bg-navy-950/80 rounded-xl p-2.5 border border-navy-800 text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Distance Remaining</div>
                <div className="text-2xl font-black text-blue-400 font-mono mt-0.5">
                  {(activeSession.distance_meters / 1000).toFixed(1)} km
                </div>
                <div className="text-[10px] text-slate-500">
                  Corridor: {activeSession.active_route_type.toUpperCase()}
                </div>
              </div>

              <div className="bg-navy-950/80 rounded-xl p-2.5 border border-navy-800 text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Hospital ER Readiness</div>
                <div className="mt-1">
                  <StatusBadge status={activeSession.readiness?.status || 'alert_received'} type="hospital" size="sm" />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Medical Team Alerted</div>
              </div>
            </div>
          )}

          {/* Interactive Map */}
          <EmergencyMap
            ambulanceLocation={{ lat: activeSession?.pickup_lat || pickupCoords.lat, lng: activeSession?.pickup_lng || pickupCoords.lng }}
            pickupLocation={pickupCoords}
            destinationLocation={
              activeSession
                ? { lat: activeSession.destination_lat, lng: activeSession.destination_lng, name: activeSession.hospital_name }
                : (selectedHospital ? { lat: selectedHospital.lat, lng: selectedHospital.lng, name: selectedHospital.name } : undefined)
            }
            primaryRoute={activeSession?.routeCoordinates || []}
            activeRouteType={activeSession?.active_route_type || 'primary'}
            junctions={activeSession?.junctions || []}
            height="520px"
          />

          {/* Simulation Driving Controller (Visible when active) */}
          {activeSession && (
            <SimulationController
              emergencyId={activeSession.id}
              routeCoordinates={activeSession.routeCoordinates || []}
            />
          )}
        </div>

        {/* Right 1 Col: Controls, Upcoming Junctions & Hospital Selector */}
        <div className="space-y-5">
          {/* Active Junctions Feed if Emergency is Live */}
          {activeSession ? (
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>🚦 Upcoming Police Junctions</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {activeSession.junctions?.length || 0} Corridor Junctions
                </span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {activeSession.junctions?.map((j, i) => (
                  <div
                    key={j.junction_id || i}
                    className="p-3 rounded-2xl bg-navy-950/70 border border-navy-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-200">
                          {i + 1}. {j.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {j.code} • {j.jurisdiction}
                        </div>
                      </div>
                      <StatusBadge status={j.status} type="junction" size="sm" />
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-navy-900 text-[10px] text-slate-500">
                      <span>Distance: {j.distanceMeters || '~'}m</span>
                      <span>ETA to reach: ~{Math.round(j.etaSeconds / 60)}m</span>
                    </div>
                  </div>
                ))}

                {(!activeSession.junctions || activeSession.junctions.length === 0) && (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No major bottleneck junctions along this route segment.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Standby Mode: Step 1 Setup (Pickup location & Hospital selector) */
            <div className="space-y-4">
              {/* Step 1: Pickup Location Card */}
              <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                    Step 1: Patient Pickup Spot
                  </span>
                  <button
                    onClick={requestBrowserGps}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Get GPS Location</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pickup Address / Landmark</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-red-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-navy-950 border border-navy-800 rounded-xl text-xs text-slate-200 outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Quick Preset Emergency Spots */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Quick Emergency Presets:</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {[
                      { name: 'MG Road Metro', lat: 12.9716, lng: 77.5946 },
                      { name: 'Victoria Circle', lat: 12.9640, lng: 77.5850 },
                      { name: 'Indiranagar 100ft', lat: 12.9780, lng: 77.6400 },
                      { name: 'North Express Hwy', lat: 12.9850, lng: 77.6080 }
                    ].map((spot) => (
                      <button
                        key={spot.name}
                        onClick={() => {
                          setPickupAddress(spot.name);
                          setPickupCoords({ lat: spot.lat, lng: spot.lng });
                          fetchHospitals(spot.lat, spot.lng);
                        }}
                        className="px-2 py-1.5 rounded-lg bg-navy-950 hover:bg-navy-800 border border-navy-800 text-left text-slate-300 truncate transition"
                      >
                        📍 {spot.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2: Nearby Hospital Selection Card */}
              <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 shadow-xl backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Recommended Hospitals
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Sorted by ETA & ICU</span>
                </div>

                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {nearbyHospitals.map((hosp) => {
                    const isSelected = selectedHospitalId === hosp.id;
                    return (
                      <button
                        key={hosp.id}
                        onClick={() => setSelectedHospitalId(hosp.id)}
                        className={`w-full p-3 rounded-2xl border text-left transition ${
                          isSelected
                            ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg'
                            : 'bg-navy-950/60 border-navy-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                              <span>{hosp.name}</span>
                              {hosp.isRecommended && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                                  Top Pick
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {hosp.address}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-extrabold text-emerald-400 font-mono">
                              ~{hosp.etaMinutes} mins
                            </div>
                            <div className="text-[10px] text-slate-500">{hosp.distanceKm} km</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 mt-2 pt-2 border-t border-navy-900 text-[10px] text-slate-400">
                          <span className="text-cyan-400 font-semibold">
                            ICU Beds: {hosp.available_icu_beds}
                          </span>
                          <span>•</span>
                          <span>{hosp.trauma_level}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Activate Emergency Mode */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-navy-900 border border-red-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
              <Siren className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Confirm Emergency Mode Activation?</h3>
              <p className="text-xs text-slate-300 mt-1">
                This will trigger real-time high-priority alerts to Traffic Police at upcoming junctions and notify the selected ER Trauma Team.
              </p>
            </div>

            <div className="bg-navy-950 p-3 rounded-xl border border-navy-800 text-xs space-y-1.5">
              <div className="text-slate-400">Pickup: <strong className="text-white">{pickupAddress}</strong></div>
              <div className="text-slate-400">Destination: <strong className="text-emerald-400">{selectedHospital?.name}</strong></div>
              <div className="text-slate-400">Est. Travel Time: <strong className="text-blue-400">~{selectedHospital?.etaMinutes} minutes</strong></div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowActivateModal(false)}
                className="flex-1 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateEmergency}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg transition"
              >
                {loading ? 'Activating...' : 'CONFIRM & DISPATCH'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: End Emergency Mode */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-navy-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">End Emergency Session?</h3>
              <p className="text-xs text-slate-300 mt-1">
                Are you sure you want to end this active emergency session? This will finalize the journey log and restore the ambulance status to available.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Stay Active
              </button>
              <button
                onClick={handleCloseEmergency}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg transition"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Journey Debrief Modal */}
      <JourneySummaryModal
        summary={journeySummary}
        onClose={() => setJourneySummary(null)}
      />
    </div>
  );
};
