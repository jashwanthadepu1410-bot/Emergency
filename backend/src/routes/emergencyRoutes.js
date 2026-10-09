import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { calculateRoute, matchJunctionsForRoute, haversineDistance } from '../services/routingService.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { broadcastToEmergency, broadcastToRole, broadcastAll } from '../socket.js';
import { evaluateTrafficAndRouting } from '../services/trafficEngine.js';

const router = Router();

// Activate Emergency Mode (Step 2)
router.post('/activate', authenticate, authorizeRoles('driver', 'admin'), async (req, res) => {
  const { ambulance_id, hospital_id, pickup_address, pickup_lat, pickup_lng } = req.body;

  if (!ambulance_id || !hospital_id || pickup_lat === undefined || pickup_lng === undefined) {
    return res.status(400).json({
      error: 'ambulance_id, hospital_id, pickup_lat, and pickup_lng are required'
    });
  }

  const db = getDb();

  // 1. Check if ambulance is already in an active emergency (prevent duplicate active sessions)
  const existingActive = db.prepare(`
    SELECT id FROM emergency_sessions
    WHERE ambulance_id = ? AND status IN ('active', 'rerouted')
  `).get(ambulance_id);

  if (existingActive) {
    return res.status(409).json({
      error: 'Ambulance is already engaged in an active emergency session.',
      activeEmergencyId: existingActive.id
    });
  }

  // 2. Fetch Hospital
  const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospital_id);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  // 3. Fetch Ambulance
  const ambulance = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(ambulance_id);
  if (!ambulance) {
    return res.status(404).json({ error: 'Ambulance not found' });
  }

  // 4. Calculate primary route
  const startLat = parseFloat(pickup_lat);
  const startLng = parseFloat(pickup_lng);
  const destLat = parseFloat(hospital.lat);
  const destLng = parseFloat(hospital.lng);

  const primaryRoute = await calculateRoute(startLat, startLng, destLat, destLng, false);

  // 5. Match relevant traffic junctions along route
  const allJunctions = db.prepare('SELECT * FROM junctions').all();
  const matchedJunctions = matchJunctionsForRoute(primaryRoute.coordinates, allJunctions);

  // Read configurable police response timeout
  const configRow = db.prepare("SELECT value FROM system_config WHERE key = 'police_timeout_seconds'").get();
  const timeoutSeconds = configRow ? parseInt(configRow.value, 10) : 30;

  // 6. Create Emergency Session
  const emergencyId = `emg-${Date.now()}-${uuidv4().substring(0, 6)}`;
  const nowIso = new Date().toISOString();

  db.prepare(`
    INSERT INTO emergency_sessions (
      id, ambulance_id, driver_id, hospital_id, pickup_address,
      pickup_lat, pickup_lng, destination_lat, destination_lng,
      status, active_route_type, eta_seconds, distance_meters,
      primary_route_json, reroute_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'primary', ?, ?, ?, 0)
  `).run(
    emergencyId,
    ambulance_id,
    req.user.id,
    hospital_id,
    pickup_address || 'Patient Pickup Location',
    startLat,
    startLng,
    destLat,
    destLng,
    primaryRoute.durationSeconds,
    primaryRoute.distanceMeters,
    JSON.stringify(primaryRoute.coordinates)
  );

  // 7. Insert matched junctions with timeout deadlines
  const insertEj = db.prepare(`
    INSERT INTO emergency_junctions (
      id, emergency_id, junction_id, sequence_order, distance_meters,
      eta_seconds, status, response_due_by
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  const assignedJunctions = [];
  matchedJunctions.forEach((junc, idx) => {
    const ejId = `ej-${emergencyId}-${idx + 1}`;
    // Deadline: now + timeoutSeconds
    const dueBy = new Date(Date.now() + timeoutSeconds * 1000).toISOString();
    insertEj.run(ejId, emergencyId, junc.id, junc.sequenceOrder, junc.distanceMeters, junc.etaSeconds, dueBy);
    assignedJunctions.push({
      ...junc,
      emergencyJunctionId: ejId,
      status: 'pending',
      responseDueBy: dueBy
    });
  });

  // 8. Initialize Hospital Readiness
  const readinessId = `hr-${emergencyId}`;
  db.prepare(`
    INSERT INTO hospital_readiness (id, emergency_id, hospital_id, status, notes)
    VALUES (?, ?, ?, 'alert_received', 'Initial emergency alert dispatched to ER team')
  `).run(readinessId, emergencyId, hospital_id);

  // 9. Update Ambulance status and position
  db.prepare(`
    UPDATE ambulances
    SET status = 'in_emergency', current_lat = ?, current_lng = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(startLat, startLng, ambulance_id);

  // 10. Audit log
  db.prepare(`
    INSERT INTO audit_logs (emergency_id, event_type, actor_role, actor_id, details)
    VALUES (?, 'EMERGENCY_ACTIVATED', 'driver', ?, ?)
  `).run(emergencyId, req.user.id, `Emergency activated for ${ambulance.vehicle_number} to ${hospital.name}`);

  const fullSession = {
    id: emergencyId,
    ambulanceId: ambulance_id,
    vehicleNumber: ambulance.vehicle_number,
    driverName: req.user.name,
    hospitalId: hospital_id,
    hospitalName: hospital.name,
    pickupAddress: pickup_address || 'Patient Pickup Spot',
    pickupLocation: { lat: startLat, lng: startLng },
    destinationLocation: { lat: destLat, lng: destLng },
    status: 'active',
    activeRouteType: 'primary',
    etaSeconds: primaryRoute.durationSeconds,
    distanceMeters: primaryRoute.distanceMeters,
    routeCoordinates: primaryRoute.coordinates,
    junctions: assignedJunctions,
    startTime: nowIso
  };

  // 11. Broadcast Real-Time Alerts
  broadcastAll('emergency_activated', fullSession);
  broadcastToRole('police', 'police_emergency_alert', {
    emergencyId,
    session: fullSession,
    message: `CODE RED ALERT: Ambulance ${ambulance.vehicle_number} en route to ${hospital.name}. Clear junctions immediately.`
  });
  broadcastToRole('hospital', 'hospital_emergency_alert', {
    emergencyId,
    hospitalId: hospital_id,
    session: fullSession,
    message: `INCOMING PATIENT ALERT: Ambulance ${ambulance.vehicle_number} ETA ~${Math.round(primaryRoute.durationSeconds / 60)} minutes.`
  });

  res.status(201).json({
    message: 'Emergency Mode Activated Successfully',
    emergency: fullSession
  });
});

