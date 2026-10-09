import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();

// Get system configuration & operational statistics
router.get('/overview', authenticate, authorizeRoles('admin'), (req, res) => {
  const db = getDb();

  const configs = db.prepare('SELECT * FROM system_config').all();
  const configMap = {};
  configs.forEach(c => { configMap[c.key] = c.value; });

  const activeEmergencies = db.prepare("SELECT COUNT(*) as count FROM emergency_sessions WHERE status IN ('active', 'rerouted')").get().count;
  const totalCompleted = db.prepare("SELECT COUNT(*) as count FROM emergency_sessions WHERE status = 'completed'").get().count;
  const totalAmbulances = db.prepare("SELECT COUNT(*) as count FROM ambulances").get().count;
  const inServiceAmbulances = db.prepare("SELECT COUNT(*) as count FROM ambulances WHERE status = 'in_emergency'").get().count;
  const clearedJunctions = db.prepare("SELECT COUNT(*) as count FROM emergency_junctions WHERE status = 'cleared'").get().count;
  const totalJunctionActions = db.prepare("SELECT COUNT(*) as count FROM emergency_junctions").get().count;

  const recentLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25').all();

  res.json({
    metrics: {
      activeEmergencies,
      totalCompleted,
      totalAmbulances,
      inServiceAmbulances,
      clearedJunctions,
      totalJunctionActions,
      clearanceRatePercent: totalJunctionActions > 0 ? Math.round((clearedJunctions / totalJunctionActions) * 100) : 100
    },
    systemConfig: configMap,
    recentLogs
  });
});

// Update configuration setting
router.post('/config', authenticate, authorizeRoles('admin'), (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO system_config (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, String(value));

  res.json({ message: `Config key '${key}' updated to '${value}'`, key, value });
});

export default router;
