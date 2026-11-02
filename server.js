require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
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

// Device authentication token(s) configured in environment
// Supports comma-separated tokens for zero-downtime key rotation
const CONFIGURED_TOKENS_RAW = process.env.DEVICE_API_TOKEN || process.env.DEVICE_AUTH_TOKEN || '';
const VALID_TOKEN_HASHES = CONFIGURED_TOKENS_RAW
  .split(',')
  .map(t => t.trim())
  .filter(t => t.length > 0)
  .map(token => crypto.createHash('sha256').update(token).digest());

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
// Health Check (Render Health Probe)
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
// Device Authentication Middleware (Hashed Token & Constant-time Comparison)
// ---------------------------------------------------------------------------
function authenticateDevice(req, res, next) {
  if (VALID_TOKEN_HASHES.length === 0) {
    // If no token is configured in development environment, allow with warning
    return next();
  }

  const tokenHeader = req.headers['x-device-token'];
  let bearerToken = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }

  const incomingToken = tokenHeader || bearerToken || (req.body && req.body.token);

  if (!incomingToken || typeof incomingToken !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing device authentication token in X-Device-Token header'
    });
  }

  // Hash incoming token and perform timing-safe comparison to prevent side-channel leaks
  const incomingHash = crypto.createHash('sha256').update(incomingToken.trim()).digest();

  let isAuthenticated = false;
  for (const validHash of VALID_TOKEN_HASHES) {
    if (crypto.timingSafeEqual(incomingHash, validHash)) {
      isAuthenticated = true;
      break;
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid device authentication token'
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// Ingest Soil Moisture Reading (POST /api/iot/readings)
// ---------------------------------------------------------------------------
app.post('/api/iot/readings', authenticateDevice, async (req, res) => {
  const { device_id } = req.body;
  // Support both schema naming styles: raw_value / raw, moisture_percentage / moisture
  const rawInput = req.body.raw_value !== undefined ? req.body.raw_value : req.body.raw;
  const moistureInput = req.body.moisture_percentage !== undefined ? req.body.moisture_percentage : req.body.moisture;
  let { status } = req.body;

  // Validation: device_id
  if (!device_id || typeof device_id !== 'string' || device_id.trim().length === 0) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Field "device_id" is required and must be a non-empty string.'
    });
  }

  // Validation: raw ADC reading
  const rawNum = Number(rawInput);
  if (isNaN(rawNum) || rawNum < 0 || rawNum > 4095) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Field "raw_value" (or "raw") must be an integer between 0 and 4095.'
    });
  }

  // Validation: moisture percentage
  const moistureNum = Number(moistureInput);
  if (isNaN(moistureNum) || moistureNum < 0 || moistureNum > 100) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Field "moisture_percentage" (or "moisture") must be a number between 0 and 100.'
    });
  }

  // Derive status if not supplied or ensure valid value
  if (!status || !['Dry', 'Moderate', 'Wet'].includes(status)) {
    if (moistureNum < 30) status = 'Dry';
    else if (moistureNum < 60) status = 'Moderate';
    else status = 'Wet';
  }

  try {
    const saved = await saveReading({
      device_id: device_id.trim(),
      raw_value: Math.round(rawNum),
      moisture_percentage: Math.round(moistureNum),
      status
    });

    return res.status(201).json({
      success: true,
      message: 'Soil moisture reading recorded successfully in PostgreSQL',
      data: saved
    });
  } catch (err) {
    console.error('[API Error /readings]:', err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to record sensor reading in database.'
    });
  }
});

// ---------------------------------------------------------------------------
// Latest Reading (GET /api/iot/latest)
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
    console.error('[API Error /latest]:', err.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve latest reading.' });
  }
});

// ---------------------------------------------------------------------------
// Historical Readings (GET /api/iot/history) - Sorted Newest First
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
    console.error('[API Error /history]:', err.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve reading history.' });
  }
});

// ---------------------------------------------------------------------------
// Device Connectivity Status (GET /api/iot/status)
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
    console.error('[API Error /status]:', err.message);
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
