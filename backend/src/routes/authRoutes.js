import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { CONFIG } from '../config.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Demo users list for 1-click test logins
router.get('/demo-users', (req, res) => {
  res.json({
    users: [
      {
        email: 'driver@emergencyx.com',
        role: 'driver',
        name: 'Rajesh Sharma (Driver)',
        label: 'Ambulance Driver',
        icon: 'ambulance',
        ambulanceId: 'amb-101',
        description: 'Operates vehicle AMB-101 (Advance Life Support)'
      },
      {
        email: 'police@emergencyx.com',
        role: 'police',
        name: 'Inspector Vikram Vance',
        label: 'Traffic Police Officer',
        icon: 'shield',
        jurisdiction: 'Downtown Zone 1',
        description: 'Manages critical junction clearances in Downtown Zone 1'
      },
      {
        email: 'hospital@emergencyx.com',
        role: 'hospital',
        name: 'Dr. Elena Rostova (ER Chief)',
        label: 'Hospital ER Team',
        icon: 'hospital',
        hospitalId: 'hosp-1',
        description: 'Level 1 Trauma Center ER Coordinator'
      },
      {
        email: 'admin@emergencyx.com',
        role: 'admin',
        name: 'System Administrator',
        label: 'Central Command Admin',
        icon: 'activity',
        description: 'Full system oversight, timeout adjustments, traffic telemetry'
      }
    ]
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    CONFIG.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password_hash, ...safeUser } = user;
  res.json({
    token,
    user: safeUser,
    message: 'Login successful'
  });
});

// Get current user profile
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, ambulance_id, hospital_id, jurisdiction, badge_number, created_at FROM users WHERE id = ?').get(req.user.id);

  let ambulance = null;
  let hospital = null;

  if (user.ambulance_id) {
    ambulance = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(user.ambulance_id);
  }
  if (user.hospital_id) {
    hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(user.hospital_id);
  }

  res.json({
    user,
    ambulance,
    hospital
  });
});

// Register
router.post('/register', (req, res) => {
  const { name, email, password, role, ambulance_id, hospital_id, jurisdiction, badge_number } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  if (!['driver', 'police', 'hospital', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const id = `user-${Date.now()}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, ambulance_id, hospital_id, jurisdiction, badge_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email, passwordHash, role, ambulance_id || null, hospital_id || null, jurisdiction || null, badge_number || null);

    const token = jwt.sign({ id, email, role }, CONFIG.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
      token,
      user: { id, name, email, role, ambulance_id, hospital_id, jurisdiction, badge_number },
      message: 'Registration successful'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
});

export default router;
