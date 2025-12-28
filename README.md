<div align="center">

# 🚨 CivicPulse

### Real-Time Emergency Response & Community Engagement Platform

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21+-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

*Empowering communities to report, verify, and respond to civic incidents in real-time*

[Features](#-core-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [API Documentation](#-api-documentation) • [Deployment](#-deployment)

---

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [Target Audience](#-target-audience)
- [Core Features](#-core-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [User Workflows](#-user-workflows)
- [Deployment](#-deployment)
- [Configuration](#-configuration)
- [Contributing](#-contributing)

---

## 🌟 Overview

**CivicPulse** is a modern, real-time emergency incident reporting and response coordination platform designed to bridge the gap between citizens and emergency responders. It combines crowd-sourced incident reporting with intelligent verification mechanisms and administrative command tools to create an efficient emergency response ecosystem.

### Why CivicPulse?

In emergency situations, **speed and accuracy** are paramount. CivicPulse addresses critical challenges in civic emergency response:

- ✅ **Rapid Reporting**: Citizens can report incidents in seconds using auto-detected geolocation
- ✅ **Crowd Verification**: Community-based polling system validates incident authenticity
- ✅ **Priority Management**: Smart queue prioritization based on status, confirmations, and time
- ✅ **Real-Time Updates**: Live dashboard with 3-5 second polling for near-instant updates
- ✅ **Admin Control**: Dedicated command center for responders to manage and coordinate responses
- ✅ **Democratic Engagement**: Integrated polling system for community feedback on civic issues

---

## 👥 Target Audience

### Primary Users

**Citizens & Residents**
- Report emergencies, hazards, and civic issues
- Confirm nearby incidents to improve verification
- Participate in community polls
- Monitor active incidents in their area

**Emergency Responders & Administrators**
- View prioritized incident queue in real-time
- Update incident status and add internal notes
- Access detailed incident analytics
- View poll results and community sentiment
- Coordinate response efforts efficiently

**City Officials & Decision Makers**
- Monitor community pulse through polls
- Analyze incident patterns and trends
- Make data-driven decisions
- Engage with citizens on civic matters

---

## ✨ Core Features

### 🚨 Incident Management

- **Real-Time Reporting**: Submit incidents with type, description, and automatic geolocation
- **Crowd Verification**: Community polling system (Confirm/Deny/Unclear) validates reports
- **Smart Prioritization**: Dynamic queue based on status, confirmations, and elapsed time
- **Status Tracking**: From unverified → crowd_confirmed → responding → resolved
- **Geolocation Support**: Auto-detect location or manual pin-drop on map

### 👮 Admin Command Center

- **Live Dashboard**: Real-time view of all active incidents
- **Status Management**: Update incident workflow stages
- **Internal Notes**: Add responder comments and coordination notes
- **Poll Analytics**: View detailed voting results and community sentiment
- **Priority Queue**: Auto-sorted list based on urgency and verification level

### 🗳️ Community Polling

- **Incident Verification**: Vote to confirm or deny reported incidents
- **Civic Engagement**: Participate in polls on local issues
- **Vote Tracking**: System prevents duplicate voting
- **Results Transparency**: Admins can view detailed poll analytics
- **Auto-Status Updates**: Incidents auto-escalate when confirmations ≥ 3

### 🔐 Authentication & Security

- **JWT-Based Authentication**: Secure token-based user sessions
- **Role-Based Access Control (RBAC)**: Citizen and admin roles
- **Password Encryption**: BCrypt hashing for secure credential storage
- **Protected Routes**: Middleware-based authentication guards

---

## 🛠️ Technology Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **Express.js** | 4.21+ | Web application framework |
| **JWT** | 9.0+ | Authentication tokens |
| **BCrypt.js** | 3.0+ | Password hashing |
| **CORS** | 2.8+ | Cross-origin resource sharing |
| **Morgan** | 1.10+ | HTTP request logging |
| **dotenv** | 17.2+ | Environment variable management |

### Frontend

| Technology | Purpose |
|-----------|---------|
| **Vanilla JavaScript** | Client-side logic |
| **HTML5** | Semantic markup |
| **CSS3** | Modern styling with gradients & animations |
| **Google Fonts** | Inter & Outfit typography |
| **Canvas API** | Background particle effects |

### Data Storage

- **JSON File-Based Persistence**: Lightweight, zero-config data storage
- **In-Memory Caching**: Fast read access with periodic disk writes
- **Atomic Operations**: Concurrent write safety with file locks

### DevOps & Deployment

- **Render**: Cloud hosting platform
- **Git**: Version control
- **PowerShell/Bash**: Deployment scripts

---

## 📁 Project Structure

```
CivicPulse/
│
├── backend/                      # Node.js/Express API Server
│   ├── src/
│   │   ├── app.js               # Express app configuration & routes
│   │   ├── server.js            # Server entry point
│   │   ├── store.js             # Incident data store (CRUD operations)
│   │   ├── userStore.js         # User authentication store
│   │   ├── pollStore.js         # Polling/voting system store
│   │   ├── authMiddleware.js    # JWT authentication middleware
│   │   └── smoke.js             # Smoke test utilities
│   │
│   ├── data/                    # JSON data persistence
│   │   ├── incidents.json       # Incident records
│   │   ├── users.json           # User accounts
│   │   └── poll_responses.json  # Poll voting data
│   │
│   └── package.json             # Backend dependencies
│
├── frontend/                     # Static Web Application
│   ├── index.html               # Main application UI
│   ├── app.js                   # Client-side application logic
│   ├── auth.js                  # Authentication handling
│   ├── config.js                # Frontend configuration
│   ├── styles.css               # Main stylesheet
│   ├── poll-results-styles.css  # Polling UI styles
│   └── netlify.toml             # Netlify deployment config
│
├── deploy.ps1                   # PowerShell deployment script
├── deploy.sh                    # Bash deployment script
├── render.yaml                  # Render platform configuration
└── README.md                    # This file
```

---

## 🏗️ Architecture

### System Design

CivicPulse follows a **client-server architecture** with polling-based real-time updates:

```
┌─────────────────┐         HTTP/AJAX          ┌──────────────────┐
│                 │    (polling every 3-5s)    │                  │
│  Citizen SPA    │ ◄─────────────────────────►│  Express.js API  │
│  (Browser)      │                            │   (Node.js)      │
│                 │                            │                  │
└─────────────────┘                            └──────────────────┘
        │                                              │
        │ POST /api/incidents                          │
        │ POST /api/incidents/:id/poll                 │ Read/Write
        │ PATCH /api/incidents/:id/status              │
        │ GET /api/incidents?since=<ISO>               ▼
        │                                     ┌─────────────────┐
        │                                     │  JSON File      │
        │                                     │  Data Store     │
        │                                     │                 │
        └─────────────────────────────────────┤ • incidents     │
                   Admin View                 │ • users         │
                   (?admin=1)                 │ • poll_responses│
                                              └─────────────────┘
```

### Key Design Decisions

**Why Polling Instead of WebSockets?**
- ✅ Simpler implementation and deployment
- ✅ Better reliability across networks and proxies
- ✅ Reduced server complexity (no connection management)
- ✅ Near-real-time feel (3-5 second updates)
- ✅ Easier to debug and monitor

**Why JSON File Storage?**
- ✅ Zero external dependencies (no database setup)
- ✅ Easy backup and version control
- ✅ Human-readable data format
- ✅ Perfect for MVP and small-scale deployments
- ✅ Trivial migration path to PostgreSQL/MongoDB later

### Data Flow

1. **Incident Creation**: Citizen submits report → API validates → Store persists → Returns incident ID
2. **Real-Time Updates**: Client polls `/api/incidents?since=<lastSync>` every 3-5 seconds
3. **Crowd Verification**: Citizens vote on incidents → Poll store aggregates → Auto-escalates at 3+ confirms
4. **Admin Actions**: Admins update status/notes → Store persists → Next poll cycle broadcasts changes

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Git** for version control

### Local Development

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/CivicPulse.git
cd CivicPulse
```

#### 2️⃣ Backend Setup

```powershell
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start development server
npm run dev
```

The backend API will be available at **`http://localhost:5050`**

#### 3️⃣ Frontend Setup

The frontend is a static web application. Choose one of these methods:

**Option A: VS Code Live Server** (Recommended)
1. Install the "Live Server" extension in VS Code
2. Right-click `frontend/index.html`
3. Select "Open with Live Server"

**Option B: Python HTTP Server**
```powershell
cd frontend
python -m http.server 5173
```

**Option C: Node.js HTTP Server**
```bash
cd frontend
npx http-server -p 5173
```

Access the application at **`http://localhost:5173`**

#### 4️⃣ Access Different Views

- **Citizen View**: `http://localhost:5173`
- **Admin View**: `http://localhost:5173/?admin=1`

---

## 📡 API Documentation

### Base URL
```
http://localhost:5050/api
```

### Authentication Endpoints

#### `POST /api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "role": "citizen"
}
```

**Response:**
```json
{
  "user": {
    "user_id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "citizen"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### `POST /api/auth/login`
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "user_id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "citizen"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### `GET /api/auth/verify`
Verify JWT token validity.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "user_id": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "citizen"
  }
}
```

---

### Incident Endpoints

#### `POST /api/incidents`
Create a new incident report (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "fire",
  "description": "Building fire on Main Street",
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

**Response:**
```json
{
  "incident_id": "inc_1234567890",
  "incident": {
    "id": "inc_1234567890",
    "type": "fire",
    "description": "Building fire on Main Street",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "status": "unverified",
    "confirmation_count": 0,
    "timestamp": "2025-12-28T10:30:00.000Z"
  }
}
```

**Incident Types:**
- `fire` - Fire emergency
- `accident` - Traffic accident
- `medical` - Medical emergency
- `crime` - Criminal activity
- `hazard` - Public hazard
- `utility` - Utility failure
- `other` - Other incidents

---

#### `GET /api/incidents?since=<ISO_timestamp>`
Retrieve all incidents or changes since a specific time.

**Query Parameters:**
- `since` (optional): ISO 8601 timestamp - returns only incidents modified after this time

**Headers:**
```
Authorization: Bearer <token>  (optional - shows poll data if authenticated)
```

**Response:**
```json
{
  "server_time": "2025-12-28T10:35:00.000Z",
  "polling_recommended_ms": 4000,
  "changes_only": false,
  "incidents": [
    {
      "id": "inc_1234567890",
      "type": "fire",
      "description": "Building fire on Main Street",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "status": "crowd_confirmed",
      "confirmation_count": 5,
      "timestamp": "2025-12-28T10:30:00.000Z",
      "poll_status": {
        "has_voted": true,
        "user_choice": "confirm",
        "results": null
      }
    }
  ]
}
```

**Status Values:**
- `unverified` - Initial state, awaiting verification
- `crowd_confirmed` - 3+ community confirmations
- `responding` - Responders dispatched
- `resolved` - Incident resolved

---

#### `POST /api/incidents/:id/poll`
Vote on an incident (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "choice": "confirm"
}
```

**Poll Choices:**
- `confirm` - Verify incident is real
- `deny` - Incident appears false
- `unclear` - Unsure about incident

**Response:**
```json
{
  "poll_response": {
    "incident_id": "inc_1234567890",
    "user_id": "abc123",
    "choice": "confirm",
    "timestamp": "2025-12-28T10:35:00.000Z"
  },
  "results": {
    "confirm": 5,
    "deny": 1,
    "unclear": 2,
    "total": 8
  }
}
```

---

#### `GET /api/incidents/:id/poll-results`
Get poll results for an incident (admin only).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "confirm": 12,
  "deny": 3,
  "unclear": 5,
  "total": 20
}
```

---

#### `PATCH /api/incidents/:id/status`
Update incident status (admin only).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "responding"
}
```

**Response:**
```json
{
  "incident": {
    "id": "inc_1234567890",
    "status": "responding"
  }
}
```

---

#### `PATCH /api/incidents/:id/notes`
Add internal notes to an incident (admin only).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "notes": "Fire truck dispatched, ETA 5 minutes"
}
```

**Response:**
```json
{
  "incident": {
    "id": "inc_1234567890",
    "internal_notes": "Fire truck dispatched, ETA 5 minutes"
  }
}
```

---

### Health Check

#### `GET /health`
Check API server health status.

**Response:**
```json
{
  "ok": true,
  "status": "live",
  "time": "2025-12-28T10:35:00.000Z"
}
```

---

## 🔄 User Workflows

### Citizen Workflow: Reporting an Incident

1. **Sign Up/Login**: Create account or authenticate
2. **Report Incident**: 
   - Click "Report Incident" button
   - Select incident type
   - Enter description
   - Confirm auto-detected location or manually adjust
   - Submit report
3. **Monitor Progress**: Watch incident appear in live queue within 3-5 seconds
4. **Verify Others**: Vote on nearby incidents to help verification
5. **Track Resolution**: See status updates as responders handle the incident

### Admin Workflow: Managing Incidents

1. **Access Admin View**: Navigate to `?admin=1`
2. **Monitor Queue**: View prioritized list of all active incidents
3. **Review Details**: Click incident to see:
   - Full description and location
   - Poll results (confirmations vs denials)
   - Time elapsed
   - Current status
4. **Take Action**:
   - Update status to `responding` when dispatching resources
   - Add internal notes for coordination
   - Mark as `resolved` when complete
5. **Analyze Trends**: Review poll data and incident patterns

### Community Verification Workflow

1. **View Incidents**: Browse reported incidents in your area
2. **Vote on Authenticity**:
   - **Confirm**: If you can verify the incident is real
   - **Deny**: If the incident appears false
   - **Unclear**: If you're unsure
3. **Trigger Escalation**: 3+ confirmations auto-escalate to `crowd_confirmed`
4. **One Vote Per User**: System prevents duplicate voting

---

## 🚀 Deployment

### Deploy to Render (Recommended)

Render offers free hosting with automatic deployments from GitHub.

#### Quick Deploy Steps

**1. Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/CivicPulse.git
git push -u origin main
```

**2. Deploy on Render**
- Go to [Render Dashboard](https://dashboard.render.com/)
- Click **"New +"** → **"Blueprint"**
- Connect your GitHub repository
- Render will automatically detect `render.yaml` and create the service

**3. Set Environment Variables**

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

In Render Dashboard:
- Go to your service → **Environment** tab
- Set `JWT_SECRET` to the generated value
- `NODE_ENV=production` and `PORT=10000` are auto-configured

**4. Access Your App**
- Your app will be live at: `https://YOUR-SERVICE-NAME.onrender.com`
- Both frontend and API are served from the same origin (no CORS issues!)

---

### Manual Deployment

If you prefer manual setup:

```yaml
# In Render Dashboard
# 1. Create New Web Service
# 2. Connect GitHub repository
# 3. Configure settings:

Name: civic-pulse
Root Directory: (leave empty)
Build Command: cd backend && npm install
Start Command: cd backend && npm start

Environment Variables:
  JWT_SECRET: <your-64-char-hex-secret>
  NODE_ENV: production
  PORT: 10000
```

---

### Alternative Deployment Options

#### Deploy to Netlify (Frontend) + Render (Backend)

**Backend (Render):**
```bash
# Same as above
```

**Frontend (Netlify):**
```bash
# netlify.toml is already configured
# Just drag-drop the frontend/ folder to Netlify
```

Update `frontend/config.js` with your Render backend URL.

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=5050
NODE_ENV=development

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your-secret-key-here

# Optional: CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend Configuration

Edit `frontend/config.js`:

```javascript
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5050'
  : 'https://your-backend-url.onrender.com';

const POLL_INTERVAL_MS = 4000; // 4 seconds
```

---

## 🧪 Testing

### Smoke Test (Quick Validation)

```bash
cd backend
node src/smoke.js
```

This will:
- ✅ Test user signup and login
- ✅ Create test incidents
- ✅ Submit poll votes
- ✅ Update incident status
- ✅ Verify all API endpoints

### Demo Script (30-Second Walkthrough)

1. **Open Citizen View**: Navigate to the dashboard
2. **Report Incident**: Submit a test emergency report
3. **Real-Time Update**: Watch it appear in the queue within ~5 seconds
4. **Community Verification**: Click "Confirm Nearby" 3 times
5. **Auto-Escalation**: Status changes to `crowd_confirmed`
6. **Admin View**: Open `?admin=1` in a new tab
7. **Manage Response**: Update status to `responding`, add notes
8. **Resolution**: Mark incident as `resolved`

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Contribution Ideas

- 🗺️ Interactive map integration (Leaflet/Mapbox)
- 📊 Analytics dashboard for incident trends
- 📱 Mobile app (React Native)
- 🔔 Push notifications
- 💬 Real-time chat between citizens and responders
- 🌐 Multi-language support
- 📸 Photo upload for incidents
- 🔍 Advanced search and filtering
- 📈 Data export and reporting tools

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built for civic engagement and emergency response coordination
- Inspired by the need for transparent, community-driven incident management
- Designed with simplicity and reliability as core principles

---

## 📞 Support

For questions, issues, or feature requests:
- 🐛 [Open an Issue](https://github.com/yourusername/CivicPulse/issues)
- 💬 [Discussions](https://github.com/yourusername/CivicPulse/discussions)
- 📧 Email: support@civicpulse.example.com

---

<div align="center">

**Made with ❤️ for safer, more connected communities**

⭐ Star this repo if you find it useful! ⭐

</div>
