# COMPLETE ESP32 DEVELOPMENT ENVIRONMENT SETUP AND HARDWARE DETECTION PREPARATION

Act as a senior embedded systems engineer specializing in ESP32, Arduino, macOS, USB-to-UART drivers and IoT development.

I am working on my existing AgroConnect IoT Soil Moisture Monitoring project.

Previously, I experienced a problem where my MacBook powered the ESP32 (its power LED illuminated), but macOS did not recognize the board as a serial device.

I suspect that my development environment, board packages, USB drivers or USB connection configuration may be incomplete.

I want you to completely inspect, install, configure and verify my ESP32 development environment before I reconnect the physical ESP32.

IMPORTANT: Execute the actual setup commands wherever possible. Do not merely explain how to install things.

## PHASE 1 — INSPECT MY MAC

First identify:

1. macOS version.
2. System architecture (Intel or Apple Silicon).
3. Existing Homebrew installation.
4. Existing Arduino CLI installation.
5. Existing Arduino IDE installation.
6. Existing ESP32 Arduino Core installation.
7. Existing USB serial drivers.
8. Existing serial device permissions and available serial ports.
9. Existing project directory and firmware files.

Check whether the previous installations are valid.

Do not unnecessarily reinstall working dependencies.

## PHASE 2 — INSTALL AND CONFIGURE ARDUINO CLI

If Arduino CLI is missing, install it using the appropriate official method for my macOS architecture.

Verify:

arduino-cli version

Initialize its configuration if necessary:

arduino-cli config init

Configure the official Espressif ESP32 board manager URL:

https://espressif.github.io/arduino-esp32/package_esp32_index.json

Update the package index:

arduino-cli core update-index

Install the ESP32 Arduino Core:

arduino-cli core install esp32:esp32

Verify:

arduino-cli core list

Confirm that the ESP32 platform is installed and usable.

## PHASE 3 — INSTALL AND VERIFY REQUIRED ESP32 LIBRARIES

Inspect my existing firmware.

The project uses:

- WiFi.h
- WebServer.h

Check that these libraries are available through the installed ESP32 Arduino Core.

Do not install duplicate libraries unnecessarily.

Identify any other missing dependencies from the actual source code and install only those required.

## PHASE 4 — INSTALL OR VERIFY USB-TO-SERIAL DRIVER SUPPORT

This is particularly important because my Mac previously powered the ESP32 but failed to detect its serial interface.

Inspect the macOS USB serial driver environment.

Check support for the following USB-to-UART chip families:

1. Silicon Labs CP2102 / CP210x.
2. WCH CH340 / CH341.
3. FTDI USB-to-Serial.
4. Native ESP32 USB serial/JTAG interfaces, if applicable.

IMPORTANT DRIVER RULES:

- Do not install every available driver blindly.
- Do not install unofficial or suspicious driver packages.
- Prefer official manufacturer drivers.
- Check macOS version and processor compatibility before installation.
- If a driver requires elevated privileges, explain the installation and ask for approval.
- If macOS requires a restart or user approval under Privacy & Security, tell me.
- Do not claim a driver is installed unless verified.

Since the physical ESP32 is not currently available for chip identification, prepare the environment and explain that the correct USB driver can only be selected confidently after identifying the actual USB interface.

Official driver sources:

Silicon Labs:
https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers

WCH:
https://www.wch-ic.com/downloads/CH341SER_MAC_ZIP.html

FTDI:
https://ftdichip.com/drivers/

## PHASE 5 — VERIFY MACOS SERIAL SUPPORT

Inspect the available serial interfaces using:

ls /dev/cu.*

ls /dev/tty.*

system_profiler SPUSBDataType

Check available USB devices and driver information using appropriate macOS commands.

Run:

arduino-cli board list

Explain which devices are internal Bluetooth interfaces and which devices could represent an ESP32 serial connection.

Do not mistake Bluetooth ports for the ESP32.

## PHASE 6 — VERIFY THE EXISTING AGROCONNECT PROJECT

Locate the existing project and inspect:

soil_monitor/soil_monitor.ino

Verify:

- Correct ESP32 firmware structure.
- GPIO 34 sensor configuration.
- Existing Wi-Fi SSID and password preserved.
- Soil moisture calibration values preserved.
- Wi-Fi connection and reconnection logic.
- HTTP server on port 80.
- Root dashboard endpoint.
- /data JSON endpoint.
- Embedded HTML, CSS and JavaScript.

Do not unnecessarily redesign or rewrite the dashboard.

## PHASE 7 — COMPILE THE PROJECT WITHOUT HARDWARE

Use the existing ESP32 board configuration.

Run:

arduino-cli compile --fqbn esp32:esp32:esp32 ./soil_monitor

Resolve any compilation errors.

Verify:

- Firmware compiles successfully.
- Required libraries are available.
- Memory usage is reported.
- Generated firmware files are available.

Do not attempt firmware upload because the physical ESP32 has not yet been connected.

## PHASE 8 — PREPARE HARDWARE DETECTION PROCEDURE

Prepare the commands that will be used when I connect my ESP32.

The next hardware detection commands should include:

system_profiler SPUSBDataType

ls /dev/cu.*

arduino-cli board list

Explain how to identify the USB-to-UART chip and its corresponding serial port.

Prepare the upload command using the actual detected serial port, but do not execute it.

## PHASE 9 — IMPORTANT STOP CONDITION

THIS IS MANDATORY.

After completing all possible software installations, configurations, driver checks, project verification and firmware compilation:

STOP ALL FURTHER EXECUTION.

Do not ask me to turn on my phone hotspot yet.

Do not attempt to upload firmware.

Do not invent a serial port.

Do not claim that the physical ESP32 has been detected.

Instead, display a clear message:

"SOFTWARE ENVIRONMENT READY.

All possible software dependencies and board configurations have been checked.

Your firmware has been compiled if the compiler confirms success.

Now connect your physical ESP32 directly to your MacBook using a known USB data cable.

Avoid using the docking station initially.

Once connected, tell me to notify you so that you can scan the USB devices again and identify the correct driver and serial port."

Wait for my response before continuing to hardware detection.

## STRICT RULES

1. Work on macOS, not Windows.
2. Use official software and driver sources.
3. Preserve all existing project files.
4. Never expose Wi-Fi credentials.
5. Do not install unnecessary dependencies.
6. Do not modify unrelated projects.
7. Do not commit or push unrelated Git changes.
8. Execute safe installation and verification tasks.
9. Ask permission for privileged operations.
10. Report actual results, not assumptions.
11. Stop before physical hardware connection.

FINAL OBJECTIVE:

Prepare a fully configured macOS ESP32 development environment that is ready to recognize my physical ESP32, compile the AgroConnect firmware and upload it once I connect the board.

Start with PHASE 1 and continue sequentially until the mandatory stop condition.