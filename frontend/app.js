import { auth } from './auth.js';

// Use same origin for API calls (backend serves frontend)
const API_BASE = '';

const POLL_MS = 4000;

const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

let isAdmin = false; // Will be set based on JWT role

const state = {
  incidentsById: new Map(),
  selectedId: null,
  lastSince: null,
  pollTimer: null,
  geo: { lat: null, lon: null },
  severityById: new Map(), // client-only severity tagging (demo)
  seenIds: new Set(),
  map: null,
  markers: new Map() // incident_id -> Leaflet marker
};

// Custom modal dialog
function showModal(message, title = 'Confirm Action', icon = '⚠️') {
  return new Promise((resolve) => {
    const modal = qs('#customModal');
    const modalTitle = qs('#modalTitle');
    const modalMessage = qs('#modalMessage');
    const modalIcon = qs('#modalIcon');
    const confirmBtn = qs('#modalConfirmBtn');
    const cancelBtn = qs('#modalCancelBtn');
    const overlay = modal.querySelector('.modalOverlay');

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalIcon.textContent = icon;

    modal.style.display = 'flex';

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      modal.style.display = 'none';
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      overlay.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    overlay.addEventListener('click', handleCancel);
  });
}

function formatAgo(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function statusLabel(s) {
  return (s || 'unverified').replaceAll('_', ' ');
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function ageTier(ageMinutes) {
  const m = Number(ageMinutes ?? 0);
  if (!Number.isFinite(m)) return 0;
  if (m < 10) return 0;
  if (m < 30) return 1;
  if (m < 60) return 2;
  return 3;
}

function severityBadgeClass(sev) {
  if (sev === 'critical') return 'badge badge--critical';
  if (sev === 'attention') return 'badge badge--attention';
  return 'badge badge--info';
}

function statusToAccent(status) {
  const s = status || 'unverified';
  if (s === 'responding') return 'badge badge--critical';
  if (s === 'verified') return 'badge badge--attention';
  if (s === 'crowd_confirmed') return 'badge badge--confirm';
  if (s === 'resolved') return 'badge';
  return 'badge badge--info';
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

function groupDuplicates(incidents) {
  // Visual grouping on client: same type, within 200m, within 10 minutes.
  const maxMeters = 200;
  const maxAgeMs = 10 * 60 * 1000;
  const groups = [];

  for (const inc of incidents) {
    const tMs = Date.parse(inc.timestamp);
    let placed = false;

    for (const g of groups) {
      const rep = g[0];
      if (rep.type !== inc.type) continue;
      const age = Math.abs(Date.parse(rep.timestamp) - tMs);
      if (!Number.isFinite(age) || age > maxAgeMs) continue;
      const d = haversineMeters(rep.latitude, rep.longitude, inc.latitude, inc.longitude);
      if (d <= maxMeters) {
        g.push(inc);
        placed = true;
        break;
      }
    }

    if (!placed) groups.push([inc]);
  }

  return groups;
}

function toast(msg) {
  const el = isAdmin ? qs('#toastAdmin') : qs('#toast');
  if (el) el.textContent = msg;
}

function setGeoMeta() {
  const el = qs('#geoMeta');
  if (state.geo.lat == null || state.geo.lon == null) {
    el.textContent = 'Location: Click "Use My Location" to detect automatically';
  } else {
    el.textContent = 'Location: Detected from your device ✓';
  }
}

async function useBrowserGeo() {
  if (!('geolocation' in navigator)) {
    toast('Geolocation unavailable in this browser');
    return;
  }

  toast('Locating…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      state.geo = { lat, lon };
      setGeoMeta();
      toast('Location locked ✓');
    },
    () => {
      toast('Location permission denied — enter location name');
    },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 15000 }
  );
}

function renderList() {
  const list = qs('#incidentList');
  const incidents = Array.from(state.incidentsById.values());
  
  // Apply admin filters
  let filtered = incidents;
  if (isAdmin) {
    const statusFilter = qs('#filterStatus')?.value || '';
    const severityFilter = qs('#filterSeverity')?.value || '';
    const typeFilter = qs('#filterType')?.value || '';
    const minPriFilter = qs('#filterMinPriority')?.value || '';
    const hideResolved = qs('#hideResolved')?.checked ?? false;
    
    filtered = incidents.filter(inc => {
      if (hideResolved && inc.status === 'resolved') return false;
      if (statusFilter && inc.status !== statusFilter) return false;
      if (severityFilter && inc.severity !== severityFilter) return false;
      if (typeFilter && inc.type !== typeFilter) return false;
      if (minPriFilter && (inc.priority_score ?? 0) < Number(minPriFilter)) return false;
      return true;
    });
  }
  
  const groups = groupDuplicates(filtered);

  const total = groups.length;
  qs('#queueMeta').textContent = `${total} incident${total === 1 ? '' : 's'}`;

  // Update admin metrics if in admin view
  if (isAdmin) {
    updateMetrics(incidents);
  }

  list.innerHTML = '';

  for (const g of groups) {
    // Pick highest priority representative: sort using backend ordering (already sorted) is unknown in map,
    // so we re-sort by status/confirmations/time.
    g.sort((a, b) => {
      const rank = (s) => ({ responding: 4, verified: 3, crowd_confirmed: 2, unverified: 1, resolved: 0 }[s] ?? 1);
      const sr = rank(b.status) - rank(a.status);
      if (sr !== 0) return sr;
      const cr = (b.confirmation_count ?? 0) - (a.confirmation_count ?? 0);
      if (cr !== 0) return cr;
      return Date.parse(b.timestamp) - Date.parse(a.timestamp);
    });

    const rep = g[0];
    const isSelected = state.selectedId === rep.id;

    const card = document.createElement('div');
    const isNew = !state.seenIds.has(rep.id);
    const tier = ageTier(rep.age_minutes);
    card.className = `card age-${tier} ${isSelected ? 'card--selected' : ''} ${isNew ? 'card--new' : ''}`;

    const sev = rep.severity || state.severityById.get(rep.id) || 'attention';
    const dupCount = g.length;
    const location = rep.display_location || 'Location unavailable';
    const pollStatus = rep.poll_status || {};
    const hasVoted = pollStatus.has_voted || false;
    const userChoice = pollStatus.user_choice || null;

    card.innerHTML = `
      <div class="card__top">
        <div class="card__type">${rep.type}</div>
        <div class="card__time js-ago" data-iso="${escapeHtml(rep.timestamp)}">${formatAgo(rep.timestamp)}</div>
      </div>
      <div class="card__location" style="font-size: 11px; color: rgba(55,182,255,0.75); margin-bottom: 6px; font-weight: 500;">
        📍 ${escapeHtml(location)}
      </div>
      <div class="card__desc">${escapeHtml(rep.description || '')}</div>
      <div class="badges">
        <span class="${severityBadgeClass(sev)}">${sev.toUpperCase()}</span>
        <span class="${statusToAccent(rep.status)}">${statusLabel(rep.status).toUpperCase()}</span>
        <span class="badge badge--confirm">CONFIRMS: ${rep.confirmation_count ?? 0}</span>
        <span class="badge"><span class="card__pri">PRI ${Number(rep.priority_score ?? 0)}</span></span>
        ${dupCount > 1 ? `<span class="badge">DUP GROUP: ${dupCount}</span>` : ''}
      </div>
      ${hasVoted ? `
        <div class="pollStatus">
          ✓ You responded: <strong>${userChoice?.toUpperCase()}</strong>
        </div>
      ` : `
        <div class="pollButtons" data-incident-id="${escapeHtml(rep.id)}">
          <span style="font-size: 10px; color: rgba(255,255,255,0.5); margin-right: 8px;">Verify:</span>
          <button class="pollBtn pollBtn--confirm" data-choice="confirm">✓ Confirm</button>
          <button class="pollBtn pollBtn--deny" data-choice="deny">✗ Deny</button>
          <button class="pollBtn pollBtn--unsure" data-choice="unsure">? Unsure</button>
        </div>
      `}
    `;

    card.addEventListener('click', (e) => {
      // Don't select card if clicking a poll button
      if (e.target.classList.contains('pollBtn')) return;
      state.selectedId = rep.id;
      renderList();
      renderDetails();
    });

    // Add poll button handlers
    const pollButtons = card.querySelectorAll('.pollBtn');
    pollButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const choice = btn.dataset.choice;
        const incidentId = btn.closest('.pollButtons').dataset.incidentId;
        
        try {
          await apiSubmitPoll(incidentId, choice);
          toast(`Verification recorded: ${choice}`);
          await apiFetchIncidents();
          renderList();
          renderDetails();
        } catch (err) {
          toast(err.message || 'Poll submission failed');
        }
      });
    });

    list.appendChild(card);

    state.seenIds.add(rep.id);
  }
}

