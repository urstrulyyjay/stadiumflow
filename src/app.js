/**
 * src/app.js
 * StadiumFlow AI — Application Bootstrapper
 *
 * Lean root controller. Handles:
 *  - Global init (contextEngine, simulation, auth)
 *  - Role selector UI
 *  - Lazy-loading role modules on demand
 *  - Global emergency overlay
 *  - Page Visibility API to pause simulation when tab hidden
 *  - Proactive AI polling (role-agnostic)
 *  - Notification badge management
 *
 * All role-specific UI logic lives in:
 *   src/modules/fan.js | organizer.js | volunteer.js | staff.js
 */

import { contextEngine }            from './services/contextEngine.js';
import { stopSimulation }           from './services/simulation.js';
import { watchAuthState, logout }   from './services/auth.js';
import { updateNavBadge }           from './utils/dom.js';
import { MATCH }                    from './data/match_schedule.js';

// ─── Global State ─────────────────────────────────────────────────────────────
let currentRole    = null;
let activeModule   = null;   // { destroy: fn } from current role module
let _notifPollId   = null;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
contextEngine.init();
console.log('[StadiumFlow AI] Context engine initialized. MetLife Stadium data loaded.');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    bindRoleSelector();
    bindGlobalEmergency();
    initPageVisibility();
    initAuthState();
    renderMatchScoreboard();

    // Notification badge polling
    _notifPollId = setInterval(syncNotificationBadges, 10_000);

    console.log('[StadiumFlow AI] Ready — FIFA World Cup 2026 | MetLife Stadium | NJ');
}

// ─── Match Scoreboard (global, shows on role selector) ─────────────────────
function renderMatchScoreboard() {
    const homeEl   = document.getElementById('score-home-name');
    const awayEl   = document.getElementById('score-away-name');
    const phaseEl  = document.getElementById('score-phase');

    if (homeEl) homeEl.innerHTML = `${MATCH.homeTeam.flag} ${MATCH.homeTeam.name}`;
    if (awayEl) awayEl.innerHTML = `${MATCH.awayTeam.flag} ${MATCH.awayTeam.name}`;
    if (phaseEl) phaseEl.textContent = contextEngine.getMatch().currentPhase;
}

// ─── Role Selector ─────────────────────────────────────────────────────────────
function bindRoleSelector() {
    document.getElementById('btn-role-fan')?.addEventListener('click',       () => enterRole('fan'));
    document.getElementById('btn-role-organizer')?.addEventListener('click', () => enterRole('organizer'));
    document.getElementById('btn-role-volunteer')?.addEventListener('click', () => enterRole('volunteer'));
    document.getElementById('btn-role-staff')?.addEventListener('click',     () => enterRole('staff'));

    // Back/exit buttons for each role app
    document.getElementById('btn-fan-back')?.addEventListener('click',   exitToRoleSelector);
    document.getElementById('btn-org-back')?.addEventListener('click',   exitToRoleSelector);
    document.getElementById('btn-vol-back')?.addEventListener('click',   exitToRoleSelector);
    document.getElementById('btn-staff-back')?.addEventListener('click', exitToRoleSelector);
}

