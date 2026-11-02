# AgroConnect — IoT Soil Moisture Monitoring System

An end-to-end, embedded IoT soil monitoring solution powered by an **ESP32** microcontroller and a capacitive analog soil moisture sensor. The ESP32 reads soil moisture values, hosts an embedded HTTP web server on port 80, and serves a live, responsive dashboard directly to any browser on the local Wi-Fi / hotspot network.

---

## 1. Project Introduction

AgroConnect is a lightweight, self-contained IoT firmware and dashboard designed for agricultural automation, smart gardening, and greenhouse soil moisture tracking. The system operates fully autonomously on the ESP32 without relying on any external cloud platforms, Node.js runtimes, or third-party servers.

---

## 2. Project Objective

- Provide continuous, real-time soil moisture percentage readings.
- Host an embedded web dashboard directly from the ESP32 flash memory.
- Offer JSON API endpoints (`/data`) for automated polling every 2 seconds.
- Deliver non-blocking Wi-Fi reconnection and sensor sampling to guarantee high web server responsiveness.
- Eliminate ADC conflicts with Wi-Fi by utilizing ADC1 (GPIO 34).

---

## 3. Hardware Requirements

- **Microcontroller:** ESP32 Development Board (ESP-WROOM-32 / NodeMCU-32S, 2.4 GHz Wi-Fi).
- **Sensor:** Capacitive Soil Moisture Sensor (v1.2 / v2.0) or compatible analog soil probe.
- **Connection Cables:** 3x DuPont female-to-female/male jumper wires.
- **Power Supply / Cable:** High-quality Micro-USB or USB-C cable (data capable).
- **Network:** 2.4 GHz Wi-Fi network or smartphone personal hotspot.

---

## 4. Software Requirements

- **Operating System:** macOS (macOS 12+, Ventura, Sonoma, Sequoia supported).
- **Toolchain:** `arduino-cli` (v1.x) with Espressif ESP32 Core (`esp32:esp32`).
- **Standard Libraries:** `WiFi.h` and `WebServer.h` (bundled natively in ESP32 Core).
- **Web Browser:** Google Chrome, Safari, Mozilla Firefox, or Microsoft Edge.

---

## 5. Hardware Connection Diagram

```text
+-----------------------------------+             +-------------------------------+
| Capacitive Soil Sensor (v1.2/2.0) |             |    ESP32 Development Board    |
|                                   |             |                               |
|        [ VCC ] -------------------+------------>| 3V3 (3.3V Power Out)          |
|        [ GND ] -------------------+------------>| GND (Common Ground)           |
|        [ AOUT/AO ] ---------------+------------>| GPIO 34 (ADC1_CH6 - Analog In)|
|        [ DOUT/DO ] (N/C)          |             |                               |
+-----------------------------------+             +-------------------------------+
```

> [!WARNING]
> Always power the sensor from the **3.3V (3V3)** pin, NOT 5V/VIN! ESP32 GPIO inputs cannot tolerate 5V.

---

## 6. Project Directory Structure

```text
AgroConnect_IoT/
├── README.md                           # Main project documentation & quickstart
├── agent.md                            # Project requirements & engineering spec
├── soil_monitor.ino                    # Root Arduino sketch file
├── soil_monitor/
│   ├── soil_monitor.ino                # Sketch directory for Arduino CLI compilation
│   └── README.md                       # Sketch-specific documentation
└── documentation/
    ├── hardware_connections.md         # Detailed pinout, ADC analysis & voltage guidelines
    └── setup_guide.md                  # Comprehensive macOS setup & troubleshooting guide
```

---

## 7. Arduino CLI Configuration

Install `arduino-cli`:
```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh
```