function renderDetails() {
  const box = qs('#details');
  const meta = qs('#detailMeta');

  if (!state.selectedId) {
    box.innerHTML = `<div class="empty">No incident selected.</div>`;
    meta.textContent = 'Select an incident';
    return;
  }

  const inc = state.incidentsById.get(state.selectedId);
  if (!inc) {
    state.selectedId = null;
    renderDetails();
    return;
  }

  meta.textContent = `ID: ${inc.id}`;

  const factors = inc.priority_factors || {};
  const sevPts = factors.severity?.points ?? 0;
  const confPts = factors.confirmations?.points ?? 0;
  const agePts = factors.time_open?.points ?? 0;
  const sevMax = 60;
  const confMax = 40;
  const ageMax = 45;
  const sevPct = Math.round(clamp01(sevPts / sevMax) * 100);
  const confPct = Math.round(clamp01(confPts / confMax) * 100);
  const agePct = Math.round(clamp01(agePts / ageMax) * 100);

  const timeline = Array.isArray(inc.timeline) ? inc.timeline : [];
  const timelineHtml = timeline
    .slice()
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
    .map((t) => {
      const actor = (t.actor || 'system').toLowerCase();
      const dotClass = actor === 'crowd' ? 'tdot--crowd' : actor === 'responder' ? 'tdot--responder' : 'tdot--system';
      return `
        <div class="titem">
          <div class="tdot ${dotClass}"></div>
          <div>
            <div class="thead">
              <div class="taction">${escapeHtml((t.action || 'event').replaceAll('_',' '))}</div>
              <div class="tmeta">${escapeHtml(t.ts || '')}</div>
            </div>
            ${t.detail ? `<div class="tdetail">${escapeHtml(t.detail)}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  box.innerHTML = `
    <h3>${inc.type.toUpperCase()} • ${statusLabel(inc.status)}</h3>
    <div class="kv"><div class="k">Reported</div><div class="v"><span class="js-ago" data-iso="${escapeHtml(inc.timestamp)}">${formatAgo(inc.timestamp)}</span></div></div>
    <div class="kv"><div class="k">Priority Score</div><div class="v"><code>${Number(inc.priority_score ?? 0)}</code></div></div>
    <div class="kv"><div class="k">Confirmations</div><div class="v">${inc.confirmation_count ?? 0} citizen${inc.confirmation_count === 1 ? '' : 's'}</div></div>
    <div class="kv"><div class="k">Location</div><div class="v" style="color: rgba(55,182,255,0.9); font-weight: 500;">${escapeHtml(inc.display_location || 'Location unavailable')}</div></div>
    <div class="kv"><div class="k">Description</div><div class="v">${escapeHtml(inc.description || '')}</div></div>

    <div class="priorityBox" id="priorityBox">
      <div class="priorityTop">
        <div class="priorityTitle">Why it’s prioritized</div>
        <div class="priorityScore">Score: ${Number(inc.priority_score ?? 0)}</div>
      </div>
      <div class="priorityBars">
        <div class="pbar">
          <div class="label">Severity</div>
          <div class="bar bar--sev"><span style="width:${sevPct}%"></span></div>
          <div class="val">+${sevPts}</div>
        </div>
        <div class="pbar">
          <div class="label">Confirmations</div>
          <div class="bar bar--conf"><span style="width:${confPct}%"></span></div>
          <div class="val">+${confPts}</div>
        </div>
        <div class="pbar">
          <div class="label">Time open</div>
          <div class="bar bar--age"><span style="width:${agePct}%"></span></div>
          <div class="val">+${agePts}</div>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn" id="confirmBtn">Confirm Nearby</button>
    </div>

    <div class="timeline">
      <div class="timelineTitle">Incident Timeline</div>
      ${timelineHtml || '<div class="empty">No timeline entries yet.</div>'}
    </div>
  `;

  qs('#confirmBtn').addEventListener('click', async () => {
    await apiConfirm(inc.id);
    ack(qs('#details'));
  });

  if (isAdmin) {
    qs('#adminFooter').hidden = false;
    qs('#adminStatus').value = inc.status;
    qs('#adminNotes').value = inc.internal_notes || '';
    
    // Load and display poll results for admins
    loadPollResults(inc.id);
  } else {
    qs('#adminFooter').hidden = true;
  }
}

async function loadPollResults(incidentId) {
  try {
    const results = await apiGetPollResults(incidentId);
    const pollBox = document.createElement('div');
    pollBox.className = 'pollResultsBox';
    pollBox.id = 'pollResultsBox';
    
    const total = results.total || 0;
    const confirm = results.confirm || 0;
    const deny = results.deny || 0;
    const unsure = results.unsure || 0;
    const confidence = results.confidence_score || 0;
    
    const confirmPct = total > 0 ? Math.round((confirm / total) * 100) : 0;
    const denyPct = total > 0 ? Math.round((deny / total) * 100) : 0;
    const unsurePct = total > 0 ? Math.round((unsure / total) * 100) : 0;
    
    const confidenceClass = confidence >= 70 ? 'confidence--high' : confidence >= 40 ? 'confidence--medium' : 'confidence--low';
    
    pollBox.innerHTML = `
      <div class="pollResultsTop">
        <div class="pollResultsTitle">Crowd Verification</div>
        <div class="confidenceScore ${confidenceClass}">${confidence}% confidence</div>
      </div>
      <div class="pollResultsBars">
        <div class="pollBar">
          <div class="pollBarLabel">✓ Confirm (${confirm})</div>
          <div class="pollBarTrack">
            <div class="pollBarFill pollBarFill--confirm" style="width: ${confirmPct}%"></div>
          </div>
          <div class="pollBarPct">${confirmPct}%</div>
        </div>
        <div class="pollBar">
          <div class="pollBarLabel">✗ Deny (${deny})</div>
          <div class="pollBarTrack">
            <div class="pollBarFill pollBarFill--deny" style="width: ${denyPct}%"></div>
          </div>
          <div class="pollBarPct">${denyPct}%</div>
        </div>
        <div class="pollBar">
          <div class="pollBarLabel">? Unsure (${unsure})</div>
          <div class="pollBarTrack">
            <div class="pollBarFill pollBarFill--unsure" style="width: ${unsurePct}%"></div>
          </div>
          <div class="pollBarPct">${unsurePct}%</div>
        </div>
      </div>
      <div class="pollResultsFooter">Total responses: ${total}</div>
    `;
    
    // Insert after priority box
    const priorityBox = qs('#priorityBox');
    if (priorityBox && priorityBox.nextSibling) {
      priorityBox.parentNode.insertBefore(pollBox, priorityBox.nextSibling);
    }
  } catch (err) {
    console.error('Failed to load poll results:', err);
  }
}

function ack(el) {
  if (!el) return;
  el.classList.remove('ack');
  // Force reflow so animation retriggers.
  // eslint-disable-next-line no-unused-expressions
  el.offsetHeight;
  el.classList.add('ack');
  setTimeout(() => el.classList.remove('ack'), 320);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function updateAgoLabels() {
  for (const el of qsa('.js-ago')) {
    const iso = el.getAttribute('data-iso');
    if (!iso) continue;
    el.textContent = formatAgo(iso);
  }
}

function updateMetrics(incidents) {
  const total = incidents.filter(i => i.status !== 'resolved').length;
  const critical = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
  const unverified = incidents.filter(i => i.status === 'unverified').length;
  const responding = incidents.filter(i => i.status === 'responding').length;

  const metricTotal = qs('#metricTotal');
  const metricCritical = qs('#metricCritical');
  const metricUnverified = qs('#metricUnverified');
  const metricResponding = qs('#metricResponding');

  if (metricTotal) metricTotal.textContent = total;
  if (metricCritical) metricCritical.textContent = critical;
  if (metricUnverified) metricUnverified.textContent = unverified;
  if (metricResponding) metricResponding.textContent = responding;
}

async function apiFetchIncidents() {
  const url = new URL(`${API_BASE}/api/incidents`, window.location.href);
  if (state.lastSince) url.searchParams.set('since', state.lastSince);

  const res = await fetch(url.toString(), {
    headers: auth.getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch incidents');
  const data = await res.json();

  // Move cursor forward (server_time is safest).
  state.lastSince = data.server_time;

  const incidents = Array.isArray(data.incidents) ? data.incidents : [];
  for (const inc of incidents) state.incidentsById.set(inc.id, inc);

  // If this is the first load (no since), we should replace entirely.
  if (!data.changes_only) {
    const next = new Map();
    for (const inc of incidents) next.set(inc.id, inc);
    state.incidentsById = next;
  }

  qs('#refreshChip').textContent = `Last refresh: ${new Date().toLocaleTimeString()}`;
}

async function apiCreateIncident(payload) {
  const res = await fetch(`${API_BASE}/api/incidents`, {
    method: 'POST',
    headers: auth.getHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Create failed');
  return data;
}

async function apiConfirm(id) {
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/confirm`, { 
    method: 'POST',
    headers: auth.getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Confirm failed');
  if (data?.incident) state.incidentsById.set(data.incident.id, data.incident);
  toast('Confirmation recorded');
  renderList();
  renderDetails();
  updateAgoLabels();
}

async function apiSetStatus(id, status) {
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: auth.getHeaders(),
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Status update failed');
  if (data?.incident) state.incidentsById.set(data.incident.id, data.incident);
}

async function apiSetNotes(id, internal_notes) {
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/notes`, {
    method: 'PATCH',
    headers: auth.getHeaders(),
    body: JSON.stringify({ internal_notes })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Notes update failed');
  if (data?.incident) state.incidentsById.set(data.incident.id, data.incident);
}

async function apiSubmitPoll(incidentId, choice) {
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(incidentId)}/poll`, {
    method: 'POST',
    headers: auth.getHeaders(),
    body: JSON.stringify({ choice })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Poll submission failed');
  return data;
}

async function apiGetPollResults(incidentId) {
  const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(incidentId)}/poll-results`, {
    headers: auth.getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to fetch poll results');
  return data;
}

async function apiDeleteIncident(id) {
  console.log('apiDeleteIncident called with id:', id);
  const url = `${API_BASE}/api/incidents/${encodeURIComponent(id)}`;
  console.log('DELETE URL:', url);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: auth.getHeaders()
  });
  console.log('DELETE response status:', res.status);
  const data = await res.json();
  console.log('DELETE response data:', data);
  if (!res.ok) throw new Error(data?.error || 'Delete failed');
  state.incidentsById.delete(id);
  return data;
}

async function pollOnce() {
  try {
    await apiFetchIncidents();
    qs('#pollChip').textContent = 'Polling Active';
  } catch {
    qs('#pollChip').textContent = 'Polling Degraded';
  }
  renderList();
  renderDetails();
  updateAgoLabels();
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollOnce, POLL_MS);
}

function wireForm() {
  // Show/hide views based on isAdmin
  const citizenView = qs('#citizenView');
  const adminView = qs('#adminView');
  const viewToggle = qs('#viewToggle');
  const leftPanel = qs('.panel--left');
  const rightPanel = qs('.panel--right');
  const centerPanel = qs('.panel--center');
  
  function switchView(animated = true) {
    if (citizenView && adminView) {
      if (animated) {
        // Apply exit animation to all panels with staggered delays
        const exitingView = isAdmin ? adminView : citizenView;
        exitingView.classList.add('view-transition-exit');
        if (leftPanel) leftPanel.classList.add('view-transition-exit');
        if (centerPanel) centerPanel.classList.add('view-transition-exit', 'view-transition-exit-delay-1');
        if (rightPanel) rightPanel.classList.add('view-transition-exit', 'view-transition-exit-delay-2');
        
        setTimeout(() => {
          if (isAdmin) {
            citizenView.hidden = true;
            adminView.hidden = false;
          } else {
            citizenView.hidden = false;
            adminView.hidden = true;
          }
          
          // Apply enter animation to all panels with staggered delays (250ms and 500ms gap)
          const enteringView = isAdmin ? adminView : citizenView;
          enteringView.classList.remove('view-transition-exit');
          enteringView.classList.add('view-transition-enter');
          
          if (leftPanel) {
            leftPanel.classList.remove('view-transition-exit');
            leftPanel.classList.add('view-transition-enter');
          }
          if (centerPanel) {
            centerPanel.classList.remove('view-transition-exit', 'view-transition-exit-delay-1');
            centerPanel.classList.add('view-transition-enter', 'view-transition-enter-delay-1');
          }
          if (rightPanel) {
            rightPanel.classList.remove('view-transition-exit', 'view-transition-exit-delay-2');
            rightPanel.classList.add('view-transition-enter', 'view-transition-enter-delay-2');
          }
          
          setTimeout(() => {
            enteringView.classList.remove('view-transition-enter');
            if (leftPanel) leftPanel.classList.remove('view-transition-enter');
            if (centerPanel) centerPanel.classList.remove('view-transition-enter', 'view-transition-enter-delay-1');
            if (rightPanel) rightPanel.classList.remove('view-transition-enter', 'view-transition-enter-delay-2');
          }, 1650);
        }, 650);
      } else {
        if (isAdmin) {
          citizenView.hidden = true;
          adminView.hidden = false;
        } else {
          citizenView.hidden = false;
          adminView.hidden = true;
        }
      }
    }
    
    // Update toggle button text
    if (viewToggle) {
      viewToggle.textContent = isAdmin ? 'Citizen View' : 'Admin View';
    }
  }
  
  // Initial view setup (no animation on first load)
  switchView(false);
  
  // View toggle button handler
  if (viewToggle) {
    viewToggle.addEventListener('click', () => {
      isAdmin = !isAdmin;
      
      // Update URL without reload
      const url = new URL(window.location);
      if (isAdmin) {
        url.searchParams.set('admin', '1');
      } else {
        url.searchParams.delete('admin');
      }
      window.history.pushState({}, '', url);
      
      switchView(true);
      
      // Update admin footer visibility
      const adminFooter = qs('#adminFooter');
      if (adminFooter) {
        adminFooter.hidden = !isAdmin;
      }
      
      // Refresh UI
      renderList();
      renderDetails();
      toast(isAdmin ? 'Responder view active' : 'Citizen reporting ready');
    });
  }

  // Citizen view form handlers
  if (!isAdmin && qs('#useGeoBtn')) {
    qs('#useGeoBtn').addEventListener('click', useBrowserGeo);
  }

  if (!isAdmin && qs('#reportForm')) {
    qs('#reportForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const type = qs('#typeSelect').value;
      const description = qs('#descInput').value.trim();
      const locationName = qs('#locationInput').value.trim();

      // Build payload: prefer location_name if provided, else use GPS coordinates
      const payload = { type, description };
      
      if (locationName) {
        payload.location_name = locationName;
      } else if (state.geo.lat != null && state.geo.lon != null) {
        payload.latitude = state.geo.lat;
        payload.longitude = state.geo.lon;
      } else {
        toast('Location required: enter a location name or use "Use My Location" button');
        return;
      }

      qs('#submitBtn').disabled = true;
      toast('Submitting…');

      try {
        const sev = qs('#severitySelect').value;
        payload.severity = sev;
        const { incident, incident_id } = await apiCreateIncident(payload);
        if (incident?.id) state.severityById.set(incident.id, sev);

        toast(`Report submitted successfully!`);
        state.lastSince = null; // force full refresh once for demo clarity
        await pollOnce();
        state.selectedId = incident_id;
        renderList();
        renderDetails();
        qs('#descInput').value = '';
        qs('#locationInput').value = '';
        state.geo = { lat: null, lon: null };
        setGeoMeta();
      } catch (err) {
        toast(err.message || 'Submit failed');
      } finally {
        qs('#submitBtn').disabled = false;
      }
    });
  }

  // Admin view handlers
  if (isAdmin) {
    // Filter change listeners
    const filterEls = ['#filterStatus', '#filterSeverity', '#filterType', '#filterMinPriority', '#hideResolved'];
    for (const sel of filterEls) {
      const el = qs(sel);
      if (el) {
        el.addEventListener('change', () => {
          renderList();
          renderDetails();
        });
      }
    }

    // Refresh button
    const refreshBtn = qs('#refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        toast('Refreshing…');
        await pollOnce();
        toast('Refreshed');
      });
    }

    // Clear filters button
    const clearFiltersBtn = qs('#clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        for (const sel of filterEls) {
          const el = qs(sel);
          if (el) el.value = '';
        }
        renderList();
        renderDetails();
        toast('Filters cleared');
      });
    }
  }

  // Admin controls in detail panel (both views)
  if (isAdmin) {
    const setStatusBtn = qs('#setStatusBtn');
    const saveNotesBtn = qs('#saveNotesBtn');
    
    if (setStatusBtn) {
      setStatusBtn.addEventListener('click', async () => {
        if (!state.selectedId) return toast('Select an incident first');
        try {
          await apiSetStatus(state.selectedId, qs('#adminStatus').value);
          toast('Status updated');
          await pollOnce();
          renderList();
          renderDetails();
          ack(qs('#details'));
        } catch (e) {
          toast(e.message || 'Status update failed');
        }
      });
    }

    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', async () => {
        if (!state.selectedId) return toast('Select an incident first');
        try {
          await apiSetNotes(state.selectedId, qs('#adminNotes').value);
          toast('Notes saved');
          await pollOnce();
          renderList();
          renderDetails();
          ack(qs('#details'));
        } catch (e) {
          toast(e.message || 'Notes save failed');
        }
      });
    }

    const deleteBtn = qs('#deleteIncidentBtn');
    console.log('Delete button found:', deleteBtn);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        console.log('Delete button clicked, selectedId:', state.selectedId);
        if (!state.selectedId) return toast('Select an incident first');
        
        const confirmed = await showModal(
          'Are you sure you want to permanently delete this incident? This action cannot be undone.',
          'Delete Incident',
          '🗑️'
        );
        console.log('User confirmed:', confirmed);
        if (!confirmed) return;
        
        try {
          console.log('Calling apiDeleteIncident with ID:', state.selectedId);
          await apiDeleteIncident(state.selectedId);
          toast('Incident deleted permanently');
          state.selectedId = null;
          await pollOnce();
          renderList();
          renderDetails();
        } catch (e) {
          console.error('Delete error:', e);
          toast(e.message || 'Delete failed');
        }
      });
    }
  }
}

