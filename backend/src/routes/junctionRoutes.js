import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { broadcastToEmergency, broadcastToRole } from '../socket.js';
import { evaluateTrafficAndRouting } from '../services/trafficEngine.js';

const router = Router();

// List all junctions
router.get('/', (req, res) => {
  const db = getDb();
  const junctions = db.prepare('SELECT * FROM junctions ORDER BY name ASC').all();
  res.json({ junctions });
});

// Police Officer: Get active assigned junctions
router.get('/my-assignments', authenticate, authorizeRoles('police', 'admin'), (req, res) => {
  const db = getDb();
  const officerJurisdiction = req.user.jurisdiction || 'Downtown Zone 1';

  // Fetch junctions for active emergency sessions
  const assignments = db.prepare(`
    SELECT ej.*, j.name as junction_name, j.code as junction_code, j.lat, j.lng, j.jurisdiction,
           j.traffic_congestion_level,
           e.id as emergency_id, e.ambulance_id, e.status as emergency_status,
           a.vehicle_number, a.current_lat as ambulance_lat, a.current_lng as ambulance_lng,
           h.name as destination_hospital_name
    FROM emergency_junctions ej
    JOIN junctions j ON ej.junction_id = j.id
    JOIN emergency_sessions e ON ej.emergency_id = e.id
    JOIN ambulances a ON e.ambulance_id = a.id
    JOIN hospitals h ON e.hospital_id = h.id
    WHERE e.status IN ('active', 'rerouted')
    ORDER BY ej.sequence_order ASC
  `).all();

  res.json({ assignments, jurisdiction: officerJurisdiction });
});

// Police Officer: Submit Junction Feedback
// Statuses: 'cleared', 'not_cleared', 'unable_to_clear', 'assistance_required'
router.post('/:junctionId/feedback', authenticate, authorizeRoles('police', 'admin'), async (req, res) => {
  const { junctionId } = req.params;
  const { emergencyId, status, notes } = req.body;

  const validStatuses = ['cleared', 'not_cleared', 'unable_to_clear', 'assistance_required'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  if (!emergencyId) {
    return res.status(400).json({ error: 'emergencyId is required' });
  }

  const db = getDb();

  // Verify junction exists
  const junction = db.prepare('SELECT * FROM junctions WHERE id = ?').get(junctionId);
  if (!junction) {
    return res.status(404).json({ error: 'Junction not found' });
  }

  const nowIso = new Date().toISOString();

  // Update emergency_junctions record
  const updateResult = db.prepare(`
    UPDATE emergency_junctions
    SET status = ?, assigned_officer_id = ?, feedback_time = ?, feedback_notes = ?
    WHERE emergency_id = ? AND junction_id = ?
  `).run(status, req.user.id, nowIso, notes || null, emergencyId, junctionId);

  // Insert police feedback audit
  const feedbackId = `pf-${Date.now()}`;
  db.prepare(`
    INSERT INTO police_feedback (id, emergency_id, junction_id, officer_id, status, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(feedbackId, emergencyId, junctionId, req.user.id, status, notes || null);

  // Update general junction status
  db.prepare(`
    UPDATE junctions
    SET current_status = ?, last_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, junctionId);

  // Log in audit log
  db.prepare(`
    INSERT INTO audit_logs (emergency_id, event_type, actor_role, actor_id, details)
    VALUES (?, 'POLICE_FEEDBACK_SUBMITTED', 'police', ?, ?)
  `).run(emergencyId, req.user.id, `Police feedback for ${junction.name}: ${status.toUpperCase()}`);

  // Broadcast feedback in real time to Ambulance & Hospital
  broadcastToEmergency(emergencyId, 'junction_status_updated', {
    emergencyId,
    junctionId,
    junctionName: junction.name,
    junctionCode: junction.code,
    status,
    notes,
    officerName: req.user.name,
    timestamp: nowIso
  });

  broadcastToRole('police', 'police_feedback_submitted', {
    emergencyId,
    junctionId,
    status,
    officerName: req.user.name
  });

  // If junction reported NOT CLEARED, UNABLE, or ASSISTANCE REQUIRED:
  // Immediately trigger AI traffic analysis and route reassessment!
  let trafficAssessment = null;
  if (['not_cleared', 'unable_to_clear', 'assistance_required'].includes(status)) {
    console.log(`[Junction] ${junction.name} marked ${status}. Initiating traffic reassessment...`);
    trafficAssessment = await evaluateTrafficAndRouting(emergencyId);

    if (trafficAssessment.shouldRecommendAlternate) {
      broadcastToEmergency(emergencyId, 'alternate_route_recommended', {
        emergencyId,
        assessment: trafficAssessment
      });
    }
  }

  res.json({
    message: 'Junction feedback submitted successfully',
    junctionId,
    status,
    timestamp: nowIso,
    trafficAssessment
  });
});

export default router;
