/**
 * src/modules/volunteer.js
 * StadiumFlow AI — Volunteer Hub Module
 *
 * Task management, zone assignments, AI-powered incident dispatch,
 * and fan assist request handling for stadium volunteers.
 */

import { contextEngine } from '../services/contextEngine.js';
import { geminiService  } from '../services/ai.js';
import { escapeHTML, safeText, capitalize } from '../utils/dom.js';
import { formatTimeLocal } from '../utils/time.js';

let activeTask   = null;
let _pollId      = null;
let _taskIdCounter = 1;

export default function initVolunteerApp() {
    bindVolunteerControls();
    renderVolunteerProfile();
    renderMyZone();
    renderPriorityTasks();
    renderFanRequests();
    loadAIDispatch();
    renderIncidentFeed();

    _pollId = setInterval(() => {
        renderPriorityTasks();
        renderIncidentFeed();
    }, 8000);

    console.log('[VolunteerApp] Initialized.');
}

export function destroyVolunteerApp() {
    if (_pollId) clearInterval(_pollId);
}

// ─── Volunteer Profile Card ──────────────────────────────────────────────────
function renderVolunteerProfile() {
    const state = contextEngine.getLiveState();
    // Pick a volunteer team (default Team Alpha for demo)
    const myTeam = state.volunteers.alpha_north;
    if (!myTeam) return;
    safeText('vol-team-name',   myTeam.name);
    safeText('vol-team-zone',   myTeam.zone);
    safeText('vol-team-leader', `Leader: ${myTeam.leader}`);
    safeText('vol-team-radio',  `Radio: ${myTeam.radio}`);
    safeText('vol-avail',       `${myTeam.available} volunteers available`);
}

// ─── My Zone Crowd Status ───────────────────────────────────────────────────
function renderMyZone() {
    const state = contextEngine.getLiveState();
    const zone  = state.zones.zone_100_north;
    if (!zone) return;
    const densityEl = document.getElementById('vol-zone-density');
    if (densityEl) {
        densityEl.textContent = `${zone.density.toFixed(0)}%`;
        densityEl.style.color = zone.density > 75 ? 'var(--danger)' : zone.density > 50 ? 'var(--warning)' : 'var(--success)';
    }
    safeText('vol-zone-trend', `${capitalize(zone.trend)} · North Concourse`);

    const bar = document.getElementById('vol-zone-bar');
    if (bar) bar.style.width = `${zone.density.toFixed(0)}%`;
}

// ─── Priority Tasks ───────────────────────────────────────────────────────────
const TASK_TEMPLATES = [
    { icon: '🚨', title: 'Crowd Management', desc: 'North Concourse over capacity — redirect fans to South Concourse via Section 128 corridor', zone: 'North Concourse', priority: 'urgent', type: 'crowd' },
    { icon: '♿', title: 'Accessibility Assist', desc: 'Fan requesting wheelchair push from Gate B to Section 118 — Team Beta unavailable', zone: 'Gate B → Section 118', priority: 'high', type: 'accessibility' },
    { icon: '🚪', title: 'Gate Overflow Support', desc: 'Gate A at 82% — support entry lane officer and redirect overflow to Gate B and C', zone: 'Gate A', priority: 'high', type: 'gate' },
    { icon: '🌐', title: 'Translation Needed', desc: 'International fans at Gate F need Spanish-speaking assistance', zone: 'Gate F', priority: 'medium', type: 'translation' },
    { icon: '🔎', title: 'Lost Child Report', desc: 'Lost child (approx. age 7, yellow jersey) near Shake Shack Section 119 — reunite with parents', zone: 'Section 119', priority: 'urgent', type: 'lost-child' },
    { icon: '🍔', title: 'Queue Management', desc: 'FIFA World Cup Grill queue backing into corridor — set up queue barriers', zone: 'Gate F Food Court', priority: 'medium', type: 'food' },
];

