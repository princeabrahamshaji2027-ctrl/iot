# TASK: Configure Render PostgreSQL Database, API Authentication and Secure Cloud Deployment for AgroConnect-IoT

Act as a senior backend developer, database engineer and DevOps engineer.

I am developing a separate project called **AgroConnect-IoT**, an ESP32-based soil moisture monitoring system.

I want you to implement a complete PostgreSQL database integration and secure API authentication system for deployment on Render using Docker and Render Blueprints.

IMPORTANT:
Do not just explain the implementation. Inspect my existing project, modify the actual files, install required dependencies, configure the database integration, test everything and prepare the application for deployment.

Do not modify my main AgroConnect project or unrelated repositories.

---

## 1. Inspect the existing project

First inspect:

- Existing backend framework and source code.
- Existing ESP32 firmware.
- Existing frontend/dashboard.
- Current API endpoints.
- Existing database integration, if any.
- Existing Dockerfile.
- Existing render.yaml.
- Existing environment variables and configuration files.

Understand the current architecture before making changes.

Preserve working functionality and the existing dashboard design.

Do not unnecessarily rewrite the project using another framework.

## 2. Configure PostgreSQL on Render

I want PostgreSQL as the permanent data storage system for the IoT application.

Use Render PostgreSQL.

Official documentation:
https://render.com/docs/databases

Configure the database through the Render Blueprint file:

render.yaml

Requirements:

- Define a PostgreSQL database under the Blueprint databases section.
- Give it a suitable name, such as `agroconnect-iot-db`.
- Configure the correct database name and user.
- Configure the database connection through Render's supported environment variable references.
- Use the internal database connection URL for the backend when the web service and database are hosted in the same Render region.
- Configure DATABASE_URL using a supported fromDatabase property.
- Never hardcode database credentials.
- Do not expose database credentials to frontend JavaScript.
- Do not use a public database URL when an internal connection is appropriate.
- Select an appropriate available database plan and clearly identify any charges or limitations before deployment.

Do not assume a database is free or permanent. Check the current available Render plans.

## 3. Implement PostgreSQL integration in the backend

Use the existing framework and architecture.

Configure the appropriate PostgreSQL driver and database library.

For example, if the backend uses Python FastAPI, use an appropriate PostgreSQL driver and SQLAlchemy. Do not install unnecessary packages if an equivalent integration already exists.

Create a proper database model/table for soil moisture readings.

Suggested schema:

Table: soil_moisture_readings

Fields:

- id: Primary key.
- device_id: Device identifier.
- raw_value: Raw ESP32 ADC reading.
- moisture_percentage: Moisture percentage.
- status: Dry, Moderate or Wet.
- created_at: Timestamp with timezone.

Add appropriate indexes for:

- device_id
- created_at

Requirements:

- Create tables safely during initial setup or use migrations.
- Do not delete existing readings during application restarts or redeployments.
- Use parameterized queries or ORM operations.
- Handle database connection errors.
- Use connection pooling where appropriate.
- Ensure database timestamps are stored consistently.
- Make the database integration production-ready.

## 4. Generate a secure device API key

I need a separate authentication key for my ESP32 device.

Generate a cryptographically secure random device token of at least 32 random bytes.

Requirements:

- Generate the token using a cryptographically secure random generator.
- Do not use predictable strings, timestamps or ordinary random functions.
- Do not hardcode the token into public source files.
- Do not commit the token to GitHub.
- Do not expose the token in dashboard responses or logs.
- Configure the backend to validate incoming device requests using this token.
- Support token rotation.

If possible, store a hash of the device token on the backend and compare incoming tokens securely.

If implementing hashed-token verification, document how the original token is generated and supplied to the ESP32.

Provide a secure local generation method if needed, such as:

openssl rand -hex 32

The generated token must be shown to me only when necessary for initial device configuration. Do not silently write it into a committed source file.

I will manually enter the token into Render's environment variable settings and into the ESP32 firmware configuration.

Use a clear environment variable name, such as:

DEVICE_API_TOKEN

Never confuse this application token with a Render account API key.

## 5. Render account API key handling

Explain the difference between:

1. Render account API key.
2. ESP32 device authentication token.

If a Render account API key is required for deployment automation:

- Tell me to generate it from my own authenticated Render account.
- Direct me to the relevant API key settings in the Render dashboard.
- Do not ask me to paste it into GitHub.
- Do not embed it in Docker images, ESP32 firmware or frontend code.
- Use it only as a protected secret in an approved deployment automation environment if genuinely required.

Do not generate a fake Render account API key. You cannot create an account-level key without authorized access to my Render account.

If Blueprint deployment does not require a Render account API key, do not introduce one unnecessarily.

