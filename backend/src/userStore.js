import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const USERS_FILE = join(DATA_DIR, 'users.json');

function makeId() {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function clampText(s, max) {
  const str = String(s ?? '').trim();
  return str.slice(0, max);
}

export class UserStore {
  constructor() {
    this.users = new Map(); // id -> user
    this.usersByFirebaseUid = new Map(); // firebase_uid -> user
    this.persistScheduled = false;
  }

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(USERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const user of parsed) {
          this.users.set(user.id, user);
          if (user.firebase_uid) {
            this.usersByFirebaseUid.set(user.firebase_uid, user);
          }
        }
      }
    } catch {
      // File doesn't exist yet, start fresh
    }
  }

  schedulePersist() {
    if (this.persistScheduled) return;
    this.persistScheduled = true;
    setTimeout(() => {
      this.persistScheduled = false;
      this.persist().catch(() => {});
    }, 350);
  }

  async persist() {
    const all = Array.from(this.users.values());
    await fs.writeFile(USERS_FILE, JSON.stringify(all, null, 2), 'utf8');
  }

  async createOrUpdateUser({ firebase_uid, email, name, role }) {
    // Validate inputs
    const userName = clampText(name, 100);
    const userEmail = clampText(email, 200).toLowerCase();
    const userRole = (role === 'admin' || role === 'citizen') ? role : 'citizen';

    if (!firebase_uid) {
      const err = new Error('Firebase UID required');
      err.statusCode = 400;
      throw err;
    }

    if (!userName || userName.length < 2) {
      const err = new Error('Name must be at least 2 characters');
      err.statusCode = 400;
      throw err;
    }

    if (!userEmail || !userEmail.includes('@')) {
      const err = new Error('Valid email required');
      err.statusCode = 400;
      throw err;
    }

    // Check if user already exists
    let user = this.usersByFirebaseUid.get(firebase_uid);

    if (user) {
      // Update existing user
      user.name = userName;
      user.email = userEmail;
      user.last_login = nowIso();
      this.schedulePersist();
      return this.sanitizeUser(user);
    }

    // Create new user
    user = {
      id: makeId(),
      firebase_uid,
      name: userName,
      email: userEmail,
      role: userRole,
      created_at: nowIso(),
      last_login: nowIso()
    };

    this.users.set(user.id, user);
    this.usersByFirebaseUid.set(firebase_uid, user);
    this.schedulePersist();

    return this.sanitizeUser(user);
  }

  async getUserByFirebaseUid(firebase_uid) {
    return this.usersByFirebaseUid.get(firebase_uid) ?? null;
  }

  sanitizeUser(user) {
    // Remove sensitive fields (none for Firebase auth)
    return { ...user };
  }

  getUserById(id) {
    return this.users.get(id) ?? null;
  }
}
