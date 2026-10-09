import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, RotateCcw, Compass, Gauge } from 'lucide-react';
import { api } from '../services/api';

interface SimulationControllerProps {
  emergencyId: string;
  routeCoordinates: [number, number][];
  onLocationUpdate?: (lat: number, lng: number) => void;
}

export const SimulationController: React.FC<SimulationControllerProps> = ({
  emergencyId,
  routeCoordinates,
  onLocationUpdate
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(2);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(200, 1000 / speedMultiplier);
      intervalRef.current = setInterval(async () => {
        setCurrentIndex((prev) => {
          if (!routeCoordinates || routeCoordinates.length === 0) return prev;
          if (prev >= routeCoordinates.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const nextIndex = prev + 1;
          const [lat, lng] = routeCoordinates[nextIndex];

          // Push location update to backend API
          api.updateAmbulanceLocation(emergencyId, {
            lat,
            lng,
            speed: 55 * speedMultiplier,
            heading: 45
          }).catch(console.error);

          if (onLocationUpdate) onLocationUpdate(lat, lng);
          return nextIndex;
        });
      }, intervalMs);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speedMultiplier, routeCoordinates, emergencyId]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    if (routeCoordinates && routeCoordinates.length > 0) {
      const [lat, lng] = routeCoordinates[0];
      api.updateAmbulanceLocation(emergencyId, { lat, lng, speed: 0 }).catch(console.error);
      if (onLocationUpdate) onLocationUpdate(lat, lng);
    }
  };

  const handleStep = () => {
    if (!routeCoordinates || currentIndex >= routeCoordinates.length - 1) return;
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    const [lat, lng] = routeCoordinates[nextIndex];
    api.updateAmbulanceLocation(emergencyId, { lat, lng, speed: 45 }).catch(console.error);
    if (onLocationUpdate) onLocationUpdate(lat, lng);
  };

  const progressPercent = routeCoordinates && routeCoordinates.length > 1
    ? Math.round((currentIndex / (routeCoordinates.length - 1)) * 100)
    : 0;

  return (
    <div className="bg-navy-900/95 border border-amber-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      {/* Required Demo Data Disclaimer Badge */}
      <div className="flex items-center justify-between mb-3 border-b border-navy-800 pb-2">
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
            DEMO DATA
          </span>
          <span className="text-xs font-semibold text-slate-300">
            GPS Live Drive Simulator
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Waypoint {currentIndex + 1} / {routeCoordinates?.length || 0} ({progressPercent}%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-navy-950 rounded-full h-2 mb-3 overflow-hidden border border-navy-800">
        <div
          className="bg-gradient-to-r from-red-500 to-amber-400 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Drive</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Drive</span>
              </>
            )}
          </button>

          <button
            onClick={handleStep}
            disabled={isPlaying || currentIndex >= (routeCoordinates?.length || 0) - 1}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-navy-800 hover:bg-navy-700 text-slate-300 border border-navy-700 disabled:opacity-40 transition"
            title="Advance 1 Waypoint"
          >
            +1 Step
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white border border-navy-700 transition"
            title="Reset to Pickup Location"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Multiplier */}
        <div className="flex items-center space-x-1 bg-navy-950 px-2 py-1 rounded-lg border border-navy-800">
          <Gauge className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {[1, 2, 5].map((spd) => (
            <button
              key={spd}
              onClick={() => setSpeedMultiplier(spd)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition ${
                speedMultiplier === spd
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