async function enterRole(role) {
    currentRole = role;
    contextEngine.setRole(role);

    // Hide role selector
    const selectorEl = document.getElementById('role-selector');
    if (selectorEl) {
        selectorEl.classList.add('hidden');
        selectorEl.setAttribute('aria-hidden', 'true');
    }

    // Show role-specific app shell
    const appIds = { fan: 'fan-app', organizer: 'organizer-app', volunteer: 'volunteer-app', staff: 'staff-app' };
    Object.entries(appIds).forEach(([r, id]) => {
        const el = document.getElementById(id);
        if (el) {
            const isHidden = r !== role;
            el.classList.toggle('hidden', isHidden);
            if (isHidden) {
                el.setAttribute('aria-hidden', 'true');
            } else {
                el.removeAttribute('aria-hidden');
            }
        }
    });

    // Destroy any currently active module
    if (activeModule?.destroy) activeModule.destroy();
    activeModule = null;

    // Lazy-load the role module
    try {
        const modules = {
            fan:       () => import('./modules/fan.js'),
            organizer: () => import('./modules/organizer.js'),
            volunteer: () => import('./modules/volunteer.js'),
            staff:     () => import('./modules/staff.js'),
        };
        const { default: initModule, destroyFanApp, destroyOrganizerApp, destroyVolunteerApp, destroyStaffApp } = await modules[role]();

        initModule();

        // Store destroy fn per role
        const destroyFns = { fan: destroyFanApp, organizer: destroyOrganizerApp, volunteer: destroyVolunteerApp, staff: destroyStaffApp };
        activeModule = { destroy: destroyFns[role] };

    } catch (err) {
        console.error('[StadiumFlow AI] Failed to load module:', role, err);
    }

    console.log(`[StadiumFlow AI] Role: ${role}`);
}

function exitToRoleSelector() {
    // Destroy current module cleanly
    if (activeModule?.destroy) activeModule.destroy();
    activeModule = null;

    // Hide all apps
    ['fan-app', 'organizer-app', 'volunteer-app', 'staff-app'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
        }
    });

    // Show role selector
    const selectorEl = document.getElementById('role-selector');
    if (selectorEl) {
        selectorEl.classList.remove('hidden');
        selectorEl.removeAttribute('aria-hidden');
    }

    // Clear emergency if active
    contextEngine.clearEmergency();
    document.getElementById('emergency-overlay')?.style.setProperty('display', 'none');
    document.getElementById('emergency-border')?.classList.add('hidden');

    currentRole = null;
}

// ─── Global Emergency (accessible from all roles) ────────────────────────────
function bindGlobalEmergency() {
    document.getElementById('btn-global-sos')?.addEventListener('click', () => {
        contextEngine.triggerEmergency('evacuation');
        const { showGlobalEmergencyOverlay } = activeModule || {};
        if (typeof showGlobalEmergencyOverlay === 'function') {
            showGlobalEmergencyOverlay('evacuation');
        } else {
            // Inline fallback
            const overlay = document.getElementById('emergency-overlay');
            if (overlay) {
                overlay.innerHTML = `<div class="emergency-sos-header"><div class="emergency-sos-label">🚨 EMERGENCY</div><div class="emergency-sos-title">Move to nearest open gate</div><div class="emergency-sos-sub">Follow orange signs · Do not use elevators</div><div class="emergency-sos-number">📞 Call 911</div><button class="btn btn-sm mt-md" id="btn-clear-emrg" style="background:rgba(255,255,255,0.2);border:1px solid white;color:white;">Clear</button></div>`;
                overlay.style.display = 'flex';
                document.getElementById('emergency-border')?.classList.remove('hidden');
                document.getElementById('btn-clear-emrg')?.addEventListener('click', () => {
                    overlay.style.display = 'none';
                    document.getElementById('emergency-border')?.classList.add('hidden');
                    contextEngine.clearEmergency();
                });
            }
        }
    });
}

// ─── Notification Badges ──────────────────────────────────────────────────────
function syncNotificationBadges() {
    const count = contextEngine.getUnreadCount();
    updateNavBadge('badge-home', count > 0 ? count : 0);
}

// ─── Page Visibility API — pause simulation when tab hidden ──────────────────
function initPageVisibility() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('[StadiumFlow AI] Tab hidden — simulation paused.');
            stopSimulation();
        } else {
            console.log('[StadiumFlow AI] Tab visible — simulation resumed.');
            // Restart simulation
            contextEngine.init();
        }
    });
}

// ─── Auth State ──────────────────────────────────────────────────────────────
function initAuthState() {
    try {
        watchAuthState(user => {
            const badge = document.getElementById('auth-status-badge');
            if (badge) badge.textContent = user ? '🔐 Signed In' : '';
        });
    } catch (e) {
        // Auth is optional — Firebase may not be configured
    }
}
