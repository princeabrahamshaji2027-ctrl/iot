# TASK: Prepare AgroConnect-IoT for Render Blueprint Deployment Using Docker

Act as a senior DevOps engineer and backend developer. I am building a separate ESP32-based IoT soil moisture monitoring project called **AgroConnect-IoT**.

Your job is to inspect my existing project, create a complete and working Render Blueprint configuration, configure Docker deployment, and prepare the project for deployment through GitHub.

IMPORTANT: Do not just explain what I should do. Actually inspect the project, create the required files, modify the necessary code, install dependencies if needed, run tests, and fix errors.

## 1. Inspect the existing project first

Before making any changes:

- Inspect the complete project directory and its folder structure.
- Identify the existing ESP32 firmware, backend, frontend, database code and configuration.
- Identify the programming language and framework currently used.
- Understand how the existing dashboard works.
- Identify how ESP32 currently sends or exposes sensor readings.
- Identify existing dependencies and startup commands.
- Check whether Dockerfile, render.yaml, requirements.txt, or other deployment files already exist.

Do not assume that the project uses a particular framework. Adapt the deployment architecture to the actual codebase.

Do not delete existing working features or replace the application unnecessarily.

Do not modify my main AgroConnect project or unrelated repositories.

## 2. Required cloud architecture

Implement this architecture:

ESP32 Soil Moisture Sensor
        |
        | Reads analog values from GPIO34
        |
        | Sends readings using HTTPS
        v
Render Cloud Backend (Docker Container)
        |
        v
PostgreSQL Database
        |
        v
Public Web Dashboard

The ESP32 is physical hardware. It must NOT be placed inside the Docker container.

The Docker container must host the cloud backend and the web dashboard.

The ESP32 must connect to Wi-Fi and send real sensor readings to the deployed backend.

## 3. Create the Render Blueprint file

Create a valid file named:

render.yaml

Place it in the repository root.

Use the current official Render Blueprint specification:
https://render.com/docs/blueprint-spec

Requirements:

- Define a web service using runtime: docker.
- Configure the correct Dockerfile path and Docker build context based on the actual project structure.
- Configure a suitable healthCheckPath.
- Define a PostgreSQL database using the Blueprint databases section.
- Configure database connection environment variables using Render's supported fromDatabase references.
- Configure all necessary environment variables.
- Generate or securely configure sensitive credentials using supported Render mechanisms.
- Never hardcode database passwords, Wi-Fi passwords, API keys or device tokens.
- Use appropriate service and database names.
- Make sure the YAML syntax and indentation are valid.
- Do not use outdated or unsupported Render Blueprint properties.
- Avoid unnecessary paid resources. Use an appropriate available plan and clearly tell me if a required resource is paid.
- Do not create unnecessary additional services.

The Blueprint must be designed so I can connect the GitHub repository to Render and deploy it using New + → Blueprint.

## 4. Docker configuration

Create or update the following files:

- Dockerfile
- .dockerignore
- .gitignore

Requirements:

- Docker must install all required application dependencies.
- Docker must build the application successfully.
- The container must start the backend using the correct production startup command.
- The application must listen on 0.0.0.0.
- It must use Render's assigned PORT environment variable where supported by the framework.
- The application must not depend on local development paths.
- Do not copy secrets or local environment files into the Docker image.
- Keep the Docker image reasonably small.
- Use production-appropriate settings.

Official Docker deployment documentation:
https://render.com/docs/docker

## 5. Backend and database configuration

Inspect the existing backend before modifying it.

Ensure the backend supports:

POST /api/iot/readings
GET /api/iot/latest
GET /api/iot/history
GET /api/iot/status
GET /health

Requirements:

- Receive ESP32 sensor readings.
- Validate incoming JSON.
- Authenticate the device using a secure token.
- Store readings in PostgreSQL.
- Retrieve the latest reading.
- Retrieve historical readings.
- Calculate or return moisture status.
- Return appropriate HTTP error codes.
- Handle database connection failures safely.
- Use environment variables for database credentials and secrets.
- Use database migrations or safe table initialization.
- Do not generate fake sensor readings in production.

Expected incoming payload:

{
  "device_id": "esp32-soil-01",
  "raw": 2100,
  "moisture": 45,
  "status": "Moderate"
}

Adapt field names to the existing firmware if necessary.

