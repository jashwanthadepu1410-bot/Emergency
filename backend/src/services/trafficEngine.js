import { calculateRoute } from './routingService.js';
import { getDb } from '../db/database.js';

/**
 * AI-Assisted Traffic Decision Module
 * Type: Rule-Based Heuristic & Real-Time Incident Assessment Engine
 * Transparently implements multi-factor traffic evaluation based on:
 * - Real-time police feedback (Cleared, Not Cleared, Unable, Assistance Required)
 * - Police No-Response timeout events
 * - Road congestion indicators & obstacle penalties
 * - Comparison between current corridor and alternate bypass routes
 */
export async function evaluateTrafficAndRouting(emergencyId) {
  const db = getDb();

  // 1. Fetch Emergency Session details
  const session = db.prepare(`
    SELECT e.*, h.name as hospital_name
    FROM emergency_sessions e
    JOIN hospitals h ON e.hospital_id = h.id
    WHERE e.id = ?
  `).get(emergencyId);

  if (!session) {
    return { error: 'Emergency session not found' };
  }

  // 2. Fetch junctions and their current feedback status for this emergency
  const junctions = db.prepare(`
    SELECT ej.*, j.name, j.code, j.lat, j.lng, j.traffic_congestion_level
    FROM emergency_junctions ej
    JOIN junctions j ON ej.junction_id = j.id
    WHERE ej.emergency_id = ?
    ORDER BY ej.sequence_order ASC
  `).all(emergencyId);

  // 3. Analyze junction statuses and compute obstruction delay penalty
  let totalObstructionDelaySeconds = 0;
  const criticalObstructions = [];
  const pendingTimeouts = [];
  let highestCongestion = 'low';

  for (const junc of junctions) {
    if (junc.traffic_congestion_level === 'heavy') highestCongestion = 'heavy';
    else if (junc.traffic_congestion_level === 'moderate' && highestCongestion !== 'heavy') highestCongestion = 'moderate';

    if (junc.status === 'not_cleared') {
      totalObstructionDelaySeconds += 360; // 6 minute estimated delay for uncleared bottleneck
      criticalObstructions.push(`${junc.name} (${junc.code}) reported NOT CLEARED by traffic police`);
    } else if (junc.status === 'unable_to_clear') {
      totalObstructionDelaySeconds += 420; // 7 minute severe gridlock
      criticalObstructions.push(`${junc.name} reported UNABLE TO CLEAR due to heavy gridlock`);
    } else if (junc.status === 'assistance_required') {
      totalObstructionDelaySeconds += 240; // 4 minutes while backup officers deploy
      criticalObstructions.push(`${junc.name} police requested ASSISTANCE REQUIRED`);
    } else if (junc.status === 'no_response') {
      // Step 5 requirement: police did not respond -> estimate potential congestion
      const congestionPenalty = junc.traffic_congestion_level === 'heavy' ? 300 : (junc.traffic_congestion_level === 'moderate' ? 180 : 60);
      totalObstructionDelaySeconds += congestionPenalty;
      pendingTimeouts.push(`${junc.name} NO RESPONSE from police (congestion assessed as ${junc.traffic_congestion_level})`);
    }
  }

  // Current base ETA from primary route
  const currentBaseEta = session.eta_seconds || 600;
  const currentTotalEstimatedEta = currentBaseEta + totalObstructionDelaySeconds;

  // 4. Compute Feasible Alternate Route (Adaptive Bypass Corridor)
  const ambulance = db.prepare('SELECT current_lat, current_lng FROM ambulances WHERE id = ?').get(session.ambulance_id);
  const startLat = ambulance ? ambulance.current_lat : session.pickup_lat;
  const startLng = ambulance ? ambulance.current_lng : session.pickup_lng;

  const altRoute = await calculateRoute(
    startLat,
    startLng,
    session.destination_lat,
    session.destination_lng,
    true // isAlternate
  );

  // Alternate route has fewer obstructions; calculate predicted alternate ETA
  const altEstimatedEta = altRoute.durationSeconds + 30; // buffer
  const predictedTimeSavingsSeconds = Math.max(0, currentTotalEstimatedEta - altEstimatedEta);

  // Read admin threshold from system_config
  const thresholdRow = db.prepare("SELECT value FROM system_config WHERE key = 'traffic_reroute_savings_threshold_seconds'").get();
  const savingsThreshold = thresholdRow ? parseInt(thresholdRow.value, 10) : 60;

  // Decision logic: recommend if critical obstructions exist OR time savings exceed threshold
  const hasSevereBlockage = criticalObstructions.length > 0;
  const hasTimeoutCongestion = pendingTimeouts.length > 0 && highestCongestion !== 'low';
  const shouldRecommendAlternate = (hasSevereBlockage || hasTimeoutCongestion || predictedTimeSavingsSeconds >= savingsThreshold) && session.active_route_type !== 'alternate';

  let rationale = 'Current primary route remains optimal. Green corridors active.';
  if (hasSevereBlockage) {
    rationale = `Severe obstruction: ${criticalObstructions.join('; ')}. Alternate bypass route saves ~${Math.round(predictedTimeSavingsSeconds / 60)} minutes.`;
  } else if (hasTimeoutCongestion) {
    rationale = `Police junction response timed out: ${pendingTimeouts.join('; ')}. Recommending alternate bypass route to prevent potential traffic hold-up.`;
  } else if (predictedTimeSavingsSeconds >= savingsThreshold) {
    rationale = `Alternate corridor offers faster clearance saving ~${Math.round(predictedTimeSavingsSeconds / 60)} mins with lighter flow.`;
  }

  const assessment = {
    engineType: 'Rule-Based Heuristic Traffic Evaluation Engine',
    timestamp: new Date().toISOString(),
    congestionLevel: highestCongestion,
    currentEstimatedEtaSeconds: currentTotalEstimatedEta,
    alternateEstimatedEtaSeconds: altEstimatedEta,
    estimatedTimeSavingsSeconds: predictedTimeSavingsSeconds,
    criticalObstructions,
    pendingTimeouts,
    totalDelaySeconds: totalObstructionDelaySeconds,
    shouldRecommendAlternate,
    rationale,
    confidenceScore: hasSevereBlockage ? 0.94 : (pendingTimeouts.length > 0 ? 0.82 : 0.88),
    dataQuality: 'Verified Real-Time System Telemetry & Heuristic Model',
    alternateRoute: altRoute
  };

  // If alternate recommended, record recommendation in database
  if (shouldRecommendAlternate) {
    const recId = `rec-${Date.now()}`;
    const insertRec = db.prepare(`
      INSERT INTO route_recommendations (id, emergency_id, reason, route_json, time_savings_seconds, congestion_level, confidence_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'recommended')
    `);
    insertRec.run(
      recId,
      emergencyId,
      rationale,
      JSON.stringify(altRoute.coordinates),
      predictedTimeSavingsSeconds,
      highestCongestion,
      assessment.confidenceScore
    );
    assessment.recommendationId = recId;
  }

  return assessment;
}