function renderPriorityTasks() {
    const container = document.getElementById('vol-tasks-list');
    if (!container) return;
    container.innerHTML = '';

    TASK_TEMPLATES.forEach((task, i) => {
        const priorityColor = task.priority === 'urgent' ? 'var(--danger)' : task.priority === 'high' ? 'var(--warning)' : 'var(--success)';
        const el = document.createElement('div');
        el.className = `vol-task-card priority-${task.priority}`;
        el.style.animationDelay = `${i * 0.05}s`;
        el.innerHTML = `
          <div class="vol-task-icon">${task.icon}</div>
          <div class="vol-task-content">
            <div class="vol-task-title">${escapeHTML(task.title)} <span class="vol-priority-badge" style="color:${priorityColor};font-size:0.7rem">${capitalize(task.priority)}</span></div>
            <div class="vol-task-desc text-xs text-muted">${escapeHTML(task.desc)}</div>
            <div class="vol-task-zone text-xs">📍 ${escapeHTML(task.zone)}</div>
          </div>
          <div class="vol-task-actions">
            <button class="btn btn-xs btn-accept" aria-label="Accept task: ${escapeHTML(task.title)}">Accept</button>
            <button class="btn btn-xs btn-skip" aria-label="Skip task: ${escapeHTML(task.title)}">Skip</button>
          </div>`;
        el.querySelector('.btn-accept')?.addEventListener('click', () => acceptTask(task, el));
        el.querySelector('.btn-skip')?.addEventListener('click',  () => el.remove());
        container.appendChild(el);
    });
}

function acceptTask(task, el) {
    activeTask = task;
    el.classList.add('task-accepted');
    const actionsDiv = el.querySelector('.vol-task-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = '<span class="text-success text-xs">✅ Accepted</span>';
    }
    safeText('active-task-title', task.title);
    safeText('active-task-zone',  `📍 ${task.zone}`);
    safeText('active-task-desc',  task.desc);

    const activeCard = document.getElementById('vol-active-task');
    activeCard?.classList.remove('hidden');
    document.getElementById('btn-complete-task')?.addEventListener('click', completeActiveTask);
}

function completeActiveTask() {
    const activeCard = document.getElementById('vol-active-task');
    activeCard?.classList.add('hidden');
    activeTask = null;
    appendToFeed({ type: 'info', message: 'Task completed by your volunteer', time: formatTimeLocal() });
}

// ─── Fan Assist Requests ─────────────────────────────────────────────────────
const FAN_REQUESTS = [
    { id: 'fr1', type: 'navigation', message: 'Need help finding Section 118 from Gate B', gate: 'Gate B', urgency: 'medium' },
    { id: 'fr2', type: 'medical',    message: 'Fan feeling dizzy near Section 132 food court', gate: 'Gate F', urgency: 'high' },
    { id: 'fr3', type: 'lost-item', message: 'Lost phone — Samsung Galaxy S24, black case, Section 141', gate: 'Gate G', urgency: 'low' },
];

function renderFanRequests() {
    const container = document.getElementById('vol-fan-requests');
    if (!container) return;
    container.innerHTML = '';
    const iconMap = { navigation: '🧭', medical: '🚑', 'lost-item': '🔍', translation: '🌐', accessibility: '♿' };
    FAN_REQUESTS.forEach(req => {
        const urgencyColor = req.urgency === 'high' ? 'var(--danger)' : req.urgency === 'medium' ? 'var(--warning)' : 'var(--text-muted)';
        const el = document.createElement('div');
        el.className = 'fan-request-card';
        el.innerHTML = `
          <div class="fan-req-icon">${iconMap[req.type] || '📋'}</div>
          <div class="fan-req-content">
            <div class="fan-req-msg text-xs">${escapeHTML(req.message)}</div>
            <div class="fan-req-loc text-xs text-muted">📍 ${escapeHTML(req.gate)}</div>
          </div>
          <div>
            <span style="color:${urgencyColor};font-size:0.7rem;font-weight:600">${capitalize(req.urgency)}</span>
            <button class="btn btn-xs mt-xs" aria-label="Respond to request">Respond</button>
          </div>`;
        el.querySelector('button')?.addEventListener('click', () => {
            appendToFeed({ type: 'success', message: `Responding to fan request: ${req.message}`, time: formatTimeLocal() });
            el.remove();
        });
        container.appendChild(el);
    });
}

