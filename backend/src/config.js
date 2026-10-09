import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'emergency-x-super-secret-jwt-key-2026',
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../../emergency_x.db'),
  DEFAULT_POLICE_TIMEOUT_SECONDS: parseInt(process.env.POLICE_TIMEOUT_SECONDS || '30', 10),
  DEFAULT_HOSPITAL_TIMEOUT_SECONDS: parseInt(process.env.HOSPITAL_TIMEOUT_SECONDS || '45', 10),
  DEMO_MODE_DEFAULT: true,
  VERSION: '1.0.0'
};
