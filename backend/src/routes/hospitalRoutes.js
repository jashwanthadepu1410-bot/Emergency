import { Router } from 'express';
import { getDb } from '../db/database.js';
import { haversineDistance } from '../services/routingService.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();

// List all hospitals
router.get('/', (req, res) => {
  const db = getDb();
  const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY name ASC').all();
  res.json({ hospitals });
});

// Find nearby hospitals sorted by distance & recommendation score
router.get('/nearby', (req, res) => {
  const { lat, lng } = req.query;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
  }

  const db = getDb();
  const hospitals = db.prepare('SELECT * FROM hospitals').all();

  const ranked = hospitals.map((hosp) => {
    const distMeters = Math.round(haversineDistance(userLat, userLng, hosp.lat, hosp.lng) * 1.2); // city road factor
    const etaSeconds = Math.round(distMeters / 13); // ~47 km/h speed
    const etaMinutes = Math.max(1, Math.round(etaSeconds / 60));

    // Recommendation score: prefers closer distance + high ICU availability + trauma capability
    let score = 100 - (etaMinutes * 4) + (hosp.available_icu_beds * 2);
    if (hosp.trauma_level.includes('Level 1')) score += 15;

    return {
      ...hosp,
      distanceMeters: distMeters,
      distanceKm: (distMeters / 1000).toFixed(1),
      etaMinutes,
      etaSeconds,
      recommendationScore: Math.round(score),
      isRecommended: false
    };
  });

  ranked.sort((a, b) => b.recommendationScore - a.recommendationScore);
  if (ranked.length > 0) {
    ranked[0].isRecommended = true;
  }

  res.json({
    pickupLocation: { lat: userLat, lng: userLng },
    hospitals: ranked
  });
});

// Get hospital by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(req.params.id);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital not found' });
  }
  res.json({ hospital });
});

// Update hospital capacity
router.patch('/:id/capacity', authenticate, authorizeRoles('hospital', 'admin'), (req, res) => {
  const { available_icu_beds, total_beds } = req.body;
  const db = getDb();

  const current = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(req.params.id);
  if (!current) {
    return res.status(404).json({ error: 'Hospital not found' });
  }

  db.prepare(`
    UPDATE hospitals
    SET available_icu_beds = COALESCE(?, available_icu_beds),
        total_beds = COALESCE(?, total_beds),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(available_icu_beds !== undefined ? available_icu_beds : null, total_beds !== undefined ? total_beds : null, req.params.id);

  const updated = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(req.params.id);
  res.json({ hospital: updated, message: 'Hospital capacity updated' });
});

export default router;