// Get currently active emergency
router.get('/active', authenticate, (req, res) => {
  const db = getDb();
  let query = `
    SELECT e.*, a.vehicle_number, a.model as ambulance_model, a.current_lat, a.current_lng,
           h.name as hospital_name, h.address as hospital_address, h.available_icu_beds,
           u.name as driver_name
    FROM emergency_sessions e
    JOIN ambulances a ON e.ambulance_id = a.id
    JOIN hospitals h ON e.hospital_id = h.id
    JOIN users u ON e.driver_id = u.id
    WHERE e.status IN ('active', 'rerouted')
  `;

  // If driver, filter for driver's ambulance
  if (req.user.role === 'driver' && req.user.ambulance_id) {
    query += ` AND e.ambulance_id = '${req.user.ambulance_id}'`;
  } else if (req.user.role === 'hospital' && req.user.hospital_id) {
    query += ` AND e.hospital_id = '${req.user.hospital_id}'`;
  }

  query += ` ORDER BY e.created_at DESC LIMIT 1`;
  const session = db.prepare(query).get();

  if (!session) {
    return res.json({ active: false, emergency: null });
  }

  // Attach junctions
  const junctions = db.prepare(`
    SELECT ej.*, j.name as junction_name, j.code as junction_code, j.lat, j.lng, j.jurisdiction,
           j.traffic_congestion_level
    FROM emergency_junctions ej
    JOIN junctions j ON ej.junction_id = j.id
    WHERE ej.emergency_id = ?
    ORDER BY ej.sequence_order ASC
  `).all(session.id);

  // Attach hospital readiness
  const readiness = db.prepare(`
    SELECT * FROM hospital_readiness WHERE emergency_id = ? ORDER BY updated_at DESC LIMIT 1
  `).get(session.id);

  res.json({
    active: true,
    emergency: {
      ...session,
      junctions,
      readiness,
      routeCoordinates: session.active_route_type === 'alternate' && session.alternate_route_json
        ? JSON.parse(session.alternate_route_json)
        : JSON.parse(session.primary_route_json || '[]')
    }
  });
});

