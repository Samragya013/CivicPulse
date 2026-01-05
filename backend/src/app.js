import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { IncidentStore } from './store.js';
import { UserStore } from './userStore.js';
import { PollStore } from './pollStore.js';
import { authMiddleware, optionalAuthMiddleware, adminOnlyMiddleware, setAdminInstance } from './authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp() {
  const app = express();
  const store = new IncidentStore();
  const userStore = new UserStore();
  const pollStore = new PollStore();
  
  await store.init();
  await userStore.init();
  await pollStore.init();

  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID || "civicpulse-47043",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || "civicpulse-47043"
      });
      console.log('[app] Firebase Admin initialized successfully');
    } catch (error) {
      console.error('[app] Firebase Admin initialization failed:', error.message);
    }
  }

  // Set admin instance for middleware
  setAdminInstance(admin);

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '6mb' }));
  app.use(morgan('dev'));

  // Frontend path for serving static files (defined early, used later)
  const frontendPath = path.join(__dirname, '../../frontend');

  app.get('/health', (_req, res) => {
    res.json({ ok: true, status: 'live', time: new Date().toISOString() });
  });

  // =============================================================================
  // AUTHENTICATION ENDPOINTS (Firebase-based)
  // =============================================================================

  // GET /api/user/profile - Get or create user profile
  app.get('/api/user/profile', authMiddleware(userStore), (req, res) => {
    res.json({ user: req.user });
  });

  // POST /api/user/profile - Create/update user profile
  app.post('/api/user/profile', authMiddleware(userStore), async (req, res) => {
    try {
      const { name, email, role } = req.body;
      const firebase_uid = req.user.firebase_uid;

      const user = await userStore.createOrUpdateUser({
        firebase_uid,
        email: email || req.user.email,
        name: name || req.user.name || email?.split('@')[0] || 'User',
        role: role || 'citizen'
      });

      res.json({ user });
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Profile creation failed' });
    }
  });

  // =============================================================================
  // INCIDENT ENDPOINTS
  // =============================================================================

  // POST /api/incidents (authenticated)
  app.post('/api/incidents', authMiddleware(userStore), async (req, res) => {
    try {
      const inc = await store.createIncident(req.body);
      res.status(201).json({ incident: store.present(inc), incident_id: inc.id });
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Server error' });
    }
  });

  // GET /api/incidents?since=<ISO> (optional auth - shows polls if authenticated)
  app.get('/api/incidents', optionalAuthMiddleware(userStore), (req, res) => {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    let incidents = store.listAll({ since }).map((i) => store.present(i));

    // If authenticated, add poll status for each incident
    if (req.user) {
      incidents = incidents.map(inc => {
        const hasVoted = pollStore.hasUserVoted(inc.id, req.user.user_id);
        const userVote = hasVoted ? pollStore.getUserVote(inc.id, req.user.user_id) : null;
        const pollResults = pollStore.getResults(inc.id);
        
        return {
          ...inc,
          poll_status: {
            has_voted: hasVoted,
            user_choice: userVote?.choice || null,
            results: req.user.role === 'admin' ? pollResults : null
          }
        };
      });
    }

    res.json({
      server_time: new Date().toISOString(),
      polling_recommended_ms: 4000,
      changes_only: Boolean(since),
      incidents
    });
  });

  // POST /api/incidents/:id/confirm (deprecated - kept for backward compatibility)
  app.post('/api/incidents/:id/confirm', authMiddleware(userStore), (req, res) => {
    const updated = store.confirmIncident(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Incident not found' });
    res.json({ incident: store.present(updated) });
  });

  // =============================================================================
  // POLLING ENDPOINTS
  // =============================================================================

  // POST /api/incidents/:id/poll (authenticated citizens/admins)
  app.post('/api/incidents/:id/poll', authMiddleware(userStore), (req, res) => {
    try {
      const { choice } = req.body;
      const response = pollStore.submitVote({
        incident_id: req.params.id,
        user_id: req.user.user_id,
        choice
      });

      // Update incident confirmation count based on poll results
      const results = pollStore.getResults(req.params.id);
      const incident = store.getById(req.params.id);
      if (incident && results.confirm >= 3 && incident.status === 'unverified') {
        store.updateStatus(req.params.id, 'crowd_confirmed');
      }

      res.json({ 
        poll_response: response,
        results: req.user.role === 'admin' ? results : null
      });
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Poll submission failed' });
    }
  });

  // GET /api/incidents/:id/poll-results (admin only)
  app.get('/api/incidents/:id/poll-results', authMiddleware(userStore), adminOnlyMiddleware, (req, res) => {
    const results = pollStore.getResults(req.params.id);
    res.json(results);
  });

  // =============================================================================
  // ADMIN-ONLY ENDPOINTS
  // =============================================================================

  // PATCH /api/incidents/:id/status (admin only)
  app.patch('/api/incidents/:id/status', authMiddleware(userStore), adminOnlyMiddleware, (req, res) => {
    const status = req.body?.status;
    const updated = store.updateStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Incident not found' });
    res.json({ incident: store.present(updated) });
  });

  // PATCH /api/incidents/:id/notes (admin only)
  app.patch('/api/incidents/:id/notes', authMiddleware(userStore), adminOnlyMiddleware, (req, res) => {
    const notes = req.body?.internal_notes;
    const updated = store.updateNotes(req.params.id, notes);
    if (!updated) return res.status(404).json({ error: 'Incident not found' });
    res.json({ incident: store.present(updated) });
  });

  // DELETE /api/incidents/:id (admin only)
  app.delete('/api/incidents/:id', authMiddleware(userStore), adminOnlyMiddleware, (req, res) => {
    const deleted = store.deleteIncident(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Incident not found' });
    res.json({ success: true, incident_id: req.params.id });
  });

  // Serve frontend static files (CSS, JS, images, etc.)
  app.use(express.static(frontendPath));

  // Serve frontend for all non-API routes (SPA support)
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // Basic error guard
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err?.message ?? 'Server error' });
  });

  return { app, store, userStore, pollStore };
}
