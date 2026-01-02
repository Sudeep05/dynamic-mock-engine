# Dynamic Mock Enginer(DME): User & Technical Manual

## 1. Project Intent
The **Mock Logic Controller (MLC)** is a high-performance, lightweight Node.js middleware specifically engineered for performance testing tasks. It functions as a dynamic "Data and Fault Injection" hub to simulate external dependencies during load tests.

### Key Performance Benefits:
* **Zero-Bottleneck Architecture:** Built on a non-blocking event loop to handle high-concurrency traffic.
* **Low Memory Footprint:** Uses in-memory Map lookups ($O(1)$ complexity) for instant response matching.
* **Persistent Configuration:** Automatically saves all mocks to `mocks.json`, ensuring your configurations survive server restarts.
* **Real-Time Agility:** Allows adding, cloning, or editing mocks without server restarts, preventing test downtime.

---

## 2. Code Breakdown & Logic
Understanding the internal logic is vital for debugging during a performance run:

### A. Persistence & Recovery
The server utilizes an auto-save mechanism. Every time a mock is added, edited, or removed, the `saveToDisk()` function updates `mocks.json`. Upon startup, `loadFromDisk()` restores your entire test suite.

### B. Round-Robin Data Cycling
`mock.currentIndex = (mock.currentIndex + 1) % mock.csvData.length;`
This logic uses the **Modulo operator** to ensure a continuous data loop. If headers in your CSV match keys in your Response JSON, the engine injects that row's data into the response.

### C. Jitter & Latency Logic
The engine calculates a unique delay for every request to mimic "network noise":  
$Delay = AvgDelay + (RandomJitter \times Deviation)$



---

## 3. Deployment & Setup

### Step 1: Folder Structure
Ensure your directory is organized as follows:
* `/your-folder`
    * `server.js` (The Engine)
    * `package.json` (Project Manifest)
    * `mocks.json` (Auto-generated backup)
    * `key.pem` & `cert.pem` (SSL Certificates)
    * `/public/index.html` (The Dashboard)
    * `/data` (Your uploaded CSV files)

### Step 2: SSL Setup
Open your terminal in the project folder and run this to generate self-signed certificates for HTTPS:
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 365 -nodes -subj "/CN=localhost"
```
### Step 3: Launch
1.  **Install requirements:** Run `npm install express express-fileupload csv-parse` to ensure all middleware is available.
2.  **Start server:** Execute `node server.js` or use `npx nodemon server.js` for development mode.
3.  **Open Dashboard:** Navigate to `http://localhost:3000` in your browser.

---

## 4. Validation Test Cases (CURL)
Use these commands to validate your mock configuration, data cycling, and payload capture.

### A. Validate Round-Robin (GET)
Run this command multiple times to verify that the response data cycles through your `test.csv` rows in a loop:
```bash
curl -i -k -X GET "https://localhost:3443/api/v1/validate-cycle"
```
| Issue | Probable Cause | Fix / Solution |
| :--- | :--- | :--- |
| **"Insecure" Error** | Browser does not trust the self-signed certificates. | Click "Advanced" -> "Proceed" or use `-k` in your curl commands. |
| **CSV Not Loading** | The path is incorrect or the folder is missing. | Ensure the path starts with `data/` and the file is in the correct folder. |
| **High Latency** | Mac CPU is throttled or in "Low Power Mode." | Plug in your Mac; Node.js needs CPU cycles for accurate jitter math. |
| **Mock 404 Error** | Case sensitivity or trailing slashes in the URL. | Ensure the UI registration path exactly matches your request URL. |

## 5. Summary of Administrative URLs

1. UI Dashboard: http://localhost:3000.List 
2. System Health: http://localhost:3000/_admin/health — Built-in check to validate connectivity.
3. Active Mocks: GET http://localhost:3000/_admin/list.Secure 
4. Mock Endpoint: https://localhost:3443/[your-path].