// ─── AI Dispatch ─────────────────────────────────────────────────────────────
async function loadAIDispatch() {
    const container = document.getElementById('vol-ai-dispatch');
    if (container) container.innerHTML = '<div class="text-xs text-muted">Generating AI deployment plan...</div>';

    const ctx  = contextEngine.getSnapshot();
    const plan = await geminiService.recommendVolunteerDeployment(ctx);
    if (!plan || !container) return;

    container.innerHTML = '';
    (plan.deployments || []).slice(0, 3).forEach(dep => {
        const priorityColor = dep.priority === 'high' ? 'var(--danger)' : dep.priority === 'medium' ? 'var(--warning)' : 'var(--success)';
        const el = document.createElement('div');
        el.className = 'vol-dispatch-item';
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="vol-dispatch-team">${escapeHTML(dep.team)}</span>
            <span style="color:${priorityColor};font-size:0.7rem">${capitalize(dep.priority)}</span>
          </div>
          <div class="vol-dispatch-route text-xs">${escapeHTML(dep.currentZone)} → <strong>${escapeHTML(dep.targetZone)}</strong></div>
          <div class="vol-dispatch-reason text-xs text-muted">${escapeHTML(dep.reason)}</div>`;
        container.appendChild(el);
    });
    appendToFeed({ type: 'info', message: `AI Dispatch plan updated — ${plan.urgentCount || 0} urgent deployments`, time: formatTimeLocal() });
}

// ─── Incident Feed ────────────────────────────────────────────────────────────
const INITIAL_FEED = [
    { type: 'info',    message: 'Gate A supplementary lanes opened — overflow control initiated',     time: '18:55' },
    { type: 'warning', message: 'Coach USA shuttle delayed — Delta team repositioning to Gate E',     time: '18:48' },
    { type: 'success', message: 'Lost child reunited with family near Section 119 (Team Alpha)',      time: '18:42' },
    { type: 'info',    message: 'FIFA Fan Zone at 88% — Eta team managing queue',                     time: '18:35' },
];

function renderIncidentFeed() {
    const container = document.getElementById('vol-incident-feed');
    if (!container || container.children.length > 0) return; // only init once
    INITIAL_FEED.forEach(item => appendToFeed(item, container));
}

function appendToFeed(item, container) {
    const feed = container || document.getElementById('vol-incident-feed');
    if (!feed) return;
    const el = document.createElement('div');
    el.className = `feed-item ${item.type}`;
    el.innerHTML = `<div class="feed-dot ${item.type}"></div><div style="flex:1"><div class="text-xs">${escapeHTML(item.message)}</div><div class="text-xs text-muted">${item.time}</div></div>`;
    feed.prepend(el);
    if (feed.children.length > 20) feed.removeChild(feed.lastChild);
}

// ─── Controls ────────────────────────────────────────────────────────────────
function bindVolunteerControls() {
    document.getElementById('btn-complete-task')?.addEventListener('click', completeActiveTask);
    document.getElementById('btn-vol-refresh')?.addEventListener('click', () => {
        renderPriorityTasks();
        loadAIDispatch();
    });
    document.getElementById('btn-report-incident')?.addEventListener('click', reportIncident);
}

function reportIncident() {
    const type = (document.getElementById('incident-type-input')?.value || '').trim() || 'general';
    const loc  = (document.getElementById('incident-loc-input')?.value || '').trim() || 'Stadium';
    const desc = (document.getElementById('incident-desc-input')?.value || '').trim() || 'Incident reported';
    contextEngine.addIncident({ type, location: loc, description: desc, severity: 'medium' });
    appendToFeed({ type: 'warning', message: `Incident reported: ${desc} at ${loc}`, time: formatTimeLocal() });

    // Clear inputs
    ['incident-type-input', 'incident-loc-input', 'incident-desc-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}
