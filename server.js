require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const {
  initDatabase,
  saveReading,
  getLatestReading,
  getReadingHistory,
  checkDbHealth
} = require('./db');

const app = express();
const PORT = process.env.PORT || 10000;
const DEVICE_AUTH_TOKEN = process.env.DEVICE_AUTH_TOKEN;

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    }
  }
}));
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Health Endpoint (Render Health Check)
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  const dbStatus = checkDbHealth() ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    service: 'agroconnect-iot-backend',
    database: dbStatus,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// ---------------------------------------------------------------------------
// Device Authentication Middleware
// ---------------------------------------------------------------------------
function authenticateDevice(req, res, next) {
  if (!DEVICE_AUTH_TOKEN) {
    // If not configured in environment, allow with warning (local dev friendly)
    return next();
  }

  const tokenHeader = req.headers['x-device-token'];
  let bearerToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const providedToken = tokenHeader || bearerToken || req.body.token;

  if (!providedToken || providedToken !== DEVICE_AUTH_TOKEN) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing device authentication token'
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// API: Ingest Soil Moisture Reading (POST /api/iot/readings)
// ---------------------------------------------------------------------------
app.post('/api/iot/readings', authenticateDevice, async (req, res) => {
  const { device_id, raw, moisture, status } = req.body;

  // Validation
  if (!device_id || typeof device_id !== 'string') {
    return res.status(400).json({ error: 'Validation failed', message: 'Field "device_id" is required (string).' });
  }

  const rawNum = Number(raw);
  const moistureNum = Number(moisture);

  if (isNaN(rawNum) || rawNum < 0 || rawNum > 4095) {
    return res.status(400).json({ error: 'Validation failed', message: 'Field "raw" must be an integer between 0 and 4095.' });
  }

  if (isNaN(moistureNum) || moistureNum < 0 || moistureNum > 100) {
    return res.status(400).json({ error: 'Validation failed', message: 'Field "moisture" must be a percentage between 0 and 100.' });
  }

  // Derive status if not supplied or validate
  let resolvedStatus = status;
  if (!resolvedStatus) {
    if (moistureNum < 30) resolvedStatus = 'Dry';
    else if (moistureNum < 60) resolvedStatus = 'Moderate';
    else resolvedStatus = 'Wet';
  }

  try {
    const saved = await saveReading({
      device_id: device_id.trim(),
      raw: Math.round(rawNum),
      moisture: Math.round(moistureNum),
      status: resolvedStatus
    });

    return res.status(201).json({
      success: true,
      message: 'Sensor reading recorded successfully',
      data: saved
    });
  } catch (err) {
    console.error('[API Error /readings]:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to record sensor reading.' });
  }
});

// ---------------------------------------------------------------------------
// API: Latest Reading (GET /api/iot/latest)
// ---------------------------------------------------------------------------
app.get('/api/iot/latest', async (req, res) => {
  const deviceId = req.query.device_id;
  try {
    const reading = await getLatestReading(deviceId);
    if (!reading) {
      return res.status(200).json({
        status: 'no_data',
        message: 'No sensor readings recorded yet. Awaiting initial transmission from ESP32.'
      });
    }

    res.status(200).json({
      status: 'success',
      data: reading
    });
  } catch (err) {
    console.error('[API Error /latest]:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve latest reading.' });
  }
});

// ---------------------------------------------------------------------------
// API: Historical Readings (GET /api/iot/history)
// ---------------------------------------------------------------------------
app.get('/api/iot/history', async (req, res) => {
  const deviceId = req.query.device_id;
  const limit = req.query.limit || 50;

  try {
    const history = await getReadingHistory(deviceId, limit);
    res.status(200).json({
      status: 'success',
      count: history.length,
      data: history
    });
  } catch (err) {
    console.error('[API Error /history]:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve reading history.' });
  }
});

// ---------------------------------------------------------------------------
// API: Device Connectivity Status (GET /api/iot/status)
// ---------------------------------------------------------------------------
app.get('/api/iot/status', async (req, res) => {
  const deviceId = req.query.device_id || 'esp32-soil-01';

  try {
    const latest = await getLatestReading(deviceId);
    if (!latest) {
      return res.status(200).json({
        device_id: deviceId,
        connection_status: 'never_connected',
        is_online: false,
        last_seen: null,
        seconds_ago: null
      });
    }

    const lastTime = new Date(latest.created_at).getTime();
    const now = Date.now();
    const secondsAgo = Math.max(0, Math.floor((now - lastTime) / 1000));

    // Status classification:
    // Online: < 60 seconds (ESP32 reports every 15-30s)
    // Stale:  60 - 300 seconds (1 to 5 minutes)
    // Offline: > 300 seconds
    let connectionStatus = 'online';
    if (secondsAgo > 300) {
      connectionStatus = 'offline';
    } else if (secondsAgo > 60) {
      connectionStatus = 'stale';
    }

    res.status(200).json({
      device_id: deviceId,
      connection_status: connectionStatus,
      is_online: connectionStatus === 'online',
      last_seen: latest.created_at,
      seconds_ago: secondsAgo
    });
  } catch (err) {
    console.error('[API Error /status]:', err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve device status.' });
  }
});

// Start Server
async function start() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AgroConnect Backend] Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;