## 6. Frontend dashboard

Preserve the existing dashboard design wherever possible.

Ensure it:

- Displays the latest actual soil moisture percentage.
- Displays the raw sensor value.
- Displays Dry, Moderate or Wet status.
- Shows the last updated timestamp.
- Displays historical readings using a chart if the project already supports one or it can be added without unnecessary complexity.
- Refreshes readings periodically.
- Shows a clear offline/stale status if the ESP32 stops sending data.
- Does not show fabricated readings when no device data exists.
- Works through the public Render URL.
- Does not rely on localhost API URLs in production.

If the frontend and backend are separate, configure their production communication correctly.

## 7. ESP32 firmware changes

Inspect the existing .ino firmware.

Preserve the current sensor calibration and GPIO34 configuration unless there is a technical reason to change it.

Modify the firmware so that:

- ESP32 connects to the configured Wi-Fi network.
- It sends readings to the deployed Render API using HTTPS.
- It sends readings at a reasonable interval, approximately every 10–30 seconds.
- It handles network disconnections and reconnects.
- It handles failed HTTP requests without crashing.
- It uses secure TLS certificate validation.
- It does not use WiFiClientSecure.setInsecure() as a production security shortcut.
- It sends the device authentication token securely configured for the device.
- It prints useful diagnostic information to Serial Monitor.

Keep firmware separate from the backend Docker build.

Clearly document where I must enter the Wi-Fi SSID, Wi-Fi password, Render API URL and device token.

Remember: credentials embedded in firmware can be extracted from the physical device. Document the risks and provide a way to rotate the device token.

## 8. Security requirements

- Never commit .env files.
- Never expose database credentials in frontend JavaScript.
- Never expose the device authentication token in dashboard responses.
- Validate device authentication on incoming readings.
- Use HTTPS for communication.
- Configure CORS only if actually required.
- Avoid permissive production security settings.
- Do not log passwords or authentication tokens.

## 9. Local testing

Before declaring the project ready:

- Validate render.yaml syntax.
- Validate the Dockerfile.
- Build the Docker image.
- Run the container locally.
- Test the health endpoint.
- Test database connectivity.
- Test the API using a sample request in a development/test environment.
- Verify that the dashboard loads.
- Check that no localhost URLs are used for production API calls.
- Check that secrets are not committed.
- Fix any errors discovered.

Do not claim that the physical ESP32 has been tested unless actual hardware has been connected and tested.

## 10. GitHub preparation

Prepare the project for my separate GitHub repository:

AgroConnect-IoT

- Ensure all required files are in the correct repository root.
- Ensure render.yaml is in the root directory.
- Ensure Dockerfile paths match the actual project structure.
- Update README.md with deployment instructions.
- Check .gitignore.
- Show me the exact Git commands needed to push the project.

Do not push to GitHub automatically.
Do not overwrite branches.
Do not delete existing files or commits.

Wait for my approval before any GitHub push or external deployment action.

## 11. Final deployment instructions

When implementation and local tests are complete, provide:

1. Final project folder structure.
2. All files created and modified.
3. Complete render.yaml configuration.
4. Docker build and test results.
5. Required environment variables.
6. Which secrets I must enter manually in Render.
7. Exact GitHub push commands.
8. Exact Render Blueprint deployment steps.
9. Physical ESP32 wiring instructions.
10. Steps to upload firmware.
11. Steps to connect ESP32 to my phone hotspot.
12. Steps to verify live readings on the public dashboard.

## 12. Open the website after deployment

After I approve deployment and the actual Render service successfully deploys:

- Retrieve the real public Render URL from the deployment.
- Open that URL in the browser.
- Verify that the dashboard loads.
- Check the health endpoint.
- Report whether the database is connected.
- Tell me whether live ESP32 readings are arriving.

Do not invent a Render URL or claim that the deployment succeeded without verification.

## IMPORTANT WORKING RULES

Work directly on my existing project.

Do not stop after creating render.yaml.

Do not give me a theoretical tutorial instead of implementing the files.

Do not replace my existing dashboard unnecessarily.

Do not modify unrelated projects.

Do not use mock data to pretend the hardware is working.

If something requires my account login, approval, physical hardware, or a secret, stop at that exact step and tell me what I need to do.

Start by inspecting the project, then implement the complete deployment configuration.