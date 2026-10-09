const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('emergency_x_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}: ${res.statusText}`);
  }
  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse<{ token: string; user: any; message: string }>(res);
  },

  async getDemoUsers() {
    const res = await fetch(`${API_BASE}/auth/demo-users`);
    return handleResponse<{ users: any[] }>(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ user: any; ambulance?: any; hospital?: any }>(res);
  },

  // Ambulances
  async getAmbulances() {
    const res = await fetch(`${API_BASE}/ambulances`);
    return handleResponse<{ ambulances: any[] }>(res);
  },

  // Hospitals
  async getHospitals() {
    const res = await fetch(`${API_BASE}/hospitals`);
    return handleResponse<{ hospitals: any[] }>(res);
  },

  async getNearbyHospitals(lat: number, lng: number) {
    const res = await fetch(`${API_BASE}/hospitals/nearby?lat=${lat}&lng=${lng}`);
    return handleResponse<{ pickupLocation: any; hospitals: any[] }>(res);
  },

  async updateHospitalCapacity(hospitalId: string, available_icu_beds?: number, total_beds?: number) {
    const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/capacity`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ available_icu_beds, total_beds })
    });
    return handleResponse<{ hospital: any }>(res);
  },

  // Junctions
  async getJunctions() {
    const res = await fetch(`${API_BASE}/junctions`);
    return handleResponse<{ junctions: any[] }>(res);
  },

  async getPoliceAssignments() {
    const res = await fetch(`${API_BASE}/junctions/my-assignments`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ assignments: any[]; jurisdiction: string }>(res);
  },

  async submitJunctionFeedback(junctionId: string, emergencyId: string, status: string, notes?: string) {
    const res = await fetch(`${API_BASE}/junctions/${junctionId}/feedback`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ emergencyId, status, notes })
    });
    return handleResponse<any>(res);
  },

  // Emergencies
  async activateEmergency(payload: {
    ambulance_id: string;
    hospital_id: string;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
  }) {
    const res = await fetch(`${API_BASE}/emergencies/activate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse<{ message: string; emergency: any }>(res);
  },

  async getActiveEmergency() {
    const res = await fetch(`${API_BASE}/emergencies/active`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ active: boolean; emergency: any }>(res);
  },

  async getEmergency(id: string) {
    const res = await fetch(`${API_BASE}/emergencies/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ emergency: any }>(res);
  },

  async updateAmbulanceLocation(emergencyId: string, payload: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
  }) {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/location`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse<any>(res);
  },

  async evaluateTraffic(emergencyId: string) {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/evaluate-traffic`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ assessment: any }>(res);
  },

  async rerouteEmergency(emergencyId: string, reason?: string) {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/reroute`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse<any>(res);
  },

  async updateHospitalReadiness(emergencyId: string, status: string, notes?: string) {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/hospital-status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, notes })
    });
    return handleResponse<any>(res);
  },

  async confirmArrival(emergencyId: string) {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/arrive`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<any>(res);
  },

  async closeEmergency(emergencyId: string) {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/close`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse<{ message: string; summary: any }>(res);
  },

  async getHistory() {
    const res = await fetch(`${API_BASE}/emergencies/history/all`, {
      headers: getAuthHeaders()
    });
    return handleResponse<{ history: any[] }>(res);
  },

  // Admin
  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/admin/overview`, {
      headers: getAuthHeaders()
    });
    return handleResponse<any>(res);
  },

  async updateAdminConfig(key: string, value: string | number) {
    const res = await fetch(`${API_BASE}/admin/config`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ key, value })
    });
    return handleResponse<any>(res);
  }
};
