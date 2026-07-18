/**
 * src/modules/organizer.js
 * StadiumFlow AI — Organizer Command Center Module
 *
 * AI-powered ops intelligence: situation reports, gate management,
 * volunteer deployment, digital twin, sustainability, broadcast.
 */

import { contextEngine } from '../services/contextEngine.js';
import { geminiService  } from '../services/ai.js';
import { escapeHTML, safeText, capitalize, crowdClass, crowdColor } from '../utils/dom.js';

let _pollId = null;

export default function initOrganizerApp() {
    bindOrgControls();
    renderOrgKPIs();
    renderOrgGates();
    renderOrgAlerts();
    renderEcoMetrics();
    updateDigitalTwin();
    renderVolunteerStatus();
    renderIncidentLog();

    loadOrgAISummary();

    // Refresh KPIs and gates every 5 seconds
    _pollId = setInterval(() => {
        renderOrgKPIs();
        renderOrgGates();
        updateDigitalTwin();
    }, 5000);

    console.log('[OrganizerApp] Initialized.');
}

export function destroyOrganizerApp() {
    if (_pollId) clearInterval(_pollId);
}

// ─── Controls ────────────────────────────────────────────────────────────────
function bindOrgControls() {
    document.getElementById('btn-refresh-summary')?.addEventListener('click', loadOrgAISummary);
    document.getElementById('btn-redeploy')?.addEventListener('click', loadVolunteerDeployment);
    document.getElementById('btn-org-emergency')?.addEventListener('click', orgTriggerEmergency);
    document.getElementById('btn-org-broadcast')?.addEventListener('click', orgBroadcast);
    document.getElementById('btn-clear-log')?.addEventListener('click', () => { const l = document.getElementById('org-log'); if (l) l.innerHTML = ''; });
}

// ─── KPI Row ─────────────────────────────────────────────────────────────────
function renderOrgKPIs() {
    const state  = contextEngine.getLiveState();
    const match  = contextEngine.getMatch();
    const overall= contextEngine.getOverallCrowdLevel();
    const openGates = Object.values(state.gates).filter(g => g.status === 'open').length;
    const totalGates= Object.keys(state.gates).length;
    const s      = state.sustainability;

    safeText('org-kpi-crowd',      `${overall}%`);
    safeText('org-kpi-gates',      `${openGates}/${totalGates}`);
    safeText('org-kpi-attendance', match.attendance.toLocaleString());
    safeText('org-kpi-eco',        `${Math.round(s.ecoScore)}/100`);

    const overallEl = document.getElementById('org-kpi-crowd');
    if (overallEl) overallEl.style.color = crowdColor(overall);
}

// ─── AI Operations Summary ────────────────────────────────────────────────────
async function loadOrgAISummary() {
    const skelEl  = document.getElementById('org-ai-summary-skeleton');
    const textEl  = document.getElementById('org-ai-summary-text');
    const alertsEl= document.getElementById('org-ai-alerts');
    const actionsEl = document.getElementById('org-ai-actions');
    const btn     = document.getElementById('btn-refresh-summary');

    if (skelEl) skelEl.classList.remove('hidden');
    if (textEl) textEl.classList.add('hidden');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner spin-anim"></i> Analyzing...';

    const ctx    = contextEngine.getSnapshot();
    const summary= await geminiService.summarizeOperations(ctx);

    if (skelEl) skelEl.classList.add('hidden');
    if (textEl) textEl.classList.remove('hidden');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh Report';

    if (!summary) return;

    if (textEl) textEl.textContent = summary.situationSummary || '';

    // Status badge
    const statusEl = document.getElementById('org-status-badge');
    if (statusEl) {
        const statCls = { normal: 'ok', watch: 'info', warning: 'warning', critical: 'danger' };
        statusEl.className = `status-badge badge-${statCls[summary.overallStatus] || 'info'}`;
        statusEl.textContent = capitalize(summary.overallStatus || 'Normal');
    }

    // Critical alerts
    if (alertsEl) {
        alertsEl.innerHTML = '';
        (summary.criticalAlerts || []).forEach(a => {
            const el = document.createElement('div');
            el.className = 'org-alert-item';
            el.innerHTML = `<div style="font-size:0.83rem">${escapeHTML(a)}</div>`;
            alertsEl.appendChild(el);
        });
    }

    // Immediate actions
    if (actionsEl) {
        actionsEl.innerHTML = '';
        (summary.immediateActions || []).forEach(action => {
            const el = document.createElement('div');
            el.className = 'org-action-item';
            el.innerHTML = `<div class="org-action-text">${escapeHTML(action)}</div>`;
            actionsEl.appendChild(el);
        });
    }

    // Predicted challenges
    const predsEl = document.getElementById('org-predictions');
    if (predsEl) {
        predsEl.innerHTML = '';
        (summary.predictedChallenges || []).forEach(p => {
            const el = document.createElement('div');
            el.className = 'org-prediction-item text-xs';
            el.innerHTML = `<div>${escapeHTML(p)}</div>`;
            predsEl.appendChild(el);
        });
    }

    // Sustainability note
    safeText('org-sustain-note', summary.sustainabilityNote || '');

    // Gate recommendations
    const gateRecsEl = document.getElementById('org-gate-recs');
    if (gateRecsEl) {
        gateRecsEl.innerHTML = '';
        (summary.gateRecommendations || []).forEach(r => {
            const el = document.createElement('div');
            el.className = 'org-rec-item';
            el.innerHTML = `<div>${escapeHTML(r)}</div>`;
            gateRecsEl.appendChild(el);
        });
    }

    addOrgLog(`AI Ops Report generated · Status: ${summary.overallStatus}`);
}