function initParticles() {
  const canvas = qs('#particles');
  if (!canvas) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let w = 0;
  let h = 0;
  let raf = 0;

  const particles = [];

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.max(45, Math.min(110, Math.floor((w * h) / 24000)));
    while (particles.length < target) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1 + Math.random() * 2.2,
        a: 0.18 + Math.random() * 0.22,
        hue: Math.random() < 0.72 ? 198 : 350
      });
    }
    particles.length = target;
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    // Links
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 110 * 110) continue;
        const d = Math.sqrt(d2);
        const alpha = (1 - d / 110) * 0.10;
        ctx.strokeStyle = `rgba(55,182,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }

    // Points
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      ctx.fillStyle = `hsla(${p.hue}, 95%, 62%, ${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = window.requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  step();

  return () => {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

// Boot function moved below checkAuth - see line ~1326
// =============================================================================
// OPENSTREETMAP + LEAFLET INTEGRATION
// =============================================================================

function initMap() {
  const mapContainer = qs('#incidentMap');
  if (!mapContainer || state.map) return;

  // Default center (can be customized per city)
  const defaultCenter = [22.5726, 88.3639]; // Kolkata
  const defaultZoom = 12;

  // Initialize Leaflet map with OpenStreetMap tiles
  state.map = L.map('incidentMap').setView(defaultCenter, defaultZoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors',
    maxZoom: 18,
    className: 'map-tiles'
  }).addTo(state.map);
}

function getMarkerColor(status) {
  // Color-coded by operational status
  switch (status) {
    case 'verified':
    case 'responding':
      return '#ff4d6d'; // Red - active response
    case 'crowd_confirmed':
      return '#ffd166'; // Yellow - verified by crowd
    case 'resolved':
      return '#06d6a0'; // Green - resolved
    default:
      return '#8b9dc3'; // Gray - unverified
  }
}

function updateMapMarkers() {
  if (!state.map) return;

  const incidents = Array.from(state.incidentsById.values());
  const activeIds = new Set();

  for (const inc of incidents) {
    if (!inc.latitude || !inc.longitude) continue;

    activeIds.add(inc.id);
    let marker = state.markers.get(inc.id);

    if (!marker) {
      // Create new marker
      const markerColor = getMarkerColor(inc.status);
      const markerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style=\"
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${markerColor};
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 12px ${markerColor}, 0 4px 8px rgba(0,0,0,0.4);
        \"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      marker = L.marker([inc.latitude, inc.longitude], { icon: markerIcon })
        .addTo(state.map);

      // Popup with incident details
      const popupContent = `
        <div style=\"font-family: Outfit, sans-serif; min-width: 180px;\">
          <div style=\"font-weight: 600; font-size: 14px; margin-bottom: 6px; color: ${markerColor};\">
            ${inc.type.toUpperCase()}
          </div>
          <div style=\"font-size: 12px; margin-bottom: 4px; color: rgba(234,240,255,0.85);\">
            ${inc.display_location || 'Location unavailable'}
          </div>
          <div style=\"font-size: 11px; color: rgba(234,240,255,0.65); margin-bottom: 4px;\">
            Status: ${statusLabel(inc.status)}
          </div>
          <div style=\"font-size: 11px; color: rgba(234,240,255,0.55);\">
            ${formatAgo(inc.timestamp)}
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      // Click handler: select incident in list
      marker.on('click', () => {
        selectIncident(inc.id);
      });

      state.markers.set(inc.id, marker);
    } else {
      // Update existing marker color if status changed
      const newColor = getMarkerColor(inc.status);
      marker.setIcon(L.divIcon({
        className: 'custom-marker',
        html: `<div style=\"
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${newColor};
          border: 2px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 12px ${newColor}, 0 4px 8px rgba(0,0,0,0.4);
        \"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      }));

      // Update popup content
      const popupContent = `
        <div style=\"font-family: Outfit, sans-serif; min-width: 180px;\">
          <div style=\"font-weight: 600; font-size: 14px; margin-bottom: 6px; color: ${newColor};\">
            ${inc.type.toUpperCase()}
          </div>
          <div style=\"font-size: 12px; margin-bottom: 4px; color: rgba(234,240,255,0.85);\">
            ${inc.display_location || 'Location unavailable'}
          </div>
          <div style=\"font-size: 11px; color: rgba(234,240,255,0.65); margin-bottom: 4px;\">
            Status: ${statusLabel(inc.status)}
          </div>
          <div style=\"font-size: 11px; color: rgba(234,240,255,0.55);\">
            ${formatAgo(inc.timestamp)}
          </div>
        </div>
      `;
      marker.setPopupContent(popupContent);
    }
  }

  // Remove markers for incidents no longer in list
  for (const [id, marker] of state.markers.entries()) {
    if (!activeIds.has(id)) {
      state.map.removeLayer(marker);
      state.markers.delete(id);
    }
  }

  // Auto-center on latest incident (first poll only)
  if (incidents.length > 0 && state.markers.size === incidents.length) {
    const latest = incidents[0];
    if (latest.latitude && latest.longitude) {
      state.map.setView([latest.latitude, latest.longitude], 13, {
        animate: true,
        duration: 0.5
      });
    }
  }
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

function authToast(msg) {
  const el = qs('#authToast');
  if (el) el.textContent = msg;
}

// Initialize auth particle effect
function initAuthParticles() {
  const canvas = qs('#authParticles');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 60;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1,
      color: `rgba(${[
        '55,182,255',
        '61,255,181',
        '255,77,109'
      ][Math.floor(Math.random() * 3)]},${Math.random() * 0.5 + 0.2})`
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Draw connections
      particles.slice(i + 1).forEach(p2 => {
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(55,182,255,${(1 - dist / 150) * 0.15})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    });

    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

let authHandlersSetup = false; // Prevent duplicate setup

function setupAuthHandlers() {
  if (authHandlersSetup) return; // Already set up
  authHandlersSetup = true;

  initAuthParticles(); // Start particle animation

  const loginForm = qs('#loginForm');
  const signupForm = qs('#signupForm');
  const showSignupBtn = qs('#showSignupBtn');
  const showLoginBtn = qs('#showLoginBtn');
  const loginBtn = qs('#loginBtn');
  const signupBtn = qs('#signupBtn');
  const logoutBtn = qs('#logoutBtn');

  // Toggle between login and signup
  showSignupBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.hidden = true;
    signupForm.hidden = false;
    authToast('');
  });

  showLoginBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.hidden = true;
    loginForm.hidden = false;
    authToast('');
  });

  // Login button handler
  loginBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = qs('#loginEmail').value.trim();
    const password = qs('#loginPassword').value;

    if (!email || !password) {
      authToast('⚠️ Please fill in all fields');
      return;
    }

    authToast('🔐 Logging in...');
    loginBtn.disabled = true;
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      // Save token and user data
      auth.save(data.token, data.user);
      console.log('Login successful, token saved:', {
        hasToken: !!auth.token,
        user: auth.user
      });
      
      authToast('✅ Login successful! Loading app...');
      
      // Hide auth screen and show main app
      const authScreen = qs('#authScreen');
      const mainHeader = qs('#mainHeader');
      const mainLayout = qs('#mainLayout');
      
      authScreen.style.display = 'none';
      mainHeader.style.display = '';
      mainLayout.style.display = '';
      
      // Set isAdmin and update UI
      isAdmin = auth.isAdmin();
      const userChip = qs('#userChip');
      if (userChip) {
        userChip.textContent = `${auth.user.name} (${auth.user.role})`;
        userChip.classList.add(auth.user.role === 'admin' ? 'chip--live' : 'chip--link');
      }
      
      // Initialize the main app
      console.log('About to call initMainApp...');
      await initMainApp();
      console.log('initMainApp call completed');
    } catch (err) {
      console.error('Login error:', err);
      authToast(`❌ ${err.message || 'Login failed'}`);
      loginBtn.disabled = false;
    }
  });

  // Signup button handler
  signupBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const name = qs('#signupName').value.trim();
    const email = qs('#signupEmail').value.trim();
    const password = qs('#signupPassword').value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    
    if (!name || !email || !password) {
      authToast('⚠️ Please fill in all fields');
      return;
    }

    if (password.length < 4) {
      authToast('⚠️ Password must be at least 4 characters');
      return;
    }

    if (!roleInput) {
      authToast('⚠️ Please select a role');
      return;
    }

    const role = roleInput.value;

    authToast('🚀 Creating account...');
    signupBtn.disabled = true;
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      // Save token and user data
      auth.save(data.token, data.user);
      console.log('Signup successful, token saved:', {
        hasToken: !!auth.token,
        user: auth.user
      });
      
      authToast('✅ Account created! Loading app...');
      
      // Hide auth screen and show main app
      const authScreen = qs('#authScreen');
      const mainHeader = qs('#mainHeader');
      const mainLayout = qs('#mainLayout');
      
      authScreen.style.display = 'none';
      mainHeader.style.display = '';
      mainLayout.style.display = '';
      
      // Set isAdmin and update UI
      isAdmin = auth.isAdmin();
      const userChip = qs('#userChip');
      if (userChip) {
        userChip.textContent = `${auth.user.name} (${auth.user.role})`;
        userChip.classList.add(auth.user.role === 'admin' ? 'chip--live' : 'chip--link');
      }
      
      // Initialize the main app
      console.log('About to call initMainApp after signup...');
      await initMainApp();
      console.log('initMainApp call completed after signup');
    } catch (err) {
      console.error('Signup error:', err);
      authToast(`❌ ${err.message || 'Signup failed'}`);
      signupBtn.disabled = false;
    }
  });

  // Enter key support
  qs('#loginEmail')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') qs('#loginPassword')?.focus();
  });

  qs('#loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn?.click();
  });

  qs('#signupName')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') qs('#signupEmail')?.focus();
  });

  qs('#signupEmail')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') qs('#signupPassword')?.focus();
  });

  qs('#signupPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signupBtn?.click();
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    const confirmed = await showModal(
      'Are you sure you want to logout? You will need to login again to access the system.',
      'Confirm Logout',
      '👋'
    );
    if (confirmed) {
      auth.clear();
      window.location.reload();
    }
  });
}

