# AgroConnect-IoT — Cloud Soil Moisture Monitoring System

An end-to-end, production-ready IoT soil moisture telemetry system combining an **ESP32** hardware sensor with a **Render Cloud** Docker backend, managed **PostgreSQL** persistence, and a real-time public **Web Dashboard** with Chart.js analytics.

---

## 1. Architecture Overview

```text
+-----------------------------+
| ESP32 Soil Moisture Sensor  |
| (GPIO 34 ADC1 Analog Probe) |
+--------------+--------------+
               |
               | HTTPS POST /api/iot/readings
               | TLS Encrypted (ISRG Root X1)
               v
+-----------------------------+
|   Render Cloud Web Service  |
|  (Docker / Node.js Express) |
+--------------+--------------+
               |
       +-------+-------+
       |               |
       v               v
+-------------+ +--------------------+
| Supabase    | | Public Dashboard   |
| PostgreSQL  | | (Live Gauge/Chart) |
+-------------+ +--------------------+
```

---

## 2. Project Directory Structure

```text
AgroConnect-IoT/
├── render.yaml               # Render Blueprint (Web service; DB on Supabase)
├── supabase/migrations/      # Supabase SQL schema
├── .env.example              # Local env template (DATABASE_URL, DEVICE_API_TOKEN)
├── Dockerfile                # Production Alpine Docker container
├── .dockerignore             # Excludes node_modules, secrets, firmware from Docker
├── .gitignore                # Excludes .env, build artifacts, system files
├── package.json              # Node.js backend dependencies & test scripts
├── package-lock.json
├── server.js                 # Express REST API, security middleware & static server
├── db.js                     # PostgreSQL connection pool & schema migration
├── public/                   # Public Web Dashboard
│   ├── index.html            # Dashboard UI with live gauge & historical chart
│   ├── css/style.css         # Responsive styling
│   └── js/dashboard.js       # Live API polling & Chart.js renderer
├── soil_monitor/             # ESP32 Arduino Firmware
│   ├── soil_monitor.ino      # ESP32 HTTPS client sketch
│   ├── certs.h               # ISRG Root X1 CA Certificate for *.onrender.com
│   └── README.md
├── tests/
│   └── api.test.js           # Automated backend test suite (9 passing tests)
├── documentation/
│   ├── hardware_connections.md
│   └── setup_guide.md
└── README.md
```

---

## 3. Cloud Backend REST API

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Render health check probe & DB connection status | No |
| `POST` | `/api/iot/readings` | Ingests sensor reading from ESP32 | Yes (`X-Device-Token`) |
| `GET` | `/api/iot/latest` | Retrieves most recent soil moisture reading | No |
| `GET` | `/api/iot/history` | Retrieves historical readings for charts (limit=50) | No |
| `GET` | `/api/iot/status` | Reports ESP32 connectivity state (online/stale/offline) | No |
| `GET` | `/` | Serves the public web dashboard | No |

### Ingestion Payload (`POST /api/iot/readings`):
```json
{
  "device_id": "esp32-soil-01",
  "raw": 2100,
  "moisture": 45,
  "status": "Moderate"
}
```

---

## 4. Local Testing & Verification

Run the automated backend test suite:
```bash
npm test
```
The test suite validates:
- Health check `GET /health` returns 200
- Unauthorized requests without token or with invalid token are rejected with 401
- Malformed payloads are rejected with 400
- Telemetry ingestion records readings correctly
- Real-time latest reading, historical querying, and device connection status calculations work accurately
- Public dashboard static asset delivery

---

## 5. Deployment: Supabase (Database) + Render Blueprint (Dashboard & API)

### Step 1: Create the Supabase database
1. The `soil_moisture_readings` table lives in the Supabase project `mgreapakfchcxcrauheq` (region `ap-northeast-2`, Seoul), created from `supabase/migrations/20261102000000_soil_moisture_readings.sql`. The backend also creates it on startup if missing.
2. In the [Supabase Dashboard](https://supabase.com/dashboard/project/mgreapakfchcxcrauheq), click **Connect** → **Session pooler** and copy the URI, replacing `[YOUR-PASSWORD]` with the database password:
   `postgresql://postgres.mgreapakfchcxcrauheq:<password>@aws-<n>-ap-northeast-2.pooler.supabase.com:5432/postgres`

> [!IMPORTANT]
> Use the **Session pooler** URL, not the direct `db.<ref>.supabase.co` host. The direct host is IPv6-only and Render cannot reach it.

### Step 2: Push Project to GitHub
```bash
git push origin main
```

### Step 3: Deploy the Blueprint on Render
1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
2. Connect the repository `princeabrahamshaji2027-ctrl/iot`.
3. Render reads `render.yaml` and plans one resource: **`agroconnect-backend`** (Docker web service, Free plan), which serves both the dashboard and the API.
4. When prompted for `DATABASE_URL`, paste the Supabase Session pooler URI from Step 1.
5. Click **Apply**. Render builds the container, generates `DEVICE_API_TOKEN`, and checks `/health`.
6. Open `https://<service>.onrender.com/health` and confirm `"database": "connected"`.

> [!NOTE]
> Render's free web service sleeps after 15 minutes of inactivity; the first ESP32 request after that takes ~30–60 s. Supabase's free plan pauses a project after 7 days without activity.

---

## 6. Configuring & Flashing the ESP32

1. Open `soil_monitor/soil_monitor.ino`.
2. Locate the configuration lines:
   ```cpp
   const char *ssid = "Nothing Phone (2)_4867";
   const char *password = "4256";
   const char *api_url = "https://<YOUR-RENDER-SERVICE-NAME>.onrender.com/api/iot/readings";
   const char *device_token = "<PASTE_TOKEN_FROM_RENDER_DASHBOARD>";
   ```
3. Copy your live Render URL from your Render service dashboard.
4. Copy the generated `DEVICE_AUTH_TOKEN` from **Environment** in your Render service dashboard.
5. Compile and flash the ESP32:
   ```bash
   arduino-cli compile --fqbn esp32:esp32:esp32 ./soil_monitor
   arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:esp32 ./soil_monitor
   ```
6. Open Serial Monitor (115200 baud) to monitor live TLS connection and data transmissions:
   ```bash
   arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
   ```