// ─── Gate Status Panel ────────────────────────────────────────────────────────
function renderOrgGates() {
    const container = document.getElementById('org-gates-list');
    if (!container) return;
    container.innerHTML = '';
    const gates = contextEngine.getLiveState().gates;

    Object.values(gates).forEach(gate => {
        const isOpen   = gate.status === 'open';
        const lvlClass = crowdClass(gate.crowdLevel);
        const el = document.createElement('div');
        el.className = 'org-gate-row';
        el.innerHTML = `
          <div class="org-gate-info">
            <div class="org-gate-name">${escapeHTML(gate.name)} <span class="text-muted text-xs">${escapeHTML(gate.direction)}</span></div>
            <div class="org-gate-stats text-xs">
              <span style="color:${crowdColor(gate.crowdLevel)}">${gate.crowdLevel.toFixed(0)}%</span>
              <span class="text-muted">· ${gate.avgWait}min wait</span>
              <span class="text-muted">· ${gate.lanes} lanes</span>
            </div>
            <div class="progress-bar" style="margin-top:0.25rem">
              <div class="progress-fill ${lvlClass}" style="width:${gate.crowdLevel}%"></div>
            </div>
          </div>
          <button class="org-gate-toggle ${isOpen ? 'open' : 'closed'}" data-gateid="${escapeHTML(gate.id)}" aria-label="Toggle ${escapeHTML(gate.name)}">
            ${isOpen ? '🟢 Open' : '🔴 Closed'}
          </button>`;
        el.querySelector('.org-gate-toggle')?.addEventListener('click', e => {
            const gateId = e.target.dataset.gateid;
            const newStatus = contextEngine.toggleGate(gateId);
            addOrgLog(`${gate.name} set to ${newStatus} by organizer`);
            renderOrgGates(); // re-render
        });
        container.appendChild(el);
    });
}

// ─── Volunteer Deployment ────────────────────────────────────────────────────
async function loadVolunteerDeployment() {
    const container = document.getElementById('vol-deployment-list');
    const btn = document.getElementById('btn-redeploy');
    if (!container) return;

    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner spin-anim"></i> AI Planning...';
    container.innerHTML = '<div class="text-muted text-xs p-sm">Calculating optimal deployment...</div>';

    const ctx  = contextEngine.getSnapshot();
    const plan = await geminiService.recommendVolunteerDeployment(ctx);

    if (btn) btn.innerHTML = '<i class="fa-solid fa-users-gear"></i> AI Redeploy';

    if (!plan) { container.innerHTML = '<div class="text-muted">Unable to generate plan.</div>'; return; }

    container.innerHTML = '';
    (plan.deployments || []).forEach(dep => {
        const priorityColor = dep.priority === 'high' ? 'var(--danger)' : dep.priority === 'medium' ? 'var(--warning)' : 'var(--success)';
        const el = document.createElement('div');
        el.className = 'vol-dep-card';
        el.innerHTML = `
          <div class="vol-dep-header">
            <span class="vol-dep-team">${escapeHTML(dep.team)}</span>
            <span class="vol-dep-priority" style="color:${priorityColor}">${capitalize(dep.priority)}</span>
          </div>
          <div class="vol-dep-route text-xs"><span class="text-muted">From:</span> ${escapeHTML(dep.currentZone)} → <strong>${escapeHTML(dep.targetZone)}</strong></div>
          <div class="vol-dep-task text-xs">${escapeHTML(dep.task)} · ETA ${escapeHTML(dep.eta || '?')}</div>
          <div class="vol-dep-reason text-xs text-muted">${escapeHTML(dep.reason)}</div>`;
        container.appendChild(el);
    });

    safeText('vol-deploy-summary', plan.summary || '');
    addOrgLog(`Volunteer deployment plan generated (${plan.urgentCount || 0} urgent)`);
}