async function checkAuth() {
  auth.init();
  
  console.log('checkAuth called:', {
    isAuthenticated: auth.isAuthenticated(),
    hasToken: !!auth.token,
    hasUser: !!auth.user
  });

  const authScreen = qs('#authScreen');
  const mainHeader = qs('#mainHeader');
  const mainLayout = qs('#mainLayout');

  if (!auth.isAuthenticated()) {
    console.log('Not authenticated, showing auth screen');
    // Show auth screen
    authScreen.style.display = 'flex';
    mainHeader.style.display = 'none';
    mainLayout.style.display = 'none';
    setupAuthHandlers();
    return false;
  }

  // Verify token is still valid
  try {
    console.log('Verifying token with server...');
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: auth.getHeaders()
    });

    if (!res.ok) {
      console.error('Token verification failed:', res.status);
      const errorData = await res.json().catch(() => ({}));
      console.error('Error details:', errorData);
      throw new Error('Invalid token');
    }

    const data = await res.json();
    console.log('Token verified successfully:', data);
    
    // Update user data from verification response
    if (data.user) {
      auth.user = data.user;
    }

    // Token valid - hide auth screen, show main app
    authScreen.style.display = 'none';
    mainHeader.style.display = '';
    mainLayout.style.display = '';

    // Set isAdmin based on role
    isAdmin = auth.isAdmin();

    // Update UI
    const userChip = qs('#userChip');
    if (userChip) {
      userChip.textContent = `${auth.user.name} (${auth.user.role})`;
      userChip.classList.add(auth.user.role === 'admin' ? 'chip--live' : 'chip--link');
    }

    // Setup logout handler only (login/signup already set up)
    if (!authHandlersSetup) {
      setupAuthHandlers();
    }

    console.log('Authentication successful, showing main app');
    return true;
  } catch (err) {
    // Token invalid - logout and show auth screen
    console.error('Auth verification error:', err);
    auth.clear();
    authScreen.style.display = 'flex';
    mainHeader.style.display = 'none';
    mainLayout.style.display = 'none';
    setupAuthHandlers();
    return false;
  }
}

