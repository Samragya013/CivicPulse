import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'incidents.json');

// Nominatim reverse geocoding (backend-controlled, cached per incident)
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CivicIncidentCommander/1.0 (Hackathon Demo)'
      }
    });
    
    if (!response.ok) {
      return null; // Graceful fallback
    }
    
    const data = await response.json();
    
    // Extract human-readable location
    if (data.display_name) {
      return data.display_name;
    }
    
    // Fallback: construct from address components
    const addr = data.address || {};
    const parts = [
      addr.road || addr.suburb || addr.neighbourhood,
      addr.city || addr.town || addr.village,
      addr.state
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : null;
  } catch (err) {
    // Network failure, rate limit, etc. - fail gracefully
    console.warn('Reverse geocoding failed:', err.message);
    return null;
  }
}

// Nominatim forward geocoding (location name → coordinates)
async function forwardGeocode(locationName) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CivicIncidentCommander/1.0 (Hackathon Demo)'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };
    }
    
    return null;
  } catch (err) {
    console.warn('Forward geocoding failed:', err.message);
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  // Demo-friendly, sortable, collision-resistant enough for hackathon.
  return `inc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampText(value, maxLen) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function normalizeType(type) {
  const t = clampText(type, 40);
  if (!t) return 'general';
  return t.toLowerCase();
}

function normalizeStatus(status) {
  const s = clampText(status, 30).toLowerCase();
  const allowed = new Set(['unverified', 'crowd_confirmed', 'verified', 'responding', 'resolved']);
  return allowed.has(s) ? s : 'unverified';
}

function normalizeSeverity(severity) {
  const s = clampText(severity, 16).toLowerCase();
  const allowed = new Set(['info', 'attention', 'critical']);
  return allowed.has(s) ? s : 'attention';
}

function minutesOpen(timestampIso) {
  const t = Date.parse(timestampIso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function computePriority({ severity, confirmation_count, status, timestamp }) {
  // Explainable Operational Priority Index:
  // severity (primary) + confirmations (trust) + time open (aging).
  // No ML; simple, transparent.
  const sevWeight = { info: 10, attention: 30, critical: 60 }[severity] ?? 30;
  const confirms = Math.max(0, Number(confirmation_count ?? 0));
  const confirmWeight = Math.min(40, confirms * 8);
  const openMin = minutesOpen(timestamp);
  const ageWeight = Math.min(45, openMin); // +1 per minute, capped

  // Status modifier keeps resolved at the bottom without hiding history.
  const statusMod = status === 'resolved' ? -200 : 0;
  const score = sevWeight + confirmWeight + ageWeight + statusMod;

  return {
    score,
    factors: {
      severity: { label: severity, points: sevWeight },
      confirmations: { count: confirms, points: confirmWeight },
      time_open: { minutes: openMin, points: ageWeight }
    }
  };
}

function pushTimeline(inc, entry) {
  if (!Array.isArray(inc.timeline)) inc.timeline = [];
  inc.timeline.push({
    ts: nowIso(),
    actor: entry.actor,
    action: entry.action,
    detail: entry.detail ?? ''
  });
  // Keep timeline in chronological order, last item newest.
  inc.timeline.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

export class IncidentStore {
  constructor() {
    this.incidents = new Map();
    this.lastModifiedMs = Date.now();
    this.persistScheduled = false;
  }

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.id === 'string') {
            this.incidents.set(item.id, item);
          }
        }
      }
      this.lastModifiedMs = Date.now();
    } catch (e) {
      // No data file yet is fine.
    }
  }

  touch() {
    this.lastModifiedMs = Date.now();
    this.schedulePersist();
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
    const all = this.listAll({});
    await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), 'utf8');
  }

  listAll({ since } = {}) {
    const sinceMs = since ? Date.parse(since) : null;
    const items = Array.from(this.incidents.values());

    const filtered = sinceMs
      ? items.filter((i) => Date.parse(i.updated_at ?? i.timestamp) > sinceMs)
      : items;

    // Operational Priority Index ordering (transparent and explainable).
    filtered.sort((a, b) => {
      const pa = computePriority(a).score;
      const pb = computePriority(b).score;
      if (pb !== pa) return pb - pa;
      return Date.parse(b.timestamp) - Date.parse(a.timestamp);
    });

    return filtered;
  }

  present(inc) {
    if (!inc) return null;
    const pri = computePriority(inc);
    const openMin = minutesOpen(inc.timestamp);
    return {
      ...inc,
      severity: inc.severity ?? 'attention',
      age_minutes: openMin,
      priority_score: pri.score,
      priority_factors: pri.factors
    };
  }

  getById(id) {
    return this.incidents.get(id) ?? null;
  }

  findDuplicateCandidate({ type, latitude, longitude, timestamp }) {
    // Simple dedupe: same type, within 200m, within 10 minutes.
    const maxMeters = 200;
    const maxAgeMs = 10 * 60 * 1000;
    const tMs = Date.parse(timestamp);

    for (const inc of this.incidents.values()) {
      if (inc.status === 'resolved') continue;
      if (inc.type !== type) continue;
      const age = Math.abs(Date.parse(inc.timestamp) - tMs);
      if (!Number.isFinite(age) || age > maxAgeMs) continue;
      const d = haversineMeters(latitude, longitude, inc.latitude, inc.longitude);
      if (d <= maxMeters) return inc;
    }

    return null;
  }

  async createIncident(payload) {
    const type = normalizeType(payload?.type);
    const description = clampText(payload?.description, 220);
    const severity = normalizeSeverity(payload?.severity);

    let latitude = toNumber(payload?.latitude);
    let longitude = toNumber(payload?.longitude);
    let displayLocation = null;

    // If location name provided (non-empty string), forward geocode it
    const locationName = payload?.location_name?.trim() || null;
    
    if (locationName && (latitude === null || longitude === null)) {
      // User provided location name - convert to coordinates
      const geocoded = await forwardGeocode(locationName);
      if (geocoded) {
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        displayLocation = geocoded.display_name;
      } else {
        const err = new Error(`Unable to locate "${locationName}". Please try: GPS button, a different location name, or enter coordinates manually.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Validate coordinates
    if (latitude === null || longitude === null) {
      const err = new Error('Location required: enter a location name, use GPS button, or provide coordinates');
      err.statusCode = 400;
      throw err;
    }

    const timestamp = nowIso();
    const id = makeId();

    // Reverse geocode if we don't already have a display name
    if (!displayLocation) {
      displayLocation = await reverseGeocode(latitude, longitude);
    }

    const base = {
      id,
      type,
      description,
      severity,
      latitude,
      longitude,
      display_location: displayLocation || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
      timestamp,
      status: 'unverified',
      confirmation_count: 0,
      internal_notes: '',
      timeline: [],
      updated_at: timestamp
    };

    const dup = this.findDuplicateCandidate(base);
    if (dup) {
      base.duplicate_of = dup.id;
      base.group_id = dup.group_id ?? dup.id;
    } else {
      base.group_id = id;
    }

    pushTimeline(base, {
      actor: 'system',
      action: 'incident_reported',
      detail: `Reported as ${type} (${severity})`
    });
    if (base.duplicate_of) {
      pushTimeline(base, {
        actor: 'system',
        action: 'potential_duplicate_grouped',
        detail: `Grouped with ${base.duplicate_of}`
      });
    }

    this.incidents.set(id, base);
    this.touch();

    return base;
  }

  confirmIncident(id) {
    const inc = this.getById(id);
    if (!inc) return null;

    inc.confirmation_count = (inc.confirmation_count ?? 0) + 1;
    pushTimeline(inc, {
      actor: 'crowd',
      action: 'confirmation_received',
      detail: `Confirmations: ${inc.confirmation_count}`
    });
    if (inc.status === 'unverified' && inc.confirmation_count >= 3) {
      inc.status = 'crowd_confirmed';
      pushTimeline(inc, {
        actor: 'system',
        action: 'status_auto_escalated',
        detail: 'Reached 3 confirmations → crowd_confirmed'
      });
    }
    inc.updated_at = nowIso();

    this.touch();
    return inc;
  }

  updateStatus(id, status) {
    const inc = this.getById(id);
    if (!inc) return null;

    const next = normalizeStatus(status);
    const prev = inc.status;
    inc.status = next;
    pushTimeline(inc, {
      actor: 'responder',
      action: 'status_updated',
      detail: `${prev} → ${next}`
    });
    inc.updated_at = nowIso();

    this.touch();
    return inc;
  }

  updateNotes(id, notes) {
    const inc = this.getById(id);
    if (!inc) return null;

    inc.internal_notes = clampText(notes, 900);
    pushTimeline(inc, {
      actor: 'responder',
      action: 'internal_notes_updated',
      detail: 'Internal notes updated'
    });
    inc.updated_at = nowIso();

    this.touch();
    return inc;
  }

  deleteIncident(id) {
    const inc = this.getById(id);
    if (!inc) return null;
    
    this.incidents.delete(id);
    this.touch();
    this.schedulePersist();
    return inc;
  }
}
