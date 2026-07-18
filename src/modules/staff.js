/**
 * src/modules/staff.js
 * StadiumFlow AI — Staff Operations Module
 *
 * Gate control, facility alerts, shift handover, live status monitoring
 * for stadium staff and security personnel at MetLife Stadium.
 */

import { contextEngine } from '../services/contextEngine.js';
import { geminiService  } from '../services/ai.js';
import { escapeHTML, safeText, capitalize, crowdColor } from '../utils/dom.js';
import { formatTimeLocal } from '../utils/time.js';

let _pollId = null;

export default function initStaffApp() {
    bindStaffControls();
    renderStaffGates();
    renderStaffAlerts();
    renderShiftInfo();
    renderFacilityStatus();
    renderStaffMedical();
    renderTransportStatus();

    _pollId = setInterval(() => {
        renderStaffGates();
        renderTransportStatus();
    }, 6000);

    console.log('[StaffApp] Initialized.');
}

export function destroyStaffApp() {
    if (_pollId) clearInterval(_pollId);
}

// ─── Controls ────────────────────────────────────────────────────────────────
function bindStaffControls() {
    document.getElementById('btn-staff-emergency')?.addEventListener('click', staffEmergencyProtocol);
    document.getElementById('btn-broadcast-staff')?.addEventListener('click', broadcastStaff);
    document.getElementById('btn-staff-refresh')?.addEventListener('click', () => {
        renderStaffGates();
        renderStaffAlerts();
    });
    document.getElementById('btn-add-incident')?.addEventListener('click', staffAddIncident);
}

// ─── Gate Control Panel ───────────────────────────────────────────────────────
function renderStaffGates() {
    const container = document.getElementById('staff-gates');
    if (!container) return;
    container.innerHTML = '';
    const state = contextEngine.getLiveState();
    Object.values(state.gates).forEach(gate => {
        const isOpen      = gate.status === 'open';
        const isCritical  = gate.crowdLevel > 80;
        const el = document.createElement('div');
        el.className = `staff-gate-row ${isCritical ? 'gate-critical' : ''}`;
        el.innerHTML = `
          <div class="staff-gate-info">
            <div class="staff-gate-name">${escapeHTML(gate.name)} <span class="text-muted text-xs">— ${escapeHTML(gate.label)}</span></div>
            <div class="staff-gate-stats text-xs">
              <span style="color:${crowdColor(gate.crowdLevel)}">${gate.crowdLevel.toFixed(0)}% full</span>
              <span class="text-muted">· ${gate.avgWait}min wait · ${gate.lanes} lanes · ${gate.accessibleLanes} accessible</span>
            </div>
            ${isCritical ? '<div class="text-danger text-xs">⚠️ Above threshold — consider overflow action</div>' : ''}
          </div>
          <div class="staff-gate-controls">
            <button class="staff-toggle-btn ${isOpen ? 'btn-gate-open' : 'btn-gate-closed'}" data-gateid="${escapeHTML(gate.id)}" aria-label="${isOpen ? 'Close' : 'Open'} ${escapeHTML(gate.name)}">
              ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}
            </button>
          </div>`;
        el.querySelector('.staff-toggle-btn')?.addEventListener('click', e => {
            const newStatus = contextEngine.toggleGate(e.target.dataset.gateid);
            addStaffLog(`${gate.name} → ${newStatus.toUpperCase()}`);
            renderStaffGates();
        });
        container.appendChild(el);
    });
}

// ─── Live Alerts ─────────────────────────────────────────────────────────────
function renderStaffAlerts() {
    const container = document.getElementById('staff-alerts');
    if (!container) return;
    container.innerHTML = '';
    const alerts = contextEngine.getLiveState().alerts;
    alerts.slice(0, 6).forEach(a => {
        const el = document.createElement('div');
        el.className = `staff-alert-row type-${a.type}`;
        el.innerHTML = `
          <div class="staff-alert-dot type-${a.type}"></div>
          <div class="staff-alert-content">
            <div class="staff-alert-msg text-xs">${escapeHTML(a.message)}</div>
            <div class="staff-alert-meta text-xs text-muted">${a.time} · ${a.category || 'ops'}</div>
          </div>
          <button class="btn btn-xs" aria-label="Acknowledge alert" onclick="this.parentElement.style.opacity='0.5'">Ack</button>`;
        container.appendChild(el);
    });
}

