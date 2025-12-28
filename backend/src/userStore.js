import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required! Please set it in .env file');
}

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
    this.users = new Map();
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

  async signup({ name, email, password, role }) {
    // Validate inputs
    const userName = clampText(name, 100);
    const userEmail = clampText(email, 200).toLowerCase();
    const userRole = (role === 'admin' || role === 'citizen') ? role : 'citizen';

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

    if (!password || password.length < 4) {
      const err = new Error('Password must be at least 4 characters');
      err.statusCode = 400;
      throw err;
    }

    // Check if email already exists
    for (const user of this.users.values()) {
      if (user.email === userEmail) {
        const err = new Error('Email already registered');
        err.statusCode = 400;
        throw err;
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const user = {
      id: makeId(),
      name: userName,
      email: userEmail,
      password_hash,
      role: userRole,
      created_at: nowIso()
    };

    this.users.set(user.id, user);
    this.schedulePersist();

    // Return user without password hash + JWT
    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  async login({ email, password }) {
    const userEmail = clampText(email, 200).toLowerCase();

    if (!userEmail || !password) {
      const err = new Error('Email and password required');
      err.statusCode = 400;
      throw err;
    }

    // Find user by email
    let user = null;
    for (const u of this.users.values()) {
      if (u.email === userEmail) {
        user = u;
        break;
      }
    }

    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        user_id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch {
      return null;
    }
  }

  sanitizeUser(user) {
    const { password_hash, ...safe } = user;
    return safe;
  }

  getUserById(id) {
    return this.users.get(id) ?? null;
  }
}
