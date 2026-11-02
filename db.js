const { Pool } = require('pg');

let pool = null;
let isDbConnected = false;

// In-memory fallback for offline testing/development when PostgreSQL is not running
const memoryReadings = [];

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    // Supabase (and any remote Postgres) requires SSL; only a local database runs without it
    const isLocalDb = /@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL);
    const sslDisabled = process.env.DATABASE_SSL === 'false';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalDb || sslDisabled ? false : { rejectUnauthorized: false },
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
    console.warn('[Database] DATABASE_URL not set. Running with safe in-memory fallback for local testing.');
    isDbConnected = false;
    return false;
  }

  try {
    const client = await p.connect();
    try {
      // Create table per specification
      await client.query(`
        CREATE TABLE IF NOT EXISTS soil_moisture_readings (
          id SERIAL PRIMARY KEY,
          device_id VARCHAR(64) NOT NULL,
          raw_value INTEGER NOT NULL,
          moisture_percentage INTEGER NOT NULL,
          status VARCHAR(32) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_soil_readings_device_id 
          ON soil_moisture_readings(device_id);
        CREATE INDEX IF NOT EXISTS idx_soil_readings_created_at 
          ON soil_moisture_readings(created_at DESC);
        -- Supabase exposes the public schema through its Data API; enabling RLS with no
        -- policies blocks anon/authenticated access. The backend's postgres role bypasses RLS.
        ALTER TABLE soil_moisture_readings ENABLE ROW LEVEL SECURITY;
      `);
      isDbConnected = true;
      console.log('[Database] PostgreSQL connected: table "soil_moisture_readings" ready with indexes.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Database] PostgreSQL connection failed:', err.message);
    isDbConnected = false;
    return false;
  }
}

async function saveReading({ device_id, raw_value, moisture_percentage, status }) {
  const p = getPool();
  if (p && isDbConnected) {
    try {
      const query = `
        INSERT INTO soil_moisture_readings (device_id, raw_value, moisture_percentage, status)
        VALUES ($1, $2, $3, $4)
        RETURNING id, device_id, raw_value, moisture_percentage, status, created_at;
      `;
      const res = await p.query(query, [device_id, raw_value, moisture_percentage, status]);
      const row = res.rows[0];
      // Attach backward-compatible property aliases
      row.raw = row.raw_value;
      row.moisture = row.moisture_percentage;
      return row;
    } catch (err) {
      console.error('[Database] Failed to insert reading:', err.message);
      throw err;
    }
  } else {
    // In-memory fallback
    const reading = {
      id: memoryReadings.length + 1,
      device_id,
      raw_value: Number(raw_value),
      moisture_percentage: Number(moisture_percentage),
      raw: Number(raw_value),
      moisture: Number(moisture_percentage),
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
      ? `SELECT id, device_id, raw_value, moisture_percentage, status, created_at 
         FROM soil_moisture_readings 
         WHERE device_id = $1 
         ORDER BY created_at DESC LIMIT 1;`
      : `SELECT id, device_id, raw_value, moisture_percentage, status, created_at 
         FROM soil_moisture_readings 
         ORDER BY created_at DESC LIMIT 1;`;
    const params = deviceId ? [deviceId] : [];
    const res = await p.query(query, params);
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    row.raw = row.raw_value;
    row.moisture = row.moisture_percentage;
    return row;
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
    // Sort newest first as specified in Section 6 ("Sort newest first")
    const query = deviceId
      ? `SELECT id, device_id, raw_value, moisture_percentage, status, created_at 
         FROM soil_moisture_readings 
         WHERE device_id = $1 
         ORDER BY created_at DESC LIMIT $2;`
      : `SELECT id, device_id, raw_value, moisture_percentage, status, created_at 
         FROM soil_moisture_readings 
         ORDER BY created_at DESC LIMIT $1;`;
    const params = deviceId ? [deviceId, safeLimit] : [safeLimit];
    const res = await p.query(query, params);
    return res.rows.map(row => {
      row.raw = row.raw_value;
      row.moisture = row.moisture_percentage;
      return row;
    });
  } else {
    let filtered = deviceId
      ? memoryReadings.filter(r => r.device_id === deviceId)
      : memoryReadings;
    const slice = filtered.slice(-safeLimit).reverse(); // Newest first
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