function renderVolunteerStatus() {
    const container = document.getElementById('vol-status-list');
    if (!container) return;
    container.innerHTML = '';
    const vols = contextEngine.getLiveState().volunteers;
    Object.values(vols).forEach(vol => {
        const avail = vol.available;
        const el = document.createElement('div');
        el.className = 'vol-status-row';
        el.innerHTML = `
          <div class="vol-status-name">${escapeHTML(vol.name)}</div>
          <div class="vol-status-zone text-xs text-muted">${escapeHTML(vol.zone)}</div>
          <div class="vol-status-avail text-xs" style="color:${avail > 2 ? 'var(--success)' : 'var(--warning)'}">
            ${avail} available / ${vol.count} total
          </div>`;
        container.appendChild(el);
    });
}

// ─── Eco Metrics ─────────────────────────────────────────────────────────────
function renderEcoMetrics() {
    const s = contextEngine.getLiveState().sustainability;
    safeText('eco-co2',      `${s.carbonSaved.toLocaleString()} kg`);
    safeText('eco-transit',  `${s.publicTransportPct}%`);
    safeText('eco-water',    s.waterRefillCount.toLocaleString());
    safeText('eco-recycle',  `${s.recyclingRate}%`);
    safeText('eco-solar',    `${s.solarPowerPct}%`);
    safeText('eco-score',    `${Math.round(s.ecoScore)}/100`);
}

// ─── Digital Twin SVG ─────────────────────────────────────────────────────────
function updateDigitalTwin() {
    const state = contextEngine.getLiveState();
    // Update gate indicator dots on SVG if they exist
    Object.values(state.gates).forEach(gate => {
        const dot = document.getElementById(`twin-gate-${gate.id}`);
        if (dot) {
            dot.style.fill = crowdColor(gate.crowdLevel);
            dot.setAttribute('r', gate.crowdLevel > 75 ? '8' : '6');
        }
    });
    // Update zone overlays
    Object.values(state.zones).forEach(zone => {
        const overlay = document.getElementById(`twin-zone-${zone.id}`);
        if (overlay) {
            const opacity = Math.max(0.1, zone.density / 200);
            overlay.style.opacity = String(opacity);
            overlay.style.fill = zone.density > 75 ? 'var(--danger)' : zone.density > 50 ? 'var(--warning)' : 'var(--success)';
        }
    });
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
function renderOrgAlerts() {
    const container = document.getElementById('org-alerts-list');
    if (!container) return;
    const alerts = contextEngine.getLiveState().alerts;
    container.innerHTML = '';
    alerts.slice(0, 6).forEach(a => {
        const el = document.createElement('div');
        el.className = `alert-item ${a.type}`;
        el.innerHTML = `<div class="alert-dot ${a.type}"></div><div style="flex:1"><div style="font-size:0.82rem">${escapeHTML(a.message)}</div><div class="text-xs text-muted">${a.time} · ${a.category || 'general'}</div></div>`;
        container.appendChild(el);
    });
}

// ─── Incident Log ─────────────────────────────────────────────────────────────
function renderIncidentLog() {
    const container = document.getElementById('org-incidents');
    if (!container) return;
    const incidents = contextEngine.getIncidents();
    if (!incidents.length) { container.innerHTML = '<div class="text-muted text-xs">No active incidents</div>'; return; }
    container.innerHTML = '';
    incidents.forEach(inc => {
        const el = document.createElement('div');
        el.className = `incident-item severity-${inc.severity}`;
        el.innerHTML = `<div class="incident-type">${escapeHTML(capitalize(inc.type))}</div><div class="incident-loc text-xs text-muted">${escapeHTML(inc.location)}</div><div class="incident-desc text-xs">${escapeHTML(inc.description)}</div>`;
        container.appendChild(el);
    });
}

// ─── Emergency & Broadcast ───────────────────────────────────────────────────
async function orgTriggerEmergency() {
    contextEngine.triggerEmergency('evacuation');
    addOrgLog('⚠️ EMERGENCY ACTIVATED by Organizer — Evacuation protocol initiated');
    // Re-load AI summary with emergency context
    loadOrgAISummary();
}

function orgBroadcast() {
    const input = document.getElementById('org-broadcast-input');
    const msg = input?.value?.trim();
    if (!msg) return;
    addOrgLog(`📢 Broadcast sent: "${msg}"`);
    contextEngine.addNotification({ title: '📢 Stadium Broadcast', body: msg, type: 'info', category: 'broadcast' });
    if (input) input.value = '';
}

// ─── Ops Log ─────────────────────────────────────────────────────────────────
function addOrgLog(msg) {
    const log = document.getElementById('org-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'org-log-row text-xs';
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    row.innerHTML = `<span class="org-log-time text-muted">${time}</span> ${escapeHTML(msg)}`;
    log.prepend(row);
    if (log.children.length > 50) log.removeChild(log.lastChild);
}