// Get emergency by ID
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const session = db.prepare(`
    SELECT e.*, a.vehicle_number, a.model as ambulance_model, a.current_lat, a.current_lng,
           h.name as hospital_name, h.address as hospital_address, h.available_icu_beds, h.trauma_level,
           u.name as driver_name
    FROM emergency_sessions e
    JOIN ambulances a ON e.ambulance_id = a.id
    JOIN hospitals h ON e.hospital_id = h.id
    JOIN users u ON e.driver_id = u.id
    WHERE e.id = ?
  `).get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: 'Emergency session not found' });
  }

  const junctions = db.prepare(`
    SELECT ej.*, j.name as junction_name, j.code as junction_code, j.lat, j.lng, j.jurisdiction,
           j.traffic_congestion_level, u.name as officer_name
    FROM emergency_junctions ej
    JOIN junctions j ON ej.junction_id = j.id
    LEFT JOIN users u ON ej.assigned_officer_id = u.id
    WHERE ej.emergency_id = ?
    ORDER BY ej.sequence_order ASC
  `).all(session.id);

  const readinessHistory = db.prepare(`
    SELECT hr.*, u.name as staff_name
    FROM hospital_readiness hr
    LEFT JOIN users u ON hr.updated_by = u.id
    WHERE hr.emergency_id = ?
    ORDER BY hr.updated_at ASC
  `).all(session.id);

  const policeFeedbacks = db.prepare(`
    SELECT pf.*, j.name as junction_name, u.name as officer_name
    FROM police_feedback pf
    JOIN junctions j ON pf.junction_id = j.id
    JOIN users u ON pf.officer_id = u.id
    WHERE pf.emergency_id = ?
    ORDER BY pf.created_at ASC
  `).all(session.id);

  res.json({
    emergency: {
      ...session,
      junctions,
      readinessHistory,
      policeFeedbacks,
      routeCoordinates: session.active_route_type === 'alternate' && session.alternate_route_json
        ? JSON.parse(session.alternate_route_json)
        : JSON.parse(session.primary_route_json || '[]')
    }
  });
});

