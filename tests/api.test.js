const assert = require('assert');
const http = require('http');
process.env.PORT = '10001';
process.env.DEVICE_AUTH_TOKEN = 'test-secret-token-123';
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
          // Keep as string if not JSON
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
  console.log('🧪 Starting AgroConnect Backend API Test Suite...\n');
  let server;

  try {
    server = app.listen(10001, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));

    // Test 1: Health Check Endpoint
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/health',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200, 'Health check should return 200');
      assert.strictEqual(res.body.status, 'ok', 'Status should be ok');
      console.log('✅ PASS: GET /health returns 200 and status: ok');
    }

    // Test 2: Unauthorized POST /api/iot/readings (Missing Token)
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/readings',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { device_id: 'esp32-soil-01', raw: 2100, moisture: 45 });
      assert.strictEqual(res.statusCode, 401, 'Should reject request missing authentication token');
      console.log('✅ PASS: POST /api/iot/readings rejects missing device token with 401 Unauthorized');
    }

    // Test 3: Unauthorized POST /api/iot/readings (Wrong Token)
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'wrong-token'
        }
      }, { device_id: 'esp32-soil-01', raw: 2100, moisture: 45 });
      assert.strictEqual(res.statusCode, 401, 'Should reject wrong device token');
      console.log('✅ PASS: POST /api/iot/readings rejects invalid token with 401');
    }

    // Test 4: Payload Validation (Missing device_id)
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'test-secret-token-123'
        }
      }, { raw: 2100, moisture: 45 });
      assert.strictEqual(res.statusCode, 400, 'Should reject missing device_id');
      console.log('✅ PASS: POST /api/iot/readings rejects invalid payload with 400');
    }

    // Test 5: Successful Telemetry Ingestion
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/readings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': 'test-secret-token-123'
        }
      }, {
        device_id: 'esp32-soil-01',
        raw: 2100,
        moisture: 45,
        status: 'Moderate'
      });
      assert.strictEqual(res.statusCode, 201, 'Should return 201 Created');
      assert.strictEqual(res.body.success, true, 'Should confirm success');
      assert.strictEqual(res.body.data.moisture, 45, 'Should save moisture');
      console.log('✅ PASS: POST /api/iot/readings successfully accepts and stores reading');
    }

    // Test 6: Retrieve Latest Reading
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/latest',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200, 'Should return 200');
      assert.strictEqual(res.body.data.moisture, 45, 'Should return stored latest reading');
      console.log('✅ PASS: GET /api/iot/latest returns the most recent reading');
    }

    // Test 7: Historical Readings
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/history?limit=10',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200, 'Should return 200');
      assert.ok(Array.isArray(res.body.data), 'History should be an array');
      assert.strictEqual(res.body.data.length, 1, 'Should have 1 recorded entry');
      console.log('✅ PASS: GET /api/iot/history returns array of chronological readings');
    }

    // Test 8: Device Status Tracking
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/api/iot/status?device_id=esp32-soil-01',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200, 'Should return 200');
      assert.strictEqual(res.body.connection_status, 'online', 'Recently reported reading should be marked online');
      console.log('✅ PASS: GET /api/iot/status accurately marks device as online');
    }

    // Test 9: Web Dashboard Static File Serving
    {
      const res = await makeRequest({
        hostname: '127.0.0.1',
        port: 10001,
        path: '/',
        method: 'GET'
      });
      assert.strictEqual(res.statusCode, 200, 'Should return 200 for index.html');
      assert.ok(typeof res.body === 'string' && res.body.includes('AgroConnect'), 'Dashboard HTML should contain AgroConnect branding');
      console.log('✅ PASS: GET / serves public web dashboard HTML');
    }

    console.log('\n🎉 ALL 9 AUTOMATED TESTS PASSED SUCCESSFULLY!');
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

