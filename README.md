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
| PostgreSQL  | | Public Dashboard   |
| Database    | | (Live Gauge/Chart) |
+-------------+ +--------------------+
```

---

## 2. Project Directory Structure

```text
AgroConnect-IoT/
├── render.yaml               # Render Blueprint (Web service + PostgreSQL)
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

## 5. Render Blueprint Deployment Steps

### Step 1: Push Project to GitHub
```bash
git add .
git commit -m "Configure Render Blueprint, Dockerfile, PostgreSQL backend and ESP32 HTTPS telemetry"
git push origin main
```

### Step 2: Deploy on Render
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** in the top navigation and select **Blueprint**.
3. Connect your repository: `princeabrahamshaji2027-ctrl/iot` (or `AgroConnect-IoT`).
4. Render will parse `render.yaml` and display the planned resources:
   - **Service:** `agroconnect-backend` (Web Service, Docker runtime, Free plan)
   - **Database:** `agroconnect-db` (PostgreSQL, Free plan)
5. Click **Apply**.
6. Render will automatically:
   - Provision the managed PostgreSQL database.
   - Build the Docker container.
   - Inject the `DATABASE_URL` connection string into the web service.
   - Automatically generate a secure cryptographic `DEVICE_AUTH_TOKEN`.
   - Start the service and verify `/health`.

> [!NOTE]
> Render's Free PostgreSQL database expires after 30 days. For permanent long-term data retention, you can upgrade the database plan to *Starter* ($7/month) in the Render dashboard.

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
