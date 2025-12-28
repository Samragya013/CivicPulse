import { createApp } from './app.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { app } = await createApp();

const server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});

const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${base}/health`).then((r) => r.json());
  assert(health.ok === true, 'health.ok should be true');

  const created = await fetch(`${base}/api/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'fire',
      description: 'Smoke test incident',
      latitude: 28.6139,
      longitude: 77.209
    })
  }).then((r) => r.json());

  assert(created.incident_id, 'create should return incident_id');

  const id = created.incident_id;

  for (let i = 0; i < 3; i++) {
    await fetch(`${base}/api/incidents/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
  }

  const list = await fetch(`${base}/api/incidents`).then((r) => r.json());
  const found = list.incidents.find((x) => x.id === id);
  assert(found, 'created incident should be in list');
  assert(found.confirmation_count >= 3, 'incident should have confirmations >= 3');
  assert(found.status === 'crowd_confirmed' || found.status === 'unverified', 'status should be unverified or crowd_confirmed');

  const statusUpdated = await fetch(`${base}/api/incidents/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'responding' })
  }).then((r) => r.json());
  assert(statusUpdated.incident.status === 'responding', 'status should update to responding');

  const notesUpdated = await fetch(`${base}/api/incidents/${encodeURIComponent(id)}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ internal_notes: 'Unit dispatched' })
  }).then((r) => r.json());
  assert(notesUpdated.incident.internal_notes.includes('Unit dispatched'), 'notes should update');

  // eslint-disable-next-line no-console
  console.log('[smoke] OK:', { id, port });
} finally {
  await new Promise((resolve) => server.close(resolve));
}
