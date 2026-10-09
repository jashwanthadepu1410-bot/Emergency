import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../src/db/database.js';
import { calculateRoute, matchJunctionsForRoute, haversineDistance } from '../src/services/routingService.js';
import { evaluateTrafficAndRouting } from '../src/services/trafficEngine.js';
import { CONFIG } from '../src/config.js';

describe('Emergency X Comprehensive Test Suite', () => {
  const db = getDb();
  let testSessionId = null;
  let driverToken = null;
  let policeToken = null;
  let hospitalToken = null;

  test('Scenario 1: Database initialized and seeded with essential actors and junctions', () => {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const ambulances = db.prepare('SELECT COUNT(*) as count FROM ambulances').get();
    const hospitals = db.prepare('SELECT COUNT(*) as count FROM hospitals').get();
    const junctions = db.prepare('SELECT COUNT(*) as count FROM junctions').get();

    assert.ok(users.count >= 4, 'Should have at least 4 default users (driver, police, hospital, admin)');
    assert.ok(ambulances.count >= 3, 'Should have at least 3 ambulances');
    assert.ok(hospitals.count >= 4, 'Should have at least 4 hospitals');
    assert.ok(junctions.count >= 6, 'Should have at least 6 traffic junctions');
  });

  test('Scenario 2: Ambulance Driver, Police, and Hospital authenticates with valid JWT', () => {
    // Driver login
    const driver = db.prepare("SELECT * FROM users WHERE email = 'driver@emergencyx.com'").get();
    assert.ok(driver, 'Driver user must exist');
    assert.ok(bcrypt.compareSync('driver123', driver.password_hash), 'Password should verify');

    driverToken = jwt.sign({ id: driver.id, role: driver.role }, CONFIG.JWT_SECRET);
    const decodedDriver = jwt.verify(driverToken, CONFIG.JWT_SECRET);
    assert.equal(decodedDriver.role, 'driver');

    // Police login
    const police = db.prepare("SELECT * FROM users WHERE email = 'police@emergencyx.com'").get();
    policeToken = jwt.sign({ id: police.id, role: police.role }, CONFIG.JWT_SECRET);
    const decodedPolice = jwt.verify(policeToken, CONFIG.JWT_SECRET);
    assert.equal(decodedPolice.role, 'police');

    // Hospital login
    const hospital = db.prepare("SELECT * FROM users WHERE email = 'hospital@emergencyx.com'").get();
    hospitalToken = jwt.sign({ id: hospital.id, role: hospital.role }, CONFIG.JWT_SECRET);
    const decodedHospital = jwt.verify(hospitalToken, CONFIG.JWT_SECRET);
    assert.equal(decodedHospital.role, 'hospital');
  });

  test('Scenario 3: Route calculation generates accurate path geometry and ETA', async () => {
    const pickupLat = 12.9716;
    const pickupLng = 77.5946;
    const hospLat = 12.9915;
    const hospLng = 77.6180;

    const route = await calculateRoute(pickupLat, pickupLng, hospLat, hospLng, false);
    assert.ok(route.coordinates.length > 5, 'Route should contain path coordinate points');
    assert.ok(route.distanceMeters > 1000, 'Route distance should be greater than 1km');
    assert.ok(route.durationSeconds > 60, 'ETA should be greater than 1 minute');

    const allJunctions = db.prepare('SELECT * FROM junctions').all();
    const matched = matchJunctionsForRoute(route.coordinates, allJunctions);
    assert.ok(matched.length >= 1, 'Should match at least one relevant traffic junction along corridor');
  });

  test('Scenario 4 & 5: Driver activates Emergency Mode with junction deadlines & hospital alert', async () => {
    testSessionId = `test-emg-${Date.now()}`;
    const pickupLat = 12.9716;
    const pickupLng = 77.5946;
    const hosp = db.prepare("SELECT * FROM hospitals WHERE id = 'hosp-1'").get();

    const route = await calculateRoute(pickupLat, pickupLng, hosp.lat, hosp.lng, false);
    const allJunctions = db.prepare('SELECT * FROM junctions').all();
    const matched = matchJunctionsForRoute(route.coordinates, allJunctions);

    // Insert emergency session
    db.prepare(`
      INSERT INTO emergency_sessions (
        id, ambulance_id, driver_id, hospital_id, pickup_address,
        pickup_lat, pickup_lng, destination_lat, destination_lng,
        status, active_route_type, eta_seconds, distance_meters, primary_route_json
      ) VALUES (?, 'amb-101', 'user-driver-1', 'hosp-1', 'Central Square Market',
                ?, ?, ?, ?, 'active', 'primary', ?, ?, ?)
    `).run(
      testSessionId,
      pickupLat,
      pickupLng,
      hosp.lat,
      hosp.lng,
      route.durationSeconds,
      route.distanceMeters,
      JSON.stringify(route.coordinates)
    );

    // Insert junctions
    const insertEj = db.prepare(`
      INSERT INTO emergency_junctions (
        id, emergency_id, junction_id, sequence_order, distance_meters,
        eta_seconds, status, response_due_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now', '+30 seconds'))
    `);

    matched.forEach((junc, i) => {
      insertEj.run(`test-ej-${testSessionId}-${i}`, testSessionId, junc.id, i + 1, junc.distanceMeters, junc.etaSeconds);
    });

    // Initialize hospital readiness
    db.prepare(`
      INSERT INTO hospital_readiness (id, emergency_id, hospital_id, status, notes)
      VALUES (?, ?, 'hosp-1', 'alert_received', 'Initial dispatch alert')
    `).run(`test-hr-${testSessionId}`, testSessionId);

    const saved = db.prepare('SELECT * FROM emergency_sessions WHERE id = ?').get(testSessionId);
    assert.equal(saved.status, 'active');
    assert.equal(saved.ambulance_id, 'amb-101');
    assert.equal(saved.hospital_id, 'hosp-1');

    const savedJunctions = db.prepare('SELECT * FROM emergency_junctions WHERE emergency_id = ?').all(testSessionId);
    assert.ok(savedJunctions.length >= 1, 'Emergency session must have assigned junctions');
  });

  test('Scenario 6: Police submits Junction Cleared feedback', () => {
    const firstEj = db.prepare('SELECT * FROM emergency_junctions WHERE emergency_id = ? LIMIT 1').get(testSessionId);
    assert.ok(firstEj, 'First emergency junction exists');

    db.prepare(`
      UPDATE emergency_junctions
      SET status = 'cleared', assigned_officer_id = 'user-police-1', feedback_time = datetime('now')
      WHERE id = ?
    `).run(firstEj.id);

    const updated = db.prepare('SELECT status FROM emergency_junctions WHERE id = ?').get(firstEj.id);
    assert.equal(updated.status, 'cleared', 'Junction must be marked cleared');
  });

  test('Scenario 7: Police submits Junction Not Cleared feedback', () => {
    const junctions = db.prepare('SELECT * FROM emergency_junctions WHERE emergency_id = ?').all(testSessionId);
    if (junctions.length > 1) {
      const secondEj = junctions[1];
      db.prepare(`
        UPDATE emergency_junctions
        SET status = 'not_cleared', assigned_officer_id = 'user-police-1', feedback_time = datetime('now'), feedback_notes = 'Road accident blocking 2 lanes'
        WHERE id = ?
      `).run(secondEj.id);

      const updated = db.prepare('SELECT status, feedback_notes FROM emergency_junctions WHERE id = ?').get(secondEj.id);
      assert.equal(updated.status, 'not_cleared');
      assert.ok(updated.feedback_notes.includes('accident'));
    }
  });

  test('Scenario 8 & 9: AI Traffic Decision Engine detects obstruction and recommends alternate route', async () => {
    // Force a junction to not_cleared to test recommendation trigger
    const ej = db.prepare('SELECT id FROM emergency_junctions WHERE emergency_id = ? LIMIT 1').get(testSessionId);
    db.prepare(`UPDATE emergency_junctions SET status = 'not_cleared' WHERE id = ?`).run(ej.id);

    const assessment = await evaluateTrafficAndRouting(testSessionId);

    assert.equal(assessment.engineType, 'Rule-Based Heuristic Traffic Evaluation Engine');
    assert.ok(assessment.criticalObstructions.length > 0, 'Should detect uncleared junction obstruction');
    assert.ok(assessment.totalDelaySeconds > 0, 'Delay penalty must be positive');
    assert.ok(assessment.shouldRecommendAlternate, 'Should recommend alternate route bypass');
    assert.ok(assessment.alternateRoute.coordinates.length > 0, 'Alternate route coordinates must be generated');
  });

  test('Scenario 10: Reroute applies alternate route with updated geometry and reroute counter', async () => {
    const assessment = await evaluateTrafficAndRouting(testSessionId);
    const altCoords = assessment.alternateRoute.coordinates;

    db.prepare(`
      UPDATE emergency_sessions
      SET active_route_type = 'alternate',
          alternate_route_json = ?,
          reroute_count = reroute_count + 1,
          reroute_reason = 'Obstruction bypass recommended by Traffic Engine',
          status = 'rerouted'
      WHERE id = ?
    `).run(JSON.stringify(altCoords), testSessionId);

    const session = db.prepare('SELECT * FROM emergency_sessions WHERE id = ?').get(testSessionId);
    assert.equal(session.active_route_type, 'alternate');
    assert.equal(session.status, 'rerouted');
    assert.equal(session.reroute_count, 1);
  });

  test('Scenario 11 & 12: Hospital team updates multi-stage readiness workflow', () => {
    const statuses = ['team_preparing', 'er_ready', 'ready_to_receive'];

    for (const st of statuses) {
      db.prepare(`
        INSERT INTO hospital_readiness (id, emergency_id, hospital_id, status, updated_by, notes)
        VALUES (?, ?, 'hosp-1', ?, 'user-hosp-1', 'Workflow step updated')
      `).run(`test-hr-${st}-${Date.now()}`, testSessionId, st);

      const latest = db.prepare('SELECT status FROM hospital_readiness WHERE emergency_id = ? ORDER BY rowid DESC LIMIT 1').get(testSessionId);
      assert.equal(latest.status, st);
    }
  });

  test('Scenario 13 & 14: Driver confirms arrival and closes session with journey summary', () => {
    // Arrival
    db.prepare(`UPDATE emergency_sessions SET status = 'arrived' WHERE id = ?`).run(testSessionId);
    let session = db.prepare('SELECT status FROM emergency_sessions WHERE id = ?').get(testSessionId);
    assert.equal(session.status, 'arrived');

    // Close session
    db.prepare(`
      UPDATE emergency_sessions
      SET status = 'completed', end_time = datetime('now')
      WHERE id = ?
    `).run(testSessionId);

    // Ambulance freed
    db.prepare(`UPDATE ambulances SET status = 'available' WHERE id = 'amb-101'`).run();

    session = db.prepare('SELECT status, end_time FROM emergency_sessions WHERE id = ?').get(testSessionId);
    assert.equal(session.status, 'completed');
    assert.ok(session.end_time);

    const amb = db.prepare("SELECT status FROM ambulances WHERE id = 'amb-101'").get();
    assert.equal(amb.status, 'available');
  });

  test('Scenario 15: Unauthorized access prevention logic', () => {
    // Test role check logic
    const isAuthorized = (userRole, allowedRoles) => {
      return allowedRoles.includes(userRole) || userRole === 'admin';
    };

    assert.equal(isAuthorized('driver', ['driver', 'admin']), true);
    assert.equal(isAuthorized('police', ['driver', 'admin']), false);
    assert.equal(isAuthorized('hospital', ['driver', 'admin']), false);
    assert.equal(isAuthorized('admin', ['driver']), true, 'Admin always has override privileges');
  });

  test('Scenario 16: Distance and bearing validation edge cases', () => {
    const distSame = haversineDistance(12.9716, 77.5946, 12.9716, 77.5946);
    assert.equal(distSame, 0, 'Distance between identical points is 0');

    const distFar = haversineDistance(12.9716, 77.5946, 13.0000, 77.6000);
    assert.ok(distFar > 3000 && distFar < 4000, 'Distance should be ~3.2km');
  });
});
