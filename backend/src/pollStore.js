import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const POLLS_FILE = join(DATA_DIR, 'poll_responses.json');

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  return `poll_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export class PollStore {
  constructor() {
    this.responses = new Map(); // key: poll_id (incident_id), value: array of responses
    this.persistScheduled = false;
  }

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(POLLS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object') {
        for (const [poll_id, responses] of Object.entries(parsed)) {
          this.responses.set(poll_id, responses);
        }
      }
    } catch {
      // File doesn't exist yet
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
    const obj = {};
    for (const [poll_id, responses] of this.responses.entries()) {
      obj[poll_id] = responses;
    }
    await fs.writeFile(POLLS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  }

  submitVote({ incident_id, user_id, choice }) {
    // Check if user already voted
    const existing = this.responses.get(incident_id) || [];
    const hasVoted = existing.some(r => r.user_id === user_id);

    if (hasVoted) {
      const err = new Error('You have already responded to this incident');
      err.statusCode = 400;
      throw err;
    }

    // Validate choice
    const validChoices = ['confirm', 'deny', 'unsure'];
    if (!validChoices.includes(choice)) {
      const err = new Error('Invalid choice. Must be: confirm, deny, or unsure');
      err.statusCode = 400;
      throw err;
    }

    const response = {
      id: makeId(),
      incident_id,
      user_id,
      choice,
      timestamp: nowIso()
    };

    if (!this.responses.has(incident_id)) {
      this.responses.set(incident_id, []);
    }

    this.responses.get(incident_id).push(response);
    this.schedulePersist();

    return response;
  }

  getResults(incident_id) {
    const votes = this.responses.get(incident_id) || [];
    
    const results = {
      total: votes.length,
      confirm: votes.filter(v => v.choice === 'confirm').length,
      deny: votes.filter(v => v.choice === 'deny').length,
      unsure: votes.filter(v => v.choice === 'unsure').length,
      confidence_score: 0
    };

    // Calculate confidence score (0-100)
    if (results.total > 0) {
      const confirmRatio = results.confirm / results.total;
      results.confidence_score = Math.round(confirmRatio * 100);
    }

    return results;
  }

  hasUserVoted(incident_id, user_id) {
    const votes = this.responses.get(incident_id) || [];
    return votes.some(v => v.user_id === user_id);
  }

  getUserVote(incident_id, user_id) {
    const votes = this.responses.get(incident_id) || [];
    return votes.find(v => v.user_id === user_id) || null;
  }
}
