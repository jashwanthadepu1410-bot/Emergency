export type UserRole = 'driver' | 'police' | 'hospital' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  ambulance_id?: string;
  hospital_id?: string;
  jurisdiction?: string;
  badge_number?: string;
}

export interface Ambulance {
  id: string;
  vehicle_number: string;
  model: string;
  type: string;
  current_lat: number;
  current_lng: number;
  status: 'available' | 'in_emergency' | 'offline';
  updated_at?: string;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  total_beds: number;
  available_icu_beds: number;
  trauma_level: string;
  contact_phone: string;
  distanceMeters?: number;
  distanceKm?: string;
  etaMinutes?: number;
  etaSeconds?: number;
  recommendationScore?: number;
  isRecommended?: boolean;
}

export type JunctionStatus =
  | 'pending'
  | 'cleared'
  | 'not_cleared'
  | 'unable_to_clear'
  | 'assistance_required'
  | 'no_response';

export interface Junction {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  jurisdiction: string;
  current_status: JunctionStatus;
  traffic_congestion_level: 'low' | 'moderate' | 'heavy';
}

export interface EmergencyJunction {
  id?: string;
  emergencyJunctionId?: string;
  emergency_id?: string;
  junction_id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  jurisdiction: string;
  sequence_order: number;
  distanceMeters: number;
  etaSeconds: number;
  status: JunctionStatus;
  response_due_by?: string;
  responseDueBy?: string;
  feedback_time?: string;
  feedback_notes?: string;
  traffic_congestion_level?: string;
  officer_name?: string;
}

export type HospitalReadinessStatus =
  | 'alert_received'
  | 'team_preparing'
  | 'er_ready'
  | 'ready_to_receive'
  | 'patient_arrived';

export interface EmergencySession {
  id: string;
  ambulance_id: string;
  vehicle_number?: string;
  driver_id: string;
  driver_name?: string;
  hospital_id: string;
  hospital_name?: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  status: 'active' | 'rerouted' | 'arrived' | 'completed' | 'cancelled';
  active_route_type: 'primary' | 'alternate';
  eta_seconds: number;
  distance_meters: number;
  start_time: string;
  end_time?: string;
  routeCoordinates?: [number, number][];
  primary_route_json?: string;
  alternate_route_json?: string;
  reroute_count: number;
  reroute_reason?: string;
  junctions?: EmergencyJunction[];
  readiness?: {
    status: HospitalReadinessStatus;
    updated_at: string;
    notes?: string;
  };
}

export interface TrafficAssessment {
  engineType: string;
  timestamp: string;
  congestionLevel: string;
  currentEstimatedEtaSeconds: number;
  alternateEstimatedEtaSeconds: number;
  estimatedTimeSavingsSeconds: number;
  criticalObstructions: string[];
  pendingTimeouts: string[];
  totalDelaySeconds: number;
  shouldRecommendAlternate: boolean;
  rationale: string;
  confidenceScore: number;
  dataQuality: string;
  alternateRoute?: {
    coordinates: [number, number][];
    distanceMeters: number;
    durationSeconds: number;
  };
  recommendationId?: string;
}