// Initialize main app after authentication
async function initMainApp() {
  console.log('initMainApp started, isAdmin:', isAdmin);
  
  try {
    console.log('Initializing particles...');
    initParticles();
    
    console.log('Setting up admin footer...');
    qs('#adminFooter').hidden = !isAdmin;
    toast(isAdmin ? 'Responder view active' : 'Citizen reporting ready');

    // Hide view toggle for citizens
    const viewToggle = qs('#viewToggle');
    if (viewToggle) {
      viewToggle.hidden = !isAdmin;
    }

    console.log('Wiring form...');
    wireForm();
    
    // Close button handler
    const closeBtn = qs('#closeDetailsBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        state.selectedId = null;
        renderList();
        renderDetails();
      });
    }

    if (!isAdmin) {
      console.log('Getting browser geolocation...');
      await useBrowserGeo();
      setGeoMeta();
    }

    console.log('Polling incidents...');
    await pollOnce();
    startPolling();

    // Update "ago" timers without re-rendering the list (prevents blinking).
    setInterval(updateAgoLabels, 1000);
    
    console.log('initMainApp completed successfully!');
  } catch (err) {
    console.error('Error in initMainApp:', err);
    throw err;
  }
}

async function boot() {
  // Check authentication first
  const authenticated = await checkAuth();
  if (!authenticated) {
    return; // Stay on auth screen
  }

  // Initialize the main app
  await initMainApp();
}

// Start the application
boot().catch(err => {
  console.error('Boot failed:', err);
  // If boot fails, try to show auth screen
  const authScreen = qs('#authScreen');
  if (authScreen) {
    authScreen.style.display = 'flex';
    setupAuthHandlers();
  }
});