Initialize and add the ESP32 board manager index:
```bash
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

---

## 8. Compilation Instructions

To compile the firmware for standard ESP32 boards:
```bash
arduino-cli compile --fqbn esp32:esp32:esp32 ./soil_monitor
```

---

## 9. Firmware Upload Instructions

1. Connect your ESP32 board to your Mac via USB.
2. List available serial ports:
   ```bash
   arduino-cli board list
   ```
3. Upload the compiled binary to your board (replace `/dev/cu.usbserial-XXXX` with your detected device port):
   ```bash
   arduino-cli upload -p /dev/cu.usbserial-XXXX --fqbn esp32:esp32:esp32 ./soil_monitor
   ```
   *Note: If the upload hangs on `Connecting......`, hold down the `BOOT` button on your ESP32 until the flashing progress starts.*

---

## 10. Serial Monitor Instructions

Open the built-in serial monitor at **115200 baud**:
```bash
arduino-cli monitor -p /dev/cu.usbserial-XXXX -c baudrate=115200
```
Press the `RST` / `EN` button on your ESP32 to view boot messages and network assignment.

---

## 11. Wi-Fi Configuration

The firmware is pre-configured with hotspot credentials:
```cpp
const char *ssid = "Nothing Phone (2)_4867";
const char *password = "4256";
```
To adjust credentials, edit lines 10–11 of `soil_monitor/soil_monitor.ino`.

---

## 12. How to Open the Live Web Dashboard

1. **Enable Mobile Hotspot:**
   - Turn on Personal Hotspot on your phone.
   - Verify the hotspot is transmitting on the **2.4 GHz band** (enable "Maximize Compatibility" on iOS or select "2.4 GHz" on Android).
2. **Connect Devices:**
   - Power up the ESP32. It will connect to the phone hotspot within 5–10 seconds.
   - Connect your Mac or laptop to the **same** hotspot network.
3. **Obtain the IP Address:**
   - Open Serial Monitor (`arduino-cli monitor ...`) or check connected clients in your phone's hotspot settings.
   - Look for: `[AgroConnect] Open this address in your browser: http://192.168.X.X`
4. **Access Dashboard:**
   - Open Chrome or Safari and enter:
     ```text
     http://192.168.X.X
     ```
   - The dashboard displays current moisture percentage, a dynamic color-coded progress bar (Red = Dry, Yellow = Moderate, Green = Wet), raw ADC values, and live timestamped updates every 2 seconds.

---

## 13. How to Calibrate the Sensor

Capacitive soil moisture sensors vary across batches:
1. Note the default calibration constants in `soil_monitor.ino`:
   ```cpp
   int DRY_VALUE = 3000;  // Raw value in dry air
   int WET_VALUE = 1300;  // Raw value in cup of water
   ```
2. **Dry Calibration:** Hold the sensor dry in the air. Read `Sensor raw value` on the dashboard or Serial Monitor. Update `DRY_VALUE`.
3. **Wet Calibration:** Dip the sensing probe into water up to the maximum soil line. Read the raw value. Update `WET_VALUE`.
4. Recompile and re-flash the ESP32.

---

## 14. Troubleshooting Common Errors

- **Wi-Fi Connection Failed / Timeout:**
  - Hotspot is running at 5 GHz instead of 2.4 GHz.
  - SSID or password contains a typo.
- **Web page does not load (`ERR_CONNECTION_TIMED_OUT`):**
  - Mac is connected to home Wi-Fi while ESP32 is on phone hotspot. Both must be on the exact same network subnet.
- **Moisture reading is always 0% or 100%:**
  - Verify sensor wiring: VCC to 3V3, GND to GND, AO to GPIO 34.
  - Sensor is not calibrated; raw reading falls outside `DRY_VALUE` and `WET_VALUE`.
- **ESP32 keeps restarting (Brownout detector triggered):**
  - Insufficient USB power supply or degraded USB cable. Use a high-quality data cable directly plugged into the Mac or a powered USB hub.

---

## 15. Current Limitations

- **Local Network Scope:** The web server runs on the local IP address (LAN/WLAN) and is not exposed to the public internet unless configured with port forwarding or MQTT/VPN bridge.
- **Single Client Optimal Performance:** The synchronous lightweight `WebServer` is optimized for 1–4 concurrent browser sessions.