## 6. Implement authenticated API endpoints

Ensure these endpoints work with PostgreSQL:

POST /api/iot/readings

Purpose:
Receive new ESP32 sensor readings.

Requirements:
- Validate device authentication.
- Validate JSON fields.
- Validate moisture percentage between 0 and 100.
- Validate raw ADC values within the supported range.
- Save actual readings to PostgreSQL.
- Return a successful response only after the database operation succeeds.

GET /api/iot/latest

Purpose:
Return the latest stored reading.

GET /api/iot/history

Purpose:
Return historical readings from PostgreSQL.

Requirements:
- Support a reasonable limit.
- Sort newest first.
- Avoid returning unlimited database records.

GET /api/iot/status

Purpose:
Return whether the device is online or offline based on the last successful reading.

GET /health

Purpose:
Check application health and database connectivity.

Do not expose the device API key in any endpoint response.

Use appropriate HTTP status codes for authentication errors, invalid input and database failures.

## 7. Connect ESP32 to the cloud API

Inspect my existing `.ino` file.

Preserve:

- GPIO34 sensor input.
- Existing soil moisture calibration.
- Raw ADC readings.
- Moisture percentage calculation.
- Dry, Moderate and Wet classification.

Modify the firmware to:

- Connect to my configured Wi-Fi network.
- Send sensor readings to my deployed Render HTTPS endpoint.
- Include the device authentication token in the request header.
- Send JSON containing device ID, raw reading, moisture percentage and status.
- Send readings every 10–30 seconds.
- Reconnect after Wi-Fi disconnection.
- Handle HTTP errors and retry safely.
- Use HTTPS with certificate validation.
- Do not use `setInsecure()` as a production solution.

Use a request header such as:

X-Device-Token: DEVICE_API_TOKEN

Keep Wi-Fi credentials and the device token out of GitHub.

Document the physical firmware configuration steps.

Remember that a token compiled into firmware can be extracted from a physical device. Document this limitation and how to rotate the token.

## 8. Configure Render environment variables

Update render.yaml with the appropriate environment variable definitions.

At minimum, configure:

DATABASE_URL
DEVICE_API_TOKEN
ENVIRONMENT
PORT (only if required by the framework; respect Render's assigned port)

Use Render-supported secret and database reference mechanisms.

Do not put actual secrets inside render.yaml.

Tell me exactly which variables Render generates automatically and which ones I must enter manually.

If the Blueprint uses a generated secret mechanism, use the currently supported syntax.

## 9. Docker configuration

Verify that:

- Dockerfile installs the required PostgreSQL dependencies.
- The application starts correctly.
- The service listens on 0.0.0.0.
- Render's assigned port is respected.
- Database environment variables are read at runtime.
- Secrets are not copied into the image.
- `.dockerignore` excludes unnecessary files.
- `.gitignore` excludes `.env` and other sensitive files.

Build and run the Docker container locally.

## 10. Test the complete database and API integration

Perform actual tests in a local development environment using a test database.

Test:

1. Backend starts successfully.
2. PostgreSQL connection succeeds.
3. Database tables are created.
4. A valid authenticated device request is accepted.
5. The reading is saved to PostgreSQL.
6. The latest-reading endpoint returns the saved reading.
7. The history endpoint returns stored readings.
8. An invalid token is rejected.
9. Invalid moisture percentages are rejected.
10. Database disconnection is handled safely.
11. Health endpoint reports database connectivity correctly.

Use test data only in the test environment.

Never claim that physical ESP32 data has been received unless actual hardware has been connected.

## 11. Render deployment preparation

Prepare the complete render.yaml Blueprint.

Validate:

- YAML syntax.
- Service names.
- Dockerfile path.
- Database definition.
- Database connection references.
- Secret environment variable configuration.
- Health-check endpoint.
- Docker startup configuration.

Ensure the Blueprint can be deployed from my separate GitHub repository named:

AgroConnect-IoT

Do not push to GitHub automatically.

Do not deploy paid resources without showing me the plan and requesting my approval.

## 12. Final report

After implementation, give me:

1. PostgreSQL database schema.
2. Files created and modified.
3. Complete render.yaml configuration.
4. Docker build and test results.
5. Device API authentication implementation.
6. Confirmation that the API key is not exposed in GitHub.
7. Exact Render dashboard steps to create/deploy the database and service.
8. Exact environment variable names and values I must configure.
9. How to generate and configure the device token.
10. How to upload the modified ESP32 firmware.
11. How to verify that readings are stored in PostgreSQL.
12. How to rotate the device API token.

Do not stop after creating the database configuration.

Implement, test and prepare the complete integration.

If an action requires my Render login, account permission, secret or approval, stop and tell me exactly what I must do.