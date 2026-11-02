-- AgroConnect-IoT schema for Supabase. The backend also runs this on startup (db.js),
-- so applying it manually in the Supabase SQL Editor is optional.
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

-- Block Supabase Data API (anon/authenticated) access; the backend connects as postgres.
ALTER TABLE soil_moisture_readings ENABLE ROW LEVEL SECURITY;