// Update Ambulance GPS Location (continuous streaming)
router.post('/:id/location', authenticate, (req, res) => {
  const { lat, lng, speed, heading } = req.body;
  const emergencyId = req.params.id;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const currentLat = parseFloat(lat);
  const currentLng = parseFloat(lng);
  const db = getDb();

  const session = db.prepare('SELECT * FROM emergency_sessions WHERE id = ?').get(emergencyId);
  if (!session) {
    return res.status(404).json({ error: 'Emergency session not found' });
  }

  // Update ambulance current position
  db.prepare(`
    UPDATE ambulances
    SET current_lat = ?, current_lng = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(currentLat, currentLng, session.ambulance_id);

  // Store in location history
  db.prepare(`
    INSERT INTO location_history (emergency_id, ambulance_id, lat, lng, speed, heading)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(emergencyId, session.ambulance_id, currentLat, currentLng, speed || 0, heading || 0);

  // Recalculate remaining distance to destination hospital
  const remainingDist = Math.round(haversineDistance(currentLat, currentLng, session.destination_lat, session.destination_lng) * 1.2);
  const remainingEtaSeconds = Math.round(remainingDist / 13);

  // Update session ETA and distance
  db.prepare(`
    UPDATE emergency_sessions
    SET eta_seconds = ?, distance_meters = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(remainingEtaSeconds, remainingDist, emergencyId);

  // Broadcast real-time location and updated ETA
  const locationPayload = {
    emergencyId,
    ambulanceId: session.ambulance_id,
    lat: currentLat,
    lng: currentLng,
    speed: speed || 0,
    heading: heading || 0,
    remainingDistanceMeters: remainingDist,
    remainingEtaSeconds,
    timestamp: new Date().toISOString()
  };

  broadcastToEmergency(emergencyId, 'ambulance_location_updated', locationPayload);
  broadcastToRole('police', 'ambulance_location_updated', locationPayload);
  broadcastToRole('hospital', 'ambulance_location_updated', locationPayload);

  res.json({ success: true, ...locationPayload });
});

// AI Traffic Re-evaluation trigger
router.post('/:id/evaluate-traffic', authenticate, async (req, res) => {
  const emergencyId = req.params.id;
  try {
    const assessment = await evaluateTrafficAndRouting(emergencyId);
    if (assessment.shouldRecommendAlternate) {
      broadcastToEmergency(emergencyId, 'alternate_route_recommended', {
        emergencyId,
        assessment
      });
    }
    res.json({ assessment });
  } catch (err) {
    res.status(500).json({ error: 'Traffic evaluation failed', details: err.message });
  }
});

// Accept or Trigger Alternate Route (Rerouting)
router.post('/:id/reroute', authenticate, authorizeRoles('driver', 'admin'), async (req, res) => {
  const emergencyId = req.params.id;
  const db = getDb();

  const session = db.prepare('SELECT * FROM emergency_sessions WHERE id = ?').get(emergencyId);
  if (!session) {
    return res.status(404).json({ error: 'Emergency session not found' });
  }

  const ambulance = db.prepare('SELECT current_lat, current_lng FROM ambulances WHERE id = ?').get(session.ambulance_id);
  const startLat = ambulance ? ambulance.current_lat : session.pickup_lat;
  const startLng = ambulance ? ambulance.current_lng : session.pickup_lng;

  // Calculate alternate route
  const altRoute = await calculateRoute(startLat, startLng, session.destination_lat, session.destination_lng, true);

  // Match junctions on new alternate path
  const allJunctions = db.prepare('SELECT * FROM junctions').all();
  const matchedJunctions = matchJunctionsForRoute(altRoute.coordinates, allJunctions);

  // Update session record
  db.prepare(`
    UPDATE emergency_sessions
    SET active_route_type = 'alternate',
        alternate_route_json = ?,
        eta_seconds = ?,
        distance_meters = ?,
        reroute_count = reroute_count + 1,
        reroute_reason = ?,
        status = 'rerouted',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    JSON.stringify(altRoute.coordinates),
    altRoute.durationSeconds,
    altRoute.distanceMeters,
    req.body.reason || 'AI Traffic Engine Alternate Corridor Selection',
    emergencyId
  );

  // Log in audit log
  db.prepare(`
    INSERT INTO audit_logs (emergency_id, event_type, actor_role, actor_id, details)
    VALUES (?, 'ROUTE_REROUTED', 'driver', ?, ?)
  `).run(emergencyId, req.user.id, `Ambulance rerouted to Alternate Bypass Route. New ETA: ${Math.round(altRoute.durationSeconds / 60)}m`);

  // Broadcast route change to ALL sectors
  const reroutePayload = {
    emergencyId,
    activeRouteType: 'alternate',
    routeCoordinates: altRoute.coordinates,
    etaSeconds: altRoute.durationSeconds,
    distanceMeters: altRoute.distanceMeters,
    reason: req.body.reason || 'AI Traffic Engine Alternate Corridor Selection',
    message: 'ALERT: Ambulance has shifted to Alternate Bypass Corridor! Police junctions updated.'
  };

  broadcastToEmergency(emergencyId, 'route_changed', reroutePayload);
  broadcastToRole('police', 'route_changed', reroutePayload);
  broadcastToRole('hospital', 'route_changed', reroutePayload);

  res.json({
    message: 'Alternate route activated successfully',
    ...reroutePayload
  });
});

// Hospital Readiness Update (Step 7)
// Statuses: 'alert_received', 'team_preparing', 'er_ready', 'ready_to_receive', 'patient_arrived'
router.post('/:id/hospital-status', authenticate, authorizeRoles('hospital', 'admin'), (req, res) => {
  const emergencyId = req.params.id;
  const { status, notes } = req.body;

  const validStatuses = ['alert_received', 'team_preparing', 'er_ready', 'ready_to_receive', 'patient_arrived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
  }

  const db = getDb();
  const session = db.prepare('SELECT * FROM emergency_sessions WHERE id = ?').get(emergencyId);
  if (!session) {
    return res.status(404).json({ error: 'Emergency session not found' });
  }

  const readinessId = `hr-${emergencyId}-${Date.now()}`;
  db.prepare(`
    INSERT INTO hospital_readiness (id, emergency_id, hospital_id, status, updated_by, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(readinessId, emergencyId, session.hospital_id, status, req.user.id, notes || null);

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (emergency_id, event_type, actor_role, actor_id, details)
    VALUES (?, 'HOSPITAL_READINESS_UPDATED', 'hospital', ?, ?)
  `).run(emergencyId, req.user.id, `Hospital readiness updated to ${status.toUpperCase()}`);

  const payload = {
    emergencyId,
    hospitalId: session.hospital_id,
    status,
    notes,
    updatedByName: req.user.name,
    timestamp: new Date().toISOString()
  };

  broadcastToEmergency(emergencyId, 'hospital_status_updated', payload);
  broadcastToRole('driver', 'hospital_status_updated', payload);

  res.json({
    message: 'Hospital readiness status updated successfully',
    ...payload
  });
});

// Ambulance Driver Confirms Arrival at Hospital (Step 8)
router.post('/:id/arrive', authenticate, authorizeRoles('driver', 'admin'), (req, res) => {
  const emergencyId = req.params.id;
  const db = getDb();

  const session = db.prepare('SELECT * FROM emergency_sessions WHERE id = ?').get(emergencyId);
  if (!session) {
    return res.status(404).json({ error: 'Emergency session not found' });
  }

  const nowIso = new Date().toISOString();
  db.prepare(`
    UPDATE emergency_sessions
    SET status = 'arrived', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(emergencyId);

  // Also update hospital status to patient_arrived
  const readinessId = `hr-${emergencyId}-${Date.now()}`;
  db.prepare(`
    INSERT INTO hospital_readiness (id, emergency_id, hospital_id, status, updated_by, notes)
    VALUES (?, ?, ?, 'patient_arrived', ?, 'Ambulance arrival confirmed by driver')
  `).run(readinessId, emergencyId, session.hospital_id, req.user.id);

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (emergency_id, event_type, actor_role, actor_id, details)
    VALUES (?, 'AMBULANCE_ARRIVED', 'driver', ?, 'Ambulance arrived at destination hospital')
  `).run(emergencyId, req.user.id);

  const arrivalPayload = {
    emergencyId,
    status: 'arrived',
    arrivalTime: nowIso,
    message: 'Ambulance has reached the destination hospital! Patient handoff in progress.'
  };

  broadcastToEmergency(emergencyId, 'ambulance_arrived', arrivalPayload);
  broadcastToRole('police', 'ambulance_arrived', arrivalPayload);
  broadcastToRole('hospital', 'ambulance_arrived', arrivalPayload);

  res.json({
    message: 'Arrival confirmed successfully',
    ...arrivalPayload
  });
});

// Close Emergency Session & Generate Final Journey Summary
router.post('/:id/close', authenticate, authorizeRoles('driver', 'admin'), (req, res) => {
  const emergencyId = req.params.id;
  const db = getDb();

  const session = db.prepare(`
    SELECT e.*, a.vehicle_number, h.name as hospital_name
    FROM emergency_sessions e
    JOIN ambulances a ON e.ambulance_id = a.id
    JOIN hospitals h ON e.hospital_id = h.id
    WHERE e.id = ?
  `).get(emergencyId);

  if (!session) {
    return res.status(404).json({ error: 'Emergency session not found' });
  }

  const nowIso = new Date().toISOString();
  const startTime = new Date(session.start_time).getTime();
  const totalJourneySeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

  // Mark session completed
  db.prepare(`
    UPDATE emergency_sessions
    SET status = 'completed', end_time = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nowIso, emergencyId);

  // Return ambulance to available
  db.prepare(`
    UPDATE ambulances
    SET status = 'available', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(session.ambulance_id);

  // Fetch feedback counts
  const junctionFeedbackCounts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM emergency_junctions
    WHERE emergency_id = ?
    GROUP BY status
  `).all(emergencyId);

  const summary = {
    emergencyId,
    ambulanceNumber: session.vehicle_number,
    destinationHospital: session.hospital_name,
    totalJourneyMinutes: (totalJourneySeconds / 60).toFixed(1),
    totalJourneySeconds,
    rerouteCount: session.reroute_count,
    activeRouteUsed: session.active_route_type,
    junctionFeedbackCounts,
    completedAt: nowIso
  };

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (emergency_id, event_type, actor_role, actor_id, details)
    VALUES (?, 'EMERGENCY_COMPLETED_CLOSED', 'driver', ?, ?)
  `).run(emergencyId, req.user.id, `Session closed. Total time: ${summary.totalJourneyMinutes} mins`);

  broadcastToEmergency(emergencyId, 'emergency_completed', summary);
  broadcastToRole('police', 'emergency_completed', summary);
  broadcastToRole('hospital', 'emergency_completed', summary);

  res.json({
    message: 'Emergency session closed successfully',
    summary
  });
});

// Past Emergency History
router.get('/history/all', authenticate, (req, res) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT e.*, a.vehicle_number, h.name as hospital_name, u.name as driver_name
    FROM emergency_sessions e
    JOIN ambulances a ON e.ambulance_id = a.id
    JOIN hospitals h ON e.hospital_id = h.id
    JOIN users u ON e.driver_id = u.id
    ORDER BY e.created_at DESC
    LIMIT 50
  `).all();

  res.json({ history: sessions });
});

export default router;