// ─── Shift Info ──────────────────────────────────────────────────────────────
function renderShiftInfo() {
    safeText('staff-shift-date',  'July 14, 2026');
    safeText('staff-shift-time',  'Shift A: 14:00 – 22:30 ET');
    safeText('staff-shift-venue', 'MetLife Stadium, East Rutherford NJ');
    safeText('staff-shift-role',  'Gate Operations & Security Supervisor');
    safeText('staff-shift-super', 'Supervisor: Michael Torres, ext. 201');
    safeText('staff-gate-assignment', 'Gates A, B, C — Northeast Sector');

    // Handover notes
    const handoverEl = document.getElementById('staff-handover-notes');
    if (handoverEl) handoverEl.textContent = 'Prior shift handover: Gate A was at 85% during opening rush — supplementary lane 7 was opened at 17:45. Coach USA shuttle is running ~12 min late. Lost-item report (Samsung phone, Section 141) in progress. Medical station at Gate B has full staff. First match for new security lead at Gate J.';
}

// ─── Facility Status ──────────────────────────────────────────────────────────
function renderFacilityStatus() {
    const facilities = [
        { name: 'Gate A Entry Scanners',    status: 'ok',      note: '6/6 lanes operational' },
        { name: 'Gate B Entry Scanners',    status: 'ok',      note: '10/10 lanes operational' },
        { name: 'Gate D Entry Scanners',    status: 'warning', note: 'Lane 3 experiencing intermittent scan failures — tech notified' },
        { name: 'Gate J VIP Scanner',       status: 'ok',      note: '4/4 lanes, dedicated security screening operational' },
        { name: 'North Concourse Lights',   status: 'ok',      note: 'All operational' },
        { name: 'South Plaza LED Board',    status: 'warning', note: 'Panel 3 offline — maintenance dispatched' },
        { name: 'Gate B Elevator (Sec 118)',status: 'ok',      note: 'Operational — accessible route' },
        { name: 'Emergency Lighting',       status: 'ok',      note: 'Tested and verified pre-match' },
        { name: 'PA System — All Sectors',  status: 'ok',      note: 'Tested — FIFA broadcast levels set' },
        { name: 'Wi-Fi Network (Stadium)',  status: 'ok',      note: 'All access points live · Peak load ~34%' },
        { name: 'CCTV — North Sector',      status: 'ok',      note: '24/24 cameras online' },
        { name: 'CCTV — South Sector',      status: 'warning', note: 'Camera SV-14 (Section 142) offline — maintenance en route' },
    ];

    const container = document.getElementById('staff-facility');
    if (!container) return;
    container.innerHTML = '';
    facilities.forEach(f => {
        const statusEmoji = f.status === 'ok' ? '🟢' : f.status === 'warning' ? '🟡' : '🔴';
        const el = document.createElement('div');
        el.className = 'facility-row';
        el.innerHTML = `
          <div class="facility-name text-xs">${statusEmoji} ${escapeHTML(f.name)}</div>
          <div class="facility-note text-xs text-muted">${escapeHTML(f.note)}</div>`;
        container.appendChild(el);
    });
}

// ─── Medical Station Status ───────────────────────────────────────────────────
function renderStaffMedical() {
    const container = document.getElementById('staff-medical');
    if (!container) return;
    container.innerHTML = '';
    const medical = contextEngine.getLiveState().medical;
    Object.values(medical).forEach(station => {
        const el = document.createElement('div');
        el.className = `medical-station-row ${station.available ? 'available' : 'unavailable'}`;
        el.innerHTML = `
          <div>
            <div class="text-xs">${station.available ? '🟢' : '🔴'} ${escapeHTML(station.name)}</div>
            <div class="text-xs text-muted">${escapeHTML(station.location)} · Staff: ${station.staff} · Physicians: ${station.physicians}</div>
          </div>
          <div class="text-xs text-right">${station.aed ? '⚡ AED' : ''}</div>`;
        container.appendChild(el);
    });
}

