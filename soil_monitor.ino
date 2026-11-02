#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "certs.h"

// ===========================================================================
// AgroConnect IoT — ESP32 Cloud Telemetry Firmware (Render HTTPS Client)
// ===========================================================================
//
// CONFIGURATION INSTRUCTIONS:
// 1. Enter your Wi-Fi SSID and Password below.
// 2. Set api_url to your live Render endpoint:
//    "https://agroconnect-backend-ln2g.onrender.com/api/iot/readings"
// 3. Set device_token to the DEVICE_API_TOKEN from your Render Dashboard.
// 4. IMPORTANT SECURITY NOTE:
//    Tokens embedded in microcontroller firmware can be extracted if physical
//    access to the board is compromised. To rotate the token:
//    - Generate a new 32-byte hex token (e.g., openssl rand -hex 32)
//    - Add it to DEVICE_API_TOKEN in Render Environment (supports comma-separated list)
//    - Update device_token below and re-flash the board.
// ===========================================================================

// --- Wi-Fi Settings ---
const char *ssid = "Nothing Phone (2)_4867";
const char *password = "4256";

// --- Render Cloud Backend Settings ---
const char *api_url = "https://agroconnect-backend-ln2g.onrender.com/api/iot/readings";

// --- Device Authentication ---
const char *device_id = "esp32-soil-01";
const char *device_token = "REPLACE_WITH_YOUR_RENDER_DEVICE_API_TOKEN";

// --- Hardware & Calibration Settings ---
const int SOIL_PIN = 34; // ADC1 Channel 6 (No Wi-Fi conflict)

// Calibrated values: dry air ~ 3000, submerged in water ~ 1300
int DRY_VALUE = 3000;
int WET_VALUE = 1300;

// Telemetry interval: Send reading every 20 seconds
const unsigned long TELEMETRY_INTERVAL_MS = 20000;
unsigned long lastTelemetryTime = 0;

// Wi-Fi reconnection interval: retry every 5s if disconnected
const unsigned long WIFI_RETRY_INTERVAL_MS = 5000;
unsigned long lastWifiRetryTime = 0;

// ---------------------------------------------------------------------------
// Analog Reading with Multi-sample Averaging
// ---------------------------------------------------------------------------
int readSoilRaw() {
  long total = 0;
  const int SAMPLES = 10;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogRead(SOIL_PIN);
    delayMicroseconds(500); // 0.5ms delay (total ~5ms)
  }
  return (int)(total / SAMPLES);
}

// ---------------------------------------------------------------------------
// Moisture Percentage Calculation with Bounds Protection
// ---------------------------------------------------------------------------
int readMoisturePercent(int raw) {
  if (DRY_VALUE == WET_VALUE) return 0;
  int percent = map(raw, DRY_VALUE, WET_VALUE, 0, 100);
  return constrain(percent, 0, 100);
}

// ---------------------------------------------------------------------------
// Moisture Status Classification
// ---------------------------------------------------------------------------
String getStatus(int percent) {
  if (percent < 30) return "Dry";
  if (percent < 60) return "Moderate";
  return "Wet";
}

// ---------------------------------------------------------------------------
// Wi-Fi Connection & Reconnection Handler
// ---------------------------------------------------------------------------
void handleWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  unsigned long now = millis();
  if (now - lastWifiRetryTime >= WIFI_RETRY_INTERVAL_MS) {
    lastWifiRetryTime = now;
    Serial.println("[AgroConnect] Wi-Fi lost. Attempting reconnection...");
    WiFi.reconnect();
  }
}

// ---------------------------------------------------------------------------
// HTTPS Telemetry Transmission to Render Cloud
// ---------------------------------------------------------------------------
void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[AgroConnect] Skipping telemetry: Wi-Fi not connected.");
    return;
  }

  // 1. Read sensor
  int raw = readSoilRaw();
  int moisture = readMoisturePercent(raw);
  String status = getStatus(moisture);

  Serial.println("\n-------------------------------------------");
  Serial.printf("[AgroConnect] Sensor Reading -> Raw: %d, Moisture: %d%%, Status: %s\n",
                raw, moisture, status.c_str());

  // 2. Build JSON payload conforming to PostgreSQL schema fields
  String payload = "{";
  payload += "\"device_id\":\"" + String(device_id) + "\",";
  payload += "\"raw_value\":" + String(raw) + ",";
  payload += "\"moisture_percentage\":" + String(moisture) + ",";
  payload += "\"status\":\"" + status + "\"";
  payload += "}";

  // 3. Configure TLS with official Root CA certificate (No setInsecure!)
  WiFiClientSecure client;
  client.setCACert(root_ca);
  client.setTimeout(10000); // 10s socket timeout

  HTTPClient https;
  Serial.printf("[AgroConnect] Connecting to HTTPS endpoint: %s\n", api_url);

  if (https.begin(client, api_url)) {
    https.addHeader("Content-Type", "application/json");
    https.addHeader("X-Device-Token", device_token);
    https.addHeader("User-Agent", "ESP32-AgroConnect/1.0");

    int httpCode = https.POST(payload);

    if (httpCode > 0) {
      Serial.printf("[AgroConnect] HTTPS Response Code: %d\n", httpCode);
      if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
        String response = https.getString();
        Serial.printf("[AgroConnect] Cloud Response: %s\n", response.c_str());
      } else {
        Serial.printf("[AgroConnect] Cloud rejected reading (Code: %d)\n", httpCode);
        String response = https.getString();
        Serial.printf("[AgroConnect] Error Details: %s\n", response.c_str());
      }
    } else {
      Serial.printf("[AgroConnect] HTTPS POST failed, error: %s\n",
                    https.errorToString(httpCode).c_str());
    }

    https.end();
  } else {
    Serial.println("[AgroConnect] Unable to initialize HTTPS connection to Render.");
  }
}

// ---------------------------------------------------------------------------
// Arduino Setup
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==============================================");
  Serial.println("  AgroConnect IoT — Render HTTPS Telemetry    ");
  Serial.println("==============================================");

  analogReadResolution(12);
  pinMode(SOIL_PIN, INPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.printf("[AgroConnect] Connecting to Wi-Fi SSID: %s", ssid);
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[AgroConnect] Wi-Fi connected successfully!");
    Serial.print("[AgroConnect] ESP32 Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[AgroConnect] RSSI Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n[AgroConnect] Initial Wi-Fi connection timed out.");
    Serial.println("[AgroConnect] Background reconnection active.");
  }

  // Send first telemetry packet immediately
  sendTelemetry();
  lastTelemetryTime = millis();
}

// ---------------------------------------------------------------------------
// Arduino Main Loop
// ---------------------------------------------------------------------------
void loop() {
  handleWiFi();

  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    sendTelemetry();
  }

  delay(100);
}
