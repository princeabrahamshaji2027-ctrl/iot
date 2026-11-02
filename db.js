const { Pool } = require('pg');

let pool = null;
let isDbConnected = false;

// In-memory fallback storage for local development/testing without PostgreSQL
const memoryReadings = [];

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    const isProduction = process.env.NODE_ENV === 'production';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[Database Pool Error]:', err.message);
      isDbConnected = false;
    });
  }
  return pool;
}

async function initDatabase() {
  const p = getPool();
  if (!p) {
    console.warn('[Database] DATABASE_URL not configured. Running with in-memory fallback storage.');
    isDbConnected = false;
    return false;
  }

  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS readings (
          id SERIAL PRIMARY KEY,
          device_id VARCHAR(64) NOT NULL,
          raw INTEGER NOT NULL,
          moisture INTEGER NOT NULL,
          status VARCHAR(32) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_readings_device_created 
          ON readings(device_id, created_at DESC);
      `);
      isDbConnected = true;
      console.log('[Database] PostgreSQL connected and table schema verified.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Database] Failed to initialize PostgreSQL:', err.message);
    isDbConnected = false;
    return false;
  }
}

async function saveReading({ device_id, raw, moisture, status }) {
  const p = getPool();
  if (p && isDbConnected) {
    try {
      const res = await p.query(
        `INSERT INTO readings (device_id, raw, moisture, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, device_id, raw, moisture, status, created_at`,
        [device_id, raw, moisture, status]
      );
      return res.rows[0];
    } catch (err) {
      console.error('[Database] Insert error:', err.message);
      throw err;
    }
  } else {
    // Memory fallback
    const reading = {
      id: memoryReadings.length + 1,
      device_id,
      raw: Number(raw),
      moisture: Number(moisture),
      status,
      created_at: new Date().toISOString()
    };
    memoryReadings.push(reading);
    if (memoryReadings.length > 500) memoryReadings.shift();
    return reading;
  }
}

async function getLatestReading(deviceId) {
  const p = getPool();
  if (p && isDbConnected) {
    const query = deviceId
      ? `SELECT * FROM readings WHERE device_id = $1 ORDER BY created_at DESC LIMIT 1`
      : `SELECT * FROM readings ORDER BY created_at DESC LIMIT 1`;
    const params = deviceId ? [deviceId] : [];
    const res = await p.query(query, params);
    return res.rows[0] || null;
  } else {
    if (memoryReadings.length === 0) return null;
    if (deviceId) {
      for (let i = memoryReadings.length - 1; i >= 0; i--) {
        if (memoryReadings[i].device_id === deviceId) return memoryReadings[i];
      }
      return null;
    }
    return memoryReadings[memoryReadings.length - 1] || null;
  }
}

async function getReadingHistory(deviceId, limit = 50) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const p = getPool();
  if (p && isDbConnected) {
    const query = deviceId
      ? `SELECT * FROM readings WHERE device_id = $1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM readings ORDER BY created_at DESC LIMIT $1`;
    const params = deviceId ? [deviceId, safeLimit] : [safeLimit];
    const res = await p.query(query, params);
    return res.rows.reverse(); // Chronological order
  } else {
    let filtered = deviceId
      ? memoryReadings.filter(r => r.device_id === deviceId)
      : memoryReadings;
    const slice = filtered.slice(-safeLimit);
    return slice;
  }
}

function checkDbHealth() {
  return isDbConnected;
}

module.exports = {
  initDatabase,
  saveReading,
  getLatestReading,
  getReadingHistory,
  checkDbHealth
};

