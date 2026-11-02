const assert = require('assert');
const http = require('http');

process.env.PORT = '10002';
process.env.DEVICE_API_TOKEN = 'secret-device-key-alpha-12345,backup-rotation-key-999';
process.env.NODE_ENV = 'test';

const app = require('../server');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          // Keep raw string
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting AgroConnect PostgreSQL & API Security Test Suite...\n');
  let server;

  try {
    server = app.listen(10002, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));

    // Test 1: Health Check Endpoint
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/health',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200, 'Health check should return 200');
      assert.strictEqual(res.body.status, 'ok', 'Status should be ok');
      console.log('✅ PASS: GET /health returns 200 and reports database status');
    }

    // Test 2: Reject Unauthenticated Request (Missing Token)
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/readings',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { device_id: 'esp32-soil-01', raw_value: 2100, moisture_percentage: 45 });
      assert.strictEqual(res.statusCode, 401, 'Should reject request missing token');
      console.log('✅ PASS: POST /api/iot/readings rejects missing X-Device-Token with 401');
    }

    // Test 3: Reject Invalid Device Token
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'fraudulent-tampered-token'
        }
      }, { device_id: 'esp32-soil-01', raw_value: 2100, moisture_percentage: 45 });
      assert.strictEqual(res.statusCode, 401, 'Should reject invalid token');
      console.log('✅ PASS: POST /api/iot/readings rejects invalid token with 401 Unauthorized');
    }

    // Test 4: Accept Primary Device Token
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'secret-device-key-alpha-12345'
        }
      }, {
        device_id: 'esp32-soil-01',
        raw_value: 2050,
        moisture_percentage: 48,
        status: 'Moderate'
      });
      assert.strictEqual(res.statusCode, 201, 'Should return 201 Created');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.moisture_percentage, 48);
      console.log('✅ PASS: POST /api/iot/readings accepts valid primary device token and records reading');
    }

    // Test 5: Accept Secondary / Rotated Device Token
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'backup-rotation-key-999'
        }
      }, {
        device_id: 'esp32-soil-01',
        raw_value: 1800,
        moisture_percentage: 65,
        status: 'Wet'
      });
      assert.strictEqual(res.statusCode, 201, 'Should accept secondary token for seamless rotation');
      console.log('✅ PASS: Token rotation supported (secondary token authenticated successfully)');
    }

    // Test 6: Payload Validation (Moisture percentage out of range > 100)
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'secret-device-key-alpha-12345'
        }
      }, { device_id: 'esp32-soil-01', raw_value: 1200, moisture_percentage: 150 });
      assert.strictEqual(res.statusCode, 400, 'Should reject moisture > 100');
      console.log('✅ PASS: POST /api/iot/readings rejects out-of-bounds moisture percentage with 400');
    }

    // Test 7: Retrieve Latest Reading
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/latest',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.moisture_percentage, 65, 'Should return the most recent reading');
      console.log('✅ PASS: GET /api/iot/latest returns latest stored reading');
    }

    // Test 8: Historical Readings (Sorted Newest First)
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/history?limit=10',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 2);
      assert.strictEqual(res.body.data[0].moisture_percentage, 65, 'First element must be newest reading');
      assert.strictEqual(res.body.data[1].moisture_percentage, 48, 'Second element must be older reading');
      console.log('✅ PASS: GET /api/iot/history returns chronological history sorted newest first');
    }

    // Test 9: Device Status
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10002,
        path: '/api/iot/status?device_id=esp32-soil-01',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.connection_status, 'online');
      assert.strictEqual(res.body.is_online, true);
      console.log('✅ PASS: GET /api/iot/status correctly identifies recently active device as online');
    }

    console.log('\n🎉 ALL DATABASE AND SECURITY TESTS PASSED!');
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
