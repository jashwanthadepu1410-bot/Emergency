# Emergency X — AI-Powered Emergency Traffic Coordination System

> **"Because Every Second Matters."**

Emergency X is a full-stack, real-time web application that coordinates ambulances, traffic police, and hospital emergency teams to get patients to hospitals as fast as possible.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · Leaflet · Socket.IO Client |
| Backend | Node.js · Express · Socket.IO · JWT Auth · SQLite (node:sqlite) |
| Routing | OSRM public API with offline grid-routing fallback |
| AI Engine | Rule-based heuristic traffic evaluation engine |
| Maps | Leaflet with CartoDB Dark Matter tiles |

## Three Sectors

1. **Ambulance Sector** — Activate Emergency Mode, live route navigation, AI reroute alerts, hospital selection
2. **Police Sector** — Receive dispatch alerts, manage junction clearances, submit feedback (Cleared / Not Cleared / Unable / Assistance Required)
3. **Hospital Sector** — Incoming patient alerts, 5-stage ER readiness workflow, live ETA countdown

## Quick Start

### Prerequisites

- **Node.js v22+** (uses built-in `node:sqlite`)
- **npm**

### 1. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start the Backend

```bash
cd backend
node src/server.js
```

The server starts on **http://localhost:5000**. The SQLite database is auto-created and seeded with demo data on first run.

### 3. Start the Frontend

```bash
cd frontend
npx vite
```

Open **http://localhost:5173** in your browser.

### 4. Login with Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Ambulance Driver | `driver@emergencyx.com` | `driver123` |
| Traffic Police | `police@emergencyx.com` | `police123` |
| Hospital ER Staff | `hospital@emergencyx.com` | `hospital123` |
| System Admin | `admin@emergencyx.com` | `admin123` |

Use the **1-Click Persona Switcher** on the login page or the navbar to instantly switch between roles.

### 5. Run Tests

```bash
cd backend
node --test tests/emergency.test.js
```

All 12 test scenarios pass covering: authentication, emergency activation, route calculation, junction feedback, AI traffic rerouting, hospital readiness workflow, arrival confirmation, and session closure.

## End-to-End Workflow

1. **Driver** logs in → enters pickup location → selects hospital → clicks **ACTIVATE EMERGENCY MODE**
2. Emergency alert is broadcast in real-time to **Police** and **Hospital** dashboards via Socket.IO
3. **Police** see the ambulance on a live map with assigned junctions → submit clearance feedback
4. If police don't respond within configurable timeout → system marks **No Response** → AI traffic engine runs
5. If obstructions detected → system recommends **Alternate Bypass Route** → driver can accept
6. **Hospital** receives live ETA, tracks ambulance, advances through 5-stage preparation workflow
7. **Driver** confirms arrival → session closes → journey summary generated

## Demo Mode

The GPS Simulation Controller on the Ambulance Dashboard allows you to simulate the ambulance driving along the route. All simulated data is labeled **DEMO DATA**.

## Key Features

- ✅ Real-time WebSocket synchronization across all 3 sectors
- ✅ Interactive Leaflet maps with dark theme, custom markers, route polylines
- ✅ Configurable police response timeout (admin-adjustable)
- ✅ Rule-based AI Traffic Evaluation Engine (transparently labeled)
- ✅ OSRM live routing with offline heuristic fallback
- ✅ JWT authentication with role-based route guards
- ✅ 5-stage hospital ER preparation workflow
- ✅ Journey summary with reroute count, junction clearance stats
- ✅ Audit log trail for all emergency events
- ✅ Responsive design (desktop + mobile)

## External Services

| Service | Status | Notes |
|---------|--------|-------|
| OSRM Routing | Optional | Uses public demo server; falls back to local grid engine |
| CartoDB Tiles | Required | Free, no API key needed |
| SMS/Push | Not Implemented | Would require Twilio/Firebase configuration |

## Project Structure

```
emergency-x/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express + Socket.IO entry
│   │   ├── config.js           # Environment configuration
│   │   ├── socket.js           # Real-time event broadcasting
│   │   ├── db/database.js      # SQLite schema + seed data
│   │   ├── middleware/auth.js   # JWT auth + role authorization
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── emergencyRoutes.js
│   │   │   ├── hospitalRoutes.js
│   │   │   ├── junctionRoutes.js
│   │   │   ├── ambulanceRoutes.js
│   │   │   └── adminRoutes.js
│   │   └── services/
│   │       ├── routingService.js    # OSRM + fallback routing
│   │       ├── trafficEngine.js     # AI traffic decision module
│   │       └── junctionWatcher.js   # Timeout background watcher
│   └── tests/
│       └── emergency.test.js    # 12 comprehensive test scenarios
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── context/AuthContext.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── socket.ts
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── EmergencyMap.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── SimulationController.tsx
│   │   │   └── JourneySummaryModal.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Landing.tsx
│   │   │   ├── AmbulanceDashboard.tsx
│   │   │   ├── PoliceDashboard.tsx
│   │   │   ├── HospitalDashboard.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   └── EmergencyHistory.tsx
│   │   └── types/index.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── postcss.config.js
├── .env.example
├── .gitignore
└── README.md
```

## Disclaimer

This is a **demonstration prototype**. It is **not production-ready** for real emergency services without proper security review, traffic-data integration, operational testing, and coordination with relevant emergency authorities. The AI traffic engine uses rule-based heuristics, not a trained machine learning model.