// ─── Transport Status ─────────────────────────────────────────────────────────
function renderTransportStatus() {
    const container = document.getElementById('staff-transport');
    if (!container) return;
    container.innerHTML = '';
    const transport = contextEngine.getLiveState().transport;
    const iconMap = { rail: '🚆', bus: '🚌', shuttle: '🚐', rideshare: '🚗' };
    Object.values(transport).forEach(t => {
        const statusClass = t.status?.toLowerCase().includes('time') ? 'status-ok' : t.status?.toLowerCase().includes('delay') ? 'status-warning' : 'status-info';
        const el = document.createElement('div');
        el.className = 'transport-status-row';
        el.innerHTML = `
          <div class="text-xs">${iconMap[t.type] || '🚌'} ${escapeHTML(t.name)}</div>
          <div class="text-xs text-muted">Next: ${t.nextArrival || t.eta || '—'} · Crowding: ${escapeHTML(t.crowding || 'N/A')}</div>
          <div class="text-xs ${statusClass}">${escapeHTML(t.status)}</div>
          ${t.delayReason ? `<div class="text-xs text-danger">${escapeHTML(t.delayReason)}</div>` : ''}`;
        container.appendChild(el);
    });
}

// ─── Emergency Protocol ──────────────────────────────────────────────────────
async function staffEmergencyProtocol() {
    const type = 'evacuation';
    contextEngine.triggerEmergency(type);
    addStaffLog('⚠️ EMERGENCY PROTOCOL ACTIVATED — All staff to emergency positions');

    const broadcastEl = document.getElementById('staff-emergency-broadcast');
    if (broadcastEl) {
        const ctx  = contextEngine.getSnapshot();
        const plan = await geminiService.generateEmergencyPlan(type, ctx);
        broadcastEl.textContent = plan?.broadcastMessage || '⚠️ ATTENTION: Emergency protocol activated. Follow staff instructions.';
        broadcastEl.parentElement?.classList.remove('hidden');
    }
}

// ─── Broadcast ───────────────────────────────────────────────────────────────
function broadcastStaff() {
    const input = document.getElementById('staff-broadcast-input');
    const msg   = input?.value?.trim();
    if (!msg) return;
    contextEngine.addNotification({ title: '📢 Staff Broadcast', body: msg, type: 'info', category: 'staff' });
    addStaffLog(`Broadcast: "${msg}"`);
    if (input) input.value = '';
}

// ─── Incident Reporting ───────────────────────────────────────────────────────
function staffAddIncident() {
    const typeEl = document.getElementById('staff-inc-type');
    const locEl  = document.getElementById('staff-inc-location');
    const descEl = document.getElementById('staff-inc-desc');
    const type   = typeEl?.value || 'general';
    const loc    = locEl?.value?.trim() || 'Unknown location';
    const desc   = descEl?.value?.trim() || 'Incident reported';

    const id = contextEngine.addIncident({ type, location: loc, description: desc, severity: 'medium' });
    addStaffLog(`Incident filed: ${desc} at ${loc} [ID: ${id}]`);
    if (typeEl)  typeEl.value  = 'general';
    if (locEl)   locEl.value  = '';
    if (descEl)  descEl.value = '';
}

// ─── Staff Ops Log ────────────────────────────────────────────────────────────
function addStaffLog(msg) {
    const log = document.getElementById('staff-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'staff-log-row text-xs';
    row.innerHTML = `<span class="text-muted">${formatTimeLocal()}</span> ${escapeHTML(msg)}`;
    log.prepend(row);
    if (log.children.length > 30) log.removeChild(log.lastChild);
}
