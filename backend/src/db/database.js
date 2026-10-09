import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../config.js';

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(CONFIG.DB_PATH);
    initSchema(dbInstance);
    seedInitialData(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  // Enable foreign keys and WAL mode if applicable
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('driver', 'police', 'hospital', 'admin')),
      ambulance_id TEXT,
      hospital_id TEXT,
      jurisdiction TEXT,
      badge_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ambulances (
      id TEXT PRIMARY KEY,
      vehicle_number TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      type TEXT NOT NULL,
      current_lat REAL NOT NULL,
      current_lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'in_emergency', 'offline')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      total_beds INTEGER DEFAULT 120,
      available_icu_beds INTEGER DEFAULT 8,
      trauma_level TEXT DEFAULT 'Level 1 Trauma Center',
      contact_phone TEXT DEFAULT '+1-800-EMERGENCY',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS junctions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      jurisdiction TEXT NOT NULL,
      current_status TEXT NOT NULL DEFAULT 'pending',
      traffic_congestion_level TEXT DEFAULT 'moderate',
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS emergency_sessions (
      id TEXT PRIMARY KEY,
      ambulance_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      hospital_id TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      pickup_lat REAL NOT NULL,
      pickup_lng REAL NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'rerouted', 'arrived', 'completed', 'cancelled')),
      active_route_type TEXT DEFAULT 'primary',
      eta_seconds INTEGER NOT NULL,
      distance_meters INTEGER NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      primary_route_json TEXT,
      alternate_route_json TEXT,
      reroute_count INTEGER DEFAULT 0,
      reroute_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ambulance_id) REFERENCES ambulances(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_junctions (
      id TEXT PRIMARY KEY,
      emergency_id TEXT NOT NULL,
      junction_id TEXT NOT NULL,
      sequence_order INTEGER NOT NULL,
      distance_meters INTEGER,
      eta_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'cleared', 'not_cleared', 'unable_to_clear', 'assistance_required', 'no_response')),
      assigned_officer_id TEXT,
      response_due_by DATETIME,
      feedback_time DATETIME,
      feedback_notes TEXT,
      FOREIGN KEY (emergency_id) REFERENCES emergency_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (junction_id) REFERENCES junctions(id)
    );

    CREATE TABLE IF NOT EXISTS police_feedback (
      id TEXT PRIMARY KEY,
      emergency_id TEXT NOT NULL,
      junction_id TEXT NOT NULL,
      officer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hospital_readiness (
      id TEXT PRIMARY KEY,
      emergency_id TEXT NOT NULL,
      hospital_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'alert_received' CHECK(status IN ('alert_received', 'team_preparing', 'er_ready', 'ready_to_receive', 'patient_arrived')),
      updated_by TEXT,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emergency_id) REFERENCES emergency_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emergency_id TEXT NOT NULL,
      ambulance_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL DEFAULT 0,
      heading REAL DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_recommendations (
      id TEXT PRIMARY KEY,
      emergency_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      route_json TEXT NOT NULL,
      time_savings_seconds INTEGER DEFAULT 0,
      congestion_level TEXT DEFAULT 'moderate',
      confidence_score REAL DEFAULT 0.85,
      status TEXT DEFAULT 'recommended' CHECK(status IN ('recommended', 'accepted', 'dismissed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emergency_id TEXT,
      event_type TEXT NOT NULL,
      actor_role TEXT,
      actor_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedInitialData(db) {
  // Check if users already seeded
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = checkStmt.get();
  if (result.count > 0) return;

  const passwordHash = bcrypt.hashSync('driver123', 10);
  const policeHash = bcrypt.hashSync('police123', 10);
  const hospitalHash = bcrypt.hashSync('hospital123', 10);
  const adminHash = bcrypt.hashSync('admin123', 10);

  // 1. Seed Ambulances (Coordinates based in Downtown Metro area for realistic map views)
  const insertAmb = db.prepare(`
    INSERT INTO ambulances (id, vehicle_number, model, type, current_lat, current_lng, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAmb.run('amb-101', 'AMB-101', 'Mercedes Sprinter ALS', 'Advanced Life Support', 12.9716, 77.5946, 'available');
  insertAmb.run('amb-102', 'AMB-102', 'Ford Transit ICU Mobile', 'Mobile Intensive Care Unit', 12.9650, 77.6000, 'available');
  insertAmb.run('amb-103', 'AMB-103', 'Toyota HiAce BLS', 'Basic Life Support', 12.9800, 77.5850, 'available');

  // 2. Seed Hospitals
  const insertHosp = db.prepare(`
    INSERT INTO hospitals (id, name, address, lat, lng, total_beds, available_icu_beds, trauma_level, contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertHosp.run('hosp-1', 'City General Hospital', '100 Metro Health Blvd, Downtown', 12.9915, 77.6180, 240, 14, 'Level 1 Trauma Center', '+1-800-CITY-ER');
  insertHosp.run('hosp-2', 'Apollo Emergency & Heart Institute', '45 Healthcare Way, East Wing', 12.9820, 77.6320, 180, 9, 'Level 1 Trauma & Cardiac', '+1-800-APOLLO');
  insertHosp.run('hosp-3', 'St. Jude Trauma & Children Care', '88 Crossway Rd, North Campus', 12.9550, 77.6150, 150, 12, 'Level 2 Trauma Center', '+1-800-STJUDE');
  insertHosp.run('hosp-4', 'Apex University Medical Center', '12 Academic Ring Rd', 12.9620, 77.5750, 310, 22, 'Level 1 Multi-Specialty', '+1-800-APEX-MED');

  // 3. Seed Junctions
  const insertJunc = db.prepare(`
    INSERT INTO junctions (id, name, code, lat, lng, jurisdiction, current_status, traffic_congestion_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertJunc.run('junc-1', 'Central Cross Junction (MG Road & Brigade)', 'JUNC-01', 12.9740, 77.6050, 'Downtown Zone 1', 'pending', 'moderate');
  insertJunc.run('junc-2', 'Trinity Circle Highway Intersect', 'JUNC-02', 12.9725, 77.6190, 'Downtown Zone 1', 'pending', 'moderate');
  insertJunc.run('junc-3', 'Victoria Hospital Roundabout', 'JUNC-03', 12.9640, 77.5850, 'West Central Zone', 'pending', 'low');
  insertJunc.run('junc-4', 'North Ring Express Crossing', 'JUNC-04', 12.9850, 77.6080, 'North Corridor', 'pending', 'moderate');
  insertJunc.run('junc-5', 'Hospital Square Junction', 'JUNC-05', 12.9880, 77.6150, 'Downtown Zone 1', 'pending', 'low');
  insertJunc.run('junc-6', 'East Avenue Flyover Junction', 'JUNC-06', 12.9780, 77.6250, 'East Corridor', 'pending', 'heavy');

  // 4. Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, ambulance_id, hospital_id, jurisdiction, badge_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run('user-driver-1', 'Rajesh Sharma (Driver)', 'driver@emergencyx.com', passwordHash, 'driver', 'amb-101', null, null, 'AMB-DRV-08');
  insertUser.run('user-driver-2', 'David Miller (Driver 2)', 'driver2@emergencyx.com', passwordHash, 'driver', 'amb-102', null, null, 'AMB-DRV-09');
  insertUser.run('user-police-1', 'Inspector Vikram Vance', 'police@emergencyx.com', policeHash, 'police', null, null, 'Downtown Zone 1', 'TP-7729');
  insertUser.run('user-police-2', 'Officer Sarah Chen', 'police2@emergencyx.com', policeHash, 'police', null, null, 'North Corridor', 'TP-8841');
  insertUser.run('user-hosp-1', 'Dr. Elena Rostova (ER Chief)', 'hospital@emergencyx.com', hospitalHash, 'hospital', null, 'hosp-1', null, 'MED-ER-401');
  insertUser.run('user-hosp-2', 'Nurse Supervisor Marcus Lee', 'hospital2@emergencyx.com', hospitalHash, 'hospital', null, 'hosp-2', null, 'MED-ER-402');
  insertUser.run('user-admin-1', 'System Administrator', 'admin@emergencyx.com', adminHash, 'admin', null, null, 'Central Command', 'ADM-01');

  // 5. Seed System Config
  const insertConfig = db.prepare(`INSERT INTO system_config (key, value, description) VALUES (?, ?, ?)`);
  insertConfig.run('police_timeout_seconds', '30', 'Police response timeout before triggering automatic traffic evaluation');
  insertConfig.run('hospital_timeout_seconds', '45', 'Hospital alert acknowledgment timeout before escalation alert');
  insertConfig.run('traffic_reroute_savings_threshold_seconds', '60', 'Minimum seconds saved required to suggest alternate route');
  insertConfig.run('simulation_speed_multiplier', '2', 'GPS simulation speed for demonstration mode');

  console.log('[DB] Emergency X database initialized and seeded successfully.');
}
