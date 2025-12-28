# Civic Incident Commander (Hackathon MVP)

A real-time incident reporting + resource coordination command dashboard.

This is a **decision-support UI under pressure**:
- **Operational clarity**: responders see the priority queue at a glance
- **Verification**: nearby users confirm reports; confirmations drive trust
- **Prioritization**: status + confirmations + time-elapsed keeps the queue actionable

## Architecture (simple, deployable today)

```
Citizen Browser (SPA)  --polls 3–5s-->  Node/Express API  --writes-->  JSON file fallback
        |                                 (in-memory store)
        +-- POST incident ---------------->
        +-- POST confirm ----------------->
        +-- PATCH status/notes (admin) --->
```

**Why polling?**
Polling was chosen for reliability, simplicity, and hackathon feasibility. It provides a real-time feel with minimal moving parts and is easy to deploy.

## Workflow (end-to-end)

1. **Citizen reports**: type + short description + location (auto-detect or manual).
2. System saves incident with:
   - `status = unverified`
   - timestamp + geo-coordinates
3. Incident appears in the live priority queue.
4. Nearby users click **Confirm Nearby**.
5. When confirmations ≥ 3 → `crowd_confirmed`.
6. **Responder/Admin** opens `?admin=1`:
   - updates `status`
   - adds `internal_notes`

## API Contract (implemented)

- `POST /api/incidents`
- `GET /api/incidents` (supports `?since=<ISO>` to return only changes)
- `POST /api/incidents/:id/confirm`
- `PATCH /api/incidents/:id/status`
- `PATCH /api/incidents/:id/notes`

**Incident data model includes:**
- `id`
- `type`
- `description`
- `latitude`
- `longitude`
- `timestamp`
- `status`
- `confirmation_count`
- `internal_notes`

Notes:
- The backend may also attach `group_id` / `duplicate_of` to support visual deduping.

## Local run (Windows)

### 1) Backend

```powershell
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5050`.

### 2) Frontend

The frontend is static. Easiest options:
- VS Code “Live Server” extension, or
- Any simple static server.

If you have Python:
```powershell
cd frontend
python -m http.server 5173
```
Open `http://localhost:5173`.

Admin view: `http://localhost:5173/?admin=1`

## Demo Script (30 seconds)

1. Open the dashboard (citizen view). Submit an incident.
2. Show it appears in the priority queue within ~5 seconds.
3. Click **Confirm Nearby** 3 times → status becomes `crowd_confirmed`.
4. Open `?admin=1` → set status to `responding` → add notes.
5. Set status to `resolved`.

## 🚀 Deploy to Render (Single Service)

### Quick Deploy

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/civic-incident-commander.git
   git push -u origin main
   ```

2. **Deploy on Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click **"New +"** → **"Blueprint"**
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml` and create the service

3. **Set Environment Variable**
   
   Generate JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   
   In Render Dashboard:
   - Go to your service → **Environment** tab
   - Set `JWT_SECRET` to the generated value
   - `NODE_ENV` and `PORT` are already set

4. **Access Your App**
   - Single URL: `https://civic-incident-commander.onrender.com`
   - Both frontend and API are served from the same origin
   - No CORS issues!

### Manual Deploy

```bash
# In Render Dashboard
# 1. New Web Service
# 2. Connect GitHub repo
# 3. Settings:
#    - Name: civic-incident-commander
#    - Root Directory: (leave empty)
#    - Build Command: cd backend && npm install
#    - Start Command: cd backend && npm start
#    - Environment Variables:
#      * JWT_SECRET=<your-secret-key>
#      * NODE_ENV=production
#      * PORT=10000
```

---

## 🔧 Production Checklist

- ✅ Generate secure JWT_SECRET
- ✅ Set NODE_ENV=production
- ✅ Backend serves frontend (no CORS needed)
- ✅ Single URL deployment
- ✅ Enable HTTPS (Render does this automatically)

---

This MVP intentionally avoids complex infrastructure to stay demo-reliable while still feeling operational.
