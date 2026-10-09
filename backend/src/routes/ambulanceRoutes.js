import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// List all ambulances
router.get('/', (req, res) => {
  const db = getDb();
  const ambulances = db.prepare('SELECT * FROM ambulances ORDER BY vehicle_number ASC').all();
  res.json({ ambulances });
});

// Get specific ambulance
router.get('/:id', (req, res) => {
  const db = getDb();
  const ambulance = db.prepare('SELECT * FROM ambulances WHERE id = ?').get(req.params.id);
  if (!ambulance) {
    return res.status(404).json({ error: 'Ambulance not found' });
  }
  res.json({ ambulance });
});

export default router;
