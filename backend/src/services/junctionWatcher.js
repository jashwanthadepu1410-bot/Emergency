import { getDb } from '../db/database.js';
import { evaluateTrafficAndRouting } from './trafficEngine.js';
import { broadcastToEmergency, broadcastToRole } from '../socket.js';

let watcherInterval = null;

export function startJunctionWatcher() {
  if (watcherInterval) return;

  // Check every 4 seconds for expired pending junctions
  watcherInterval = setInterval(async () => {
    try {
      const db = getDb();
      const nowIso = new Date().toISOString();

      // Find pending junctions where response_due_by is past and emergency is still active
      const expiredJunctions = db.prepare(`
        SELECT ej.id, ej.emergency_id, ej.junction_id, ej.sequence_order,
               j.name as junction_name, j.code as junction_code, j.jurisdiction,
               e.ambulance_id, e.driver_id, e.hospital_id
        FROM emergency_junctions ej
        JOIN junctions j ON ej.junction_id = j.id
        JOIN emergency_sessions e ON ej.emergency_id = e.id
        WHERE ej.status = 'pending'
          AND ej.response_due_by IS NOT NULL
          AND ej.response_due_by <= ?
          AND e.status IN ('active', 'rerouted')
      `).all(nowIso);

      for (const item of expiredJunctions) {
        // Mark as 'no_response'
        db.prepare(`
          UPDATE emergency_junctions
          SET status = 'no_response', feedback_time = ?
          WHERE id = ?
        `).run(nowIso, item.id);

        // Record audit log
        db.prepare(`
          INSERT INTO audit_logs (emergency_id, event_type, actor_role, details)
          VALUES (?, 'JUNCTION_TIMEOUT_NO_RESPONSE', 'system', ?)
        `).run(
          item.emergency_id,
          `Junction ${item.junction_name} (${item.junction_code}) marked NO RESPONSE after timeout`
        );

        console.log(`[Watcher] Junction ${item.junction_code} timed out with No Response. Triggering Traffic Engine...`);

        // Trigger AI Traffic Evaluation automatically
        const assessment = await evaluateTrafficAndRouting(item.emergency_id);

        // Broadcast to all relevant parties
        broadcastToEmergency(item.emergency_id, 'junction_status_updated', {
          junctionId: item.junction_id,
          emergencyId: item.emergency_id,
          status: 'no_response',
          junctionName: item.junction_name,
          timestamp: nowIso
        });

        broadcastToRole('police', 'junction_timeout_alert', {
          emergencyId: item.emergency_id,
          junctionId: item.junction_id,
          junctionName: item.junction_name,
          junctionCode: item.junction_code,
          message: `URGENT: No clearance response received for ${item.junction_name}. System evaluated traffic impact.`
        });

        if (assessment.shouldRecommendAlternate) {
          broadcastToEmergency(item.emergency_id, 'alternate_route_recommended', {
            emergencyId: item.emergency_id,
            assessment
          });
        }
      }
    } catch (err) {
      console.error('[Watcher] Error in junction watcher:', err.message);
    }
  }, 4000);
}

export function stopJunctionWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
}
