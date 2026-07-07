// src/app.js
// StadiumFlow AI — Main Application Controller
// Role-aware: Fan | Organizer | Volunteer | Staff
// All AI calls flow through contextEngine → ai.js (Gemini or graceful fallback)

import { contextEngine }   from './services/contextEngine.js';
import { geminiService }   from './services/ai.js';
import { watchAuthState, logout } from './services/auth.js';
import { stadiumState, onGatesUpdate, onFoodUpdate, toggleGateStatus } from './services/db.js';
import { stadiumData }     from './services/mock_data.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────
contextEngine.init();

// Seed db stadiumState from mock so existing service layer still works
Object.assign(stadiumState.gates,      stadiumData.gates);
Object.assign(stadiumState.foodQueues, stadiumData.food);
Object.assign(stadiumState.zones,      stadiumData.zones);

// ── State ────────────────────────────────────────────────────────────────────
let currentRole    = null;
let selectedDiet   = 'all';
let selectedLang   = 'en';
let chatDisabled   = false;
let navRouteType   = 'fastest';
let pollIntervalId = null;

// ── DOM Ready ─────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    bindRoleSelector();
    bindGlobalEmergency();
    console.log('[StadiumFlow AI] App initialized. Gemini AI ready.');
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE SELECTOR
// ═══════════════════════════════════════════════════════════════════════════
function bindRoleSelector() {
    document.getElementById('btn-role-fan')?.addEventListener('click',       () => enterRole('fan'));
    document.getElementById('btn-role-organizer')?.addEventListener('click', () => enterRole('organizer'));
    document.getElementById('btn-role-volunteer')?.addEventListener('click', () => enterRole('volunteer'));
    document.getElementById('btn-role-staff')?.addEventListener('click',     () => enterRole('staff'));

    // Back / exit buttons
    document.getElementById('btn-fan-back')?.addEventListener('click',  exitToRoleSelector);
    document.getElementById('btn-org-back')?.addEventListener('click',  exitToRoleSelector);
    document.getElementById('btn-vol-back')?.addEventListener('click',  exitToRoleSelector);
    document.getElementById('btn-staff-back')?.addEventListener('click', exitToRoleSelector);
}

function enterRole(role) {
    currentRole = role;
    contextEngine.setRole(role);
    contextEngine.updateUser({ role });

    document.getElementById('role-selector').classList.add('hidden');

    const appMap = { fan: 'fan-app', organizer: 'organizer-app', volunteer: 'volunteer-app', staff: 'staff-app' };
    document.getElementById(appMap[role])?.classList.remove('hidden');

    const initFns = { fan: initFanApp, organizer: initOrganizerApp, volunteer: initVolunteerApp, staff: initStaffApp };
    initFns[role]?.();

    // Live polling for UI re-renders
    if (pollIntervalId) clearInterval(pollIntervalId);
    pollIntervalId = setInterval(() => livePoll(role), 5000);
}

function exitToRoleSelector() {
    if (pollIntervalId) { clearInterval(pollIntervalId); pollIntervalId = null; }
    contextEngine.clearHistory();

    ['fan-app','organizer-app','volunteer-app','staff-app'].forEach(id =>
        document.getElementById(id)?.classList.add('hidden')
    );
    document.getElementById('role-selector').classList.remove('hidden');
    currentRole = null;
}

function livePoll(role) {
    if (role === 'fan') {
        if (activeTabIs('crowd'))    renderCrowdView();
        if (activeTabIs('food'))     renderFoodView();
        if (activeTabIs('home'))     updateHeroCard();
    } else if (role === 'organizer') {
        renderOrgGates();
        updateOrgKPIs();
        updateDigitalTwin();
    } else if (role === 'staff') {
        renderStaffZones();
        renderStaffGates();
    } else if (role === 'volunteer') {
        renderVolZones();
    }
}

function activeTabIs(tab) {
    return document.getElementById(`view-${tab}`)?.classList.contains('active');
}

// ═══════════════════════════════════════════════════════════════════════════
// FAN APP
// ═══════════════════════════════════════════════════════════════════════════
function initFanApp() {
    bindFanNav();
    bindChatInterface();
    bindNavigationView();
    bindFoodFilters();
    bindEmergencyView();
    bindHeaderEmergency();

    renderHomeView();
    renderHomeAlerts();
    renderHomeTransport();
    startKickoffCountdown();

    // Async AI home suggestion (non-blocking)
    setTimeout(loadAISuggestion, 600);
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
function bindFanNav() {
    document.querySelectorAll('#fan-app .nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchFanTab(btn.dataset.tab));
    });
    document.getElementById('btn-go-assistant')?.addEventListener('click', () => switchFanTab('assistant'));
    document.getElementById('btn-go-navigate')?.addEventListener('click',  () => switchFanTab('navigate'));
    document.getElementById('btn-go-crowd')?.addEventListener('click',     () => switchFanTab('crowd'));
}

function switchFanTab(tabId) {
    document.querySelectorAll('#fan-app .view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('#fan-app .nav-item').forEach(n => {
        n.classList.remove('active');
        n.setAttribute('aria-selected', 'false');
    });

    document.getElementById(`view-${tabId}`)?.classList.add('active');
    const activeBtn = document.querySelector(`#fan-app .nav-item[data-tab="${tabId}"]`);
    activeBtn?.classList.add('active');
    activeBtn?.setAttribute('aria-selected', 'true');

    const onActivate = {
        home:      () => { updateHeroCard(); renderHomeAlerts(); },
        assistant: () => { if (!chatHasMessages()) showWelcomeMessage(); },
        navigate:  () => {},
        crowd:     () => renderCrowdView(),
        food:      () => renderFoodView(),
        emergency: () => renderExitList(),
    };
    onActivate[tabId]?.();
    document.getElementById('fan-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── HOME VIEW ─────────────────────────────────────────────────────────────────
function renderHomeView() {
    updateHeroCard();
}

function updateHeroCard() {
    const state = contextEngine.getLiveState();
    const bestGate = contextEngine.getBestGate();
    const crowdLevel = contextEngine.getOverallCrowdLevel();
    const crowdLabel = crowdLevel > 75 ? 'High' : crowdLevel > 45 ? 'Medium' : 'Low';
    const crowdColor = crowdLevel > 75 ? 'var(--danger)' : crowdLevel > 45 ? 'var(--warning)' : 'var(--success)';

    safeText('hero-gate', bestGate ? bestGate.name : 'Gate B');
    safeText('hero-wait', bestGate ? `${bestGate.avgWait} min` : '4 min');
    const crowdEl = document.getElementById('hero-crowd');
    if (crowdEl) { crowdEl.textContent = crowdLabel; crowdEl.style.color = crowdColor; }

    // Weather
    const w = state.weather;
    safeText('home-weather', `${w.temp}°C ${w.condition}`);
    safeText('home-capacity', `${contextEngine.getMatch().attendance.toLocaleString()} / ${contextEngine.getMatch().capacity.toLocaleString()}`);

    // Header weather mini
    const wMini = document.getElementById('fan-weather-mini');
    if (wMini) wMini.innerHTML = `☁️ ${w.temp}°C`;
}

async function loadAISuggestion() {
    const ctx = contextEngine.getSnapshot();
    const box = document.getElementById('ai-suggestion-box');
    if (!box) return;

    // Show skeleton state
    document.getElementById('ai-suggestion-title').textContent = 'AI is analyzing your situation...';
    document.getElementById('ai-suggestion-body').textContent  = '';

    const bestGate = contextEngine.getBestGate();
    const fastFood = contextEngine.getFastestFood();

    // Build a quick local insight while Gemini processes
    const localTitle = `🚪 Use ${bestGate?.name || 'Gate B'} — ${bestGate?.avgWait || 4}min wait`;
    const localBody  = `🍔 ${fastFood?.name || 'Drinks Bar'} has the shortest food queue (${fastFood?.queueTime || 3} min). Save ~30 minutes with these suggestions.`;

    safeText('ai-suggestion-title', localTitle);
    safeText('ai-suggestion-body',  localBody);

    // Async: ask Gemini for a richer suggestion
    try {
        const result = await geminiService.chat(
            'Give me one key recommendation for entering the stadium efficiently right now.',
            ctx
        );
        if (result) {
            safeText('ai-suggestion-title', '⚡ Gemini AI Recommendation');
            safeText('ai-suggestion-body',  result);
        }
    } catch (e) { /* keep local fallback */ }
}

function renderHomeAlerts() {
    const container = document.getElementById('home-alerts');
    if (!container) return;
    container.innerHTML = '';
    const alerts = contextEngine.getLiveState().alerts || [];
    alerts.slice(0, 3).forEach(a => {
        const el = document.createElement('div');
        el.className = `alert-item ${a.type}`;
        el.innerHTML = `<div class="alert-dot ${a.type}"></div><div style="flex:1"><div style="font-size:0.82rem">${escapeHTML(a.message)}</div><div class="text-xs text-muted mt-xs">${a.time}</div></div>`;
        container.appendChild(el);
    });
}

function renderHomeTransport() {
    const container = document.getElementById('home-transport');
    if (!container) return;
    container.innerHTML = '';
    const icons = { subway1: '🚇', subway2: '🚆', bus1: '🚌', rideshare: '🚗' };
    const transport = contextEngine.getLiveState().transport;
    Object.entries(transport).slice(0, 3).forEach(([key, t]) => {
        const statusKey = (t.status || '').toLowerCase().replace(' ', '-');
        const statusClass = statusKey.includes('time') ? 'on-time' : statusKey.includes('delay') ? 'delayed' : 'busy';
        const el = document.createElement('div');
        el.className = 'transport-card';
        el.innerHTML = `
          <div class="transport-icon">${icons[key] || '🚌'}</div>
          <div class="transport-info">
            <div class="transport-name">${escapeHTML(t.name)}</div>
            <div class="transport-eta">${t.nextArrival ? `Next: ${t.nextArrival}` : t.eta || ''} · ${escapeHTML(t.crowding || t.dropoffPoint || '')}</div>
          </div>
          <span class="transport-status ${statusClass}">${escapeHTML(t.status)}</span>`;
        container.appendChild(el);
    });
}

function startKickoffCountdown() {
    function tick() {
        const match = contextEngine.getMatch();
        const mins = match.minutesUntilKickoff;
        const el = document.getElementById('kickoff-countdown');
        if (el) el.textContent = mins > 0 ? `${mins} min` : 'LIVE';
    }
    tick();
    setInterval(tick, 60000);
}

// ── CHAT INTERFACE ───────────────────────────────────────────────────────────
function bindChatInterface() {
    const input    = document.getElementById('chat-input');
    const sendBtn  = document.getElementById('chat-send-btn');
    const clearBtn = document.getElementById('chat-clear-btn');

    sendBtn?.addEventListener('click', sendChatMessage);
    clearBtn?.addEventListener('click', clearChat);

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
    input?.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // Suggested prompts
    document.querySelectorAll('.prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const inp = document.getElementById('chat-input');
            if (inp) { inp.value = chip.dataset.prompt; inp.focus(); }
        });
    });

    // Language selector
    document.querySelectorAll('.lang-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.lang-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedLang = chip.dataset.lang;
            contextEngine.setLanguage(selectedLang);
        });
    });
}

async function sendChatMessage() {
    if (chatDisabled) return;
    const input = document.getElementById('chat-input');
    const msg   = input?.value.trim();
    if (!msg) return;

    input.value = '';
    input.style.height = 'auto';

    appendChatMessage('user', msg);
    contextEngine.addToHistory('user', msg);

    chatDisabled = true;
    document.getElementById('chat-send-btn').disabled = true;
    showTypingIndicator();

    const ctx = contextEngine.getSnapshot();
    try {
        const reply = await geminiService.chat(msg, ctx);
        hideTypingIndicator();
        appendChatMessage('ai', reply || '🤖 I had trouble processing that. Please try again.');
        contextEngine.addToHistory('model', reply || '');
    } catch (e) {
        hideTypingIndicator();
        appendChatMessage('ai', '⚠️ Connection issue. Please check your network and try again.');
    }

    chatDisabled = false;
    document.getElementById('chat-send-btn').disabled = false;
    document.getElementById('chat-input')?.focus();
}

function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const wrap = document.createElement('div');
    wrap.className = `chat-bubble-wrap ${role}`;

    const avatar = document.createElement('div');
    avatar.className = `chat-avatar ${role}`;
    avatar.textContent = role === 'ai' ? '🤖' : '🙋';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    // Render markdown-like bold text (**text**)
    const rendered = escapeHTML(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    bubble.innerHTML = rendered;

    const time = document.createElement('div');
    time.className = 'chat-bubble-time';
    time.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    bubble.appendChild(time);

    if (role === 'ai') {
        const actionsRow = document.createElement('div');
        actionsRow.className = 'chat-bubble-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'chat-copy-btn';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(text).then(() => { copyBtn.textContent = '✓ Copied'; setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 1500); });
        });
        actionsRow.appendChild(copyBtn);
        bubble.appendChild(actionsRow);
    }

    wrap.appendChild(role === 'ai' ? avatar : bubble);
    wrap.appendChild(role === 'ai' ? bubble : avatar);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chat-messages');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = `
      <div class="chat-avatar ai">🤖</div>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    container?.appendChild(indicator);
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function hideTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
}

function clearChat() {
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    contextEngine.clearHistory();
    showWelcomeMessage();
}

function chatHasMessages() {
    return (document.getElementById('chat-messages')?.children.length || 0) > 0;
}

function showWelcomeMessage() {
    appendChatMessage('ai', `👋 Hi! I'm **StadiumFlow AI**, powered by Gemini. I can help you with navigation, food queues, translations, and anything about today's match — Brazil vs Germany! What do you need?`);
}

// ── NAVIGATION VIEW ───────────────────────────────────────────────────────────
function bindNavigationView() {
    document.querySelectorAll('#route-type-selector .route-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#route-type-selector .route-chip').forEach(c => {
                c.classList.remove('active');
                c.setAttribute('aria-pressed', 'false');
            });
            chip.classList.add('active');
            chip.setAttribute('aria-pressed', 'true');
            navRouteType = chip.dataset.route;
        });
    });

    document.getElementById('btn-get-route')?.addEventListener('click', getAIRoute);
}

async function getAIRoute() {
    const btn = document.getElementById('btn-get-route');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin-anim"></i> AI Planning Route...'; }

    const stepsCard = document.getElementById('nav-steps-card');
    if (stepsCard) stepsCard.innerHTML = '<div style="padding:1rem;text-align:center"><i class="fa-solid fa-spinner spin-anim" style="color:var(--primary)"></i></div>';

    const ctx = contextEngine.getSnapshot();
    const plan = await geminiService.generateNavigationPlan('Seat A-214', navRouteType, ctx);

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Get AI Navigation Plan'; }

    if (!plan) return;

    // Update ETA bar
    safeText('eta-time', plan.eta || '—');
    safeText('eta-dist', plan.distance || '—');
    safeText('eta-crowd', navRouteType === 'least-crowded' ? 'Low' : navRouteType === 'accessible' ? 'Acc.' : 'Med.');

    // Render steps
    if (stepsCard && plan.steps) {
        stepsCard.innerHTML = '';
        plan.steps.forEach((step, i) => {
            const div = document.createElement('div');
            div.className = 'nav-step';
            div.style.animationDelay = `${i * 0.07}s`;
            div.innerHTML = `<div class="nav-step-num">${i + 1}</div><div class="nav-step-text">${escapeHTML(step)}</div>`;
            stepsCard.appendChild(div);
        });
        if (plan.notes) {
            const note = document.createElement('div');
            note.className = 'text-xs text-muted p-sm';
            note.textContent = plan.notes;
            stepsCard.appendChild(note);
        }
    }

    // Update SVG route
    updateRouteSVG(navRouteType);
}

function updateRouteSVG(routeType) {
    const path = document.getElementById('route-svg-path');
    if (!path) return;
    const routes = {
        fastest:         'M 160,218 Q 160,170 148,95',
        'least-crowded': 'M 160,218 Q 80,180 148,95',
        accessible:      'M 160,218 Q 220,160 148,95',
        family:          'M 160,218 Q 200,190 148,95',
        emergency:       'M 160,218 L 160,27',
    };
    const colors = {
        fastest: 'var(--primary)', 'least-crowded': 'var(--success)',
        accessible: 'var(--secondary)', family: 'var(--warning)', emergency: 'var(--danger)'
    };
    path.setAttribute('d', routes[routeType] || routes.fastest);
    path.style.stroke = colors[routeType] || 'var(--primary)';
}

// ── CROWD VIEW ────────────────────────────────────────────────────────────────
async function renderCrowdView() {
    const ctx = contextEngine.getSnapshot();

    // Gate predictions
    renderGatePredictions(ctx);
    // Zone heatmap
    renderHeatmap(ctx);
    // Parking
    renderParkingStatus(ctx);

    // Async AI crowd analysis
    const titleEl = document.getElementById('crowd-ai-title');
    const bodyEl  = document.getElementById('crowd-ai-body');
    if (titleEl) titleEl.textContent = '🧠 Gemini analyzing crowd patterns...';

    const analysis = await geminiService.analyzeCrowd(ctx);
    if (analysis) {
        const levelEmoji = { low:'🟢', medium:'🟡', high:'🟠', critical:'🔴' };
        if (titleEl) titleEl.textContent = `${levelEmoji[analysis.overallLevel] || '🟡'} Overall: ${capitalize(analysis.overallLevel)} — ${analysis.recommendation}`;
        if (bodyEl) {
            const hotspots = (analysis.hotspots || []).slice(0, 2).map(h => `• ${h}`).join('\n');
            bodyEl.textContent = hotspots || analysis.recommendation || '';
        }
        // Style AI box based on level
        const aiBox = document.getElementById('crowd-ai-insight');
        if (aiBox) {
            aiBox.className = `ai-box ${analysis.overallLevel === 'critical' || analysis.overallLevel === 'high' ? 'danger' : ''}`;
        }
    }
}

function renderGatePredictions(ctx) {
    const container = document.getElementById('gate-predictions');
    if (!container) return;
    container.innerHTML = '';

    Object.values(ctx.stadium.gates).slice(0, 4).forEach(gate => {
        const isBest = gate.crowdLevel < 35;
        const isBad  = gate.crowdLevel > 75;
        const cls    = isBest ? 'recommended' : isBad ? 'critical' : '';
        const colorNow = isBest ? 'var(--success)' : isBad ? 'var(--danger)' : 'var(--warning)';

        const card = document.createElement('div');
        card.className = `gate-pred-card ${cls}`;
        card.innerHTML = `
          <div class="gate-pred-name">${escapeHTML(gate.name)}</div>
          <div class="gate-pred-now" style="color:${colorNow}">${gate.crowdLevel}% <span style="font-size:0.75rem;font-weight:400">(${gate.avgWait}min)</span></div>
          <div class="gate-pred-future text-muted">In 10 min: ${gate.predictedIn10 || gate.crowdLevel + 5}%</div>
          ${isBest ? '<div class="gate-pred-rec text-success">✅ Recommended</div>' : isBad ? '<div class="gate-pred-rec text-danger">⚠️ Avoid</div>' : ''}`;
        container.appendChild(card);
    });
}

function renderHeatmap(ctx) {
    const container = document.getElementById('heatmap-zones');
    if (!container) return;
    container.innerHTML = '';

    Object.values(ctx.stadium.zones).forEach(zone => {
        const level = zone.density > 75 ? 'high' : zone.density > 45 ? 'medium' : 'low';
        const el = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(zone.name)}</span>
            <span class="density-badge ${level}">${capitalize(level)}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${level}" style="width:${zone.density}%"></div></div>
          <div class="heatmap-prediction">
            <span>${zone.density}% full</span>
            <span>·</span>
            <span style="color:${zone.trend==='rising'?'var(--danger)':zone.trend==='falling'?'var(--success)':'var(--text-muted)'}">
              ${zone.trend === 'rising' ? '↑ Rising' : zone.trend === 'falling' ? '↓ Falling' : '→ Stable'}
            </span>
          </div>`;
        container.appendChild(el);
    });
}

function renderParkingStatus(ctx) {
    const container = document.getElementById('parking-status');
    if (!container) return;
    container.innerHTML = '';

    Object.values(ctx.stadium.parking).forEach(lot => {
        const pct = Math.round((1 - lot.available / lot.total) * 100);
        const level = pct > 80 ? 'high' : pct > 50 ? 'medium' : 'low';
        const el = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(lot.name)}</span>
            <span class="density-badge ${level}">${lot.available} spaces</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${level}" style="width:${pct}%"></div></div>
          <div class="heatmap-prediction">${lot.distance} walk ${lot.ev ? '· ⚡ EV charging' : ''}</div>`;
        container.appendChild(el);
    });
}

// ── FOOD VIEW ─────────────────────────────────────────────────────────────────
function bindFoodFilters() {
    document.querySelectorAll('#dietary-filters .route-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#dietary-filters .route-chip').forEach(c => {
                c.classList.remove('active'); c.setAttribute('aria-pressed','false');
            });
            chip.classList.add('active'); chip.setAttribute('aria-pressed','true');
            selectedDiet = chip.dataset.diet;
            renderFoodView();
        });
    });
}

const FOOD_ICONS = { American:'🍔', Italian:'🍕', Beverages:'🥤', BBQ:'🍖', Vegan:'🥗', Mexican:'🌮' };

async function renderFoodView() {
    const ctx = contextEngine.getSnapshot();
    let stalls = Object.values(ctx.stadium.food);

    if (selectedDiet !== 'all') {
        stalls = stalls.filter(s => s.dietary?.includes(selectedDiet));
        if (!stalls.length) stalls = Object.values(ctx.stadium.food);
    }
    stalls.sort((a, b) => a.queueTime - b.queueTime);

    const container = document.getElementById('food-list');
    if (container) {
        container.innerHTML = '';
        stalls.forEach(stall => {
            const waitColor = stall.queueTime > 15 ? 'var(--danger)' : stall.queueTime > 8 ? 'var(--warning)' : 'var(--success)';
            const tags = (stall.dietary || []).filter(d => d !== 'none').map(d => `<span class="dietary-tag">${d}</span>`).join(' ');
            const card = document.createElement('div');
            card.className = 'food-card';
            card.innerHTML = `
              <div class="food-card-icon">${FOOD_ICONS[stall.cuisine] || '🍽️'}</div>
              <div class="food-card-info">
                <div class="food-card-name">${escapeHTML(stall.name)}</div>
                <div class="food-card-meta">
                  <span>📍 ${escapeHTML(stall.section)}</span>
                  <span>🚶 ${escapeHTML(stall.distance)}</span>
                  <span>${escapeHTML(stall.price || '')}</span>
                </div>
                ${tags ? `<div style="margin-top:0.3rem">${tags}</div>` : ''}
              </div>
              <div class="food-card-right">
                <div class="food-wait-time" style="color:${waitColor}">${stall.queueTime}m</div>
                <div class="food-wait-label">Wait</div>
                <button class="btn btn-xs mt-xs" style="border-color:${waitColor};color:${waitColor}" data-stallid="${stall.id}" aria-label="Join virtual queue for ${stall.name}">Queue</button>
              </div>`;
            // Virtual queue button
            card.querySelector('button')?.addEventListener('click', (e) => joinVirtualQueue(e.target.dataset.stallid, stall.name));
            container.appendChild(card);
        });
    }

    // Async AI food recommendation
    const titleEl = document.getElementById('food-ai-title');
    const bodyEl  = document.getElementById('food-ai-body');
    const pref = selectedDiet !== 'all' ? { dietary: [selectedDiet] } : {};
    const rec = await geminiService.recommendFood(pref, ctx);
    if (rec?.trigger && rec.topPick) {
        if (titleEl) titleEl.textContent = `🍽️ Top Pick: ${rec.topPick.name} — ${rec.topPick.waitTime}min wait`;
        if (bodyEl) bodyEl.textContent = rec.message || rec.topPick.reason || '';
    } else {
        if (titleEl) titleEl.textContent = stalls[0] ? `✅ Best now: ${stalls[0].name} (${stalls[0].queueTime}min)` : 'No stalls available';
        if (bodyEl) bodyEl.textContent = stalls[0] ? `Only ${stalls[0].queueTime} min wait · ${stalls[0].distance}` : '';
    }
}

function joinVirtualQueue(stallId, stallName) {
    const banner = document.createElement('div');
    banner.className = 'queue-joined-banner';
    banner.innerHTML = `<div class="queue-position">#${Math.floor(Math.random()*8)+2}</div><div><div style="font-weight:700;font-size:0.9rem">Joined: ${escapeHTML(stallName)}</div><div class="text-xs text-muted mt-xs">We'll notify you 5 min before your turn</div></div>`;
    document.getElementById('food-list')?.prepend(banner);
}

// ── EMERGENCY VIEW ────────────────────────────────────────────────────────────
function bindEmergencyView() {
    const types = { fire: 'fire', medical: 'medical', evacuate: 'evacuation', security: 'security' };
    Object.entries(types).forEach(([btnId, type]) => {
        document.getElementById(`btn-emergency-${btnId}`)?.addEventListener('click', () => triggerEmergencyPlan(type));
    });
}

function bindHeaderEmergency() {
    document.getElementById('btn-fan-emergency-header')?.addEventListener('click', () => {
        switchFanTab('emergency');
    });
}

async function triggerEmergencyPlan(type) {
    contextEngine.triggerEmergency(type);
    showGlobalEmergencyOverlay(type);

    const planCard = document.getElementById('emergency-plan-card');
    const stepsEl  = document.getElementById('emergency-steps');
    const broadEl  = document.getElementById('emergency-broadcast');
    if (planCard) planCard.classList.remove('hidden');
    if (stepsEl) stepsEl.innerHTML = '<div style="padding:1rem;text-align:center"><i class="fa-solid fa-spinner spin-anim" style="color:var(--danger)"></i> Generating emergency plan...</div>';

    const ctx = contextEngine.getSnapshot();
    const plan = await geminiService.generateEmergencyPlan(type, ctx);
    if (!plan) return;

    if (stepsEl) {
        stepsEl.innerHTML = '';
        (plan.evacuationRoute || plan.immediateActions || []).forEach(step => {
            const el = document.createElement('div');
            el.className = 'emergency-step';
            el.innerHTML = `<div class="emergency-step-icon">➤</div><div class="emergency-step-text">${escapeHTML(step)}</div>`;
            stepsEl.appendChild(el);
        });
    }
    if (broadEl) broadEl.textContent = plan.broadcastMessage || '';
}

function renderExitList() {
    const container = document.getElementById('exit-list');
    if (!container) return;
    container.innerHTML = '';
    const gates = Object.values(contextEngine.getLiveState().gates)
        .filter(g => g.status === 'open')
        .sort((a, b) => a.crowdLevel - b.crowdLevel);
    gates.slice(0, 3).forEach((gate, i) => {
        const el = document.createElement('div');
        el.className = 'stat-row';
        el.innerHTML = `<span class="stat-label">${i === 0 ? '🟢' : '🟡'} ${escapeHTML(gate.name)}</span><span class="stat-value text-xs">${gate.avgWait} min away</span>`;
        container.appendChild(el);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZER COMMAND CENTER
// ═══════════════════════════════════════════════════════════════════════════
async function initOrganizerApp() {
    bindOrgControls();
    updateOrgKPIs();
    renderOrgGates();
    renderOrgAlerts();
    renderEcoMetrics();
    updateDigitalTwin();

    // Load AI operations summary
    await loadOrgAISummary();
}

function bindOrgControls() {
    document.getElementById('btn-refresh-summary')?.addEventListener('click', loadOrgAISummary);
    document.getElementById('btn-redeploy')?.addEventListener('click',         loadVolunteerDeployment);
    document.getElementById('btn-org-emergency')?.addEventListener('click',   () => orgTriggerEmergency());
    document.getElementById('btn-org-broadcast')?.addEventListener('click',   orgBroadcast);
    document.getElementById('btn-clear-log')?.addEventListener('click',       () => { const l = document.getElementById('org-log'); if (l) l.innerHTML = ''; });
}

async function loadOrgAISummary() {
    const skelEl = document.getElementById('org-ai-summary-skeleton');
    const textEl = document.getElementById('org-ai-summary-text');
    const btn    = document.getElementById('btn-refresh-summary');

    if (skelEl) skelEl.classList.remove('hidden');
    if (textEl) textEl.classList.add('hidden');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner spin-anim"></i> Analyzing...';

    const ctx = contextEngine.getSnapshot();
    const summary = await geminiService.summarizeOperations(ctx);

    if (skelEl) skelEl.classList.add('hidden');
    if (textEl) { textEl.classList.remove('hidden'); textEl.textContent = summary?.situationSummary || 'Stadium operating normally.'; }
    if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh AI Summary';

    // Update status pill
    const statusEl = document.getElementById('org-status');
    if (statusEl && summary) {
        const map = { normal:'Normal', watch:'Watch', warning:'⚠ Warning', critical:'🔴 Critical' };
        statusEl.textContent = map[summary.overallStatus] || 'Normal';
        statusEl.className = `status-indicator ${summary.overallStatus === 'normal' ? '' : summary.overallStatus}`;
    }

    // Render critical alerts
    renderOrgCriticalAlerts(summary?.criticalAlerts || []);
    // Render AI actions
    renderOrgActions(summary?.immediateActions || []);
    // Render volunteer deployment
    await loadVolunteerDeployment();

    orgLog('AI Summary refreshed by Gemini.');
}

function renderOrgCriticalAlerts(alerts) {
    const container = document.getElementById('org-critical-alerts');
    if (!container) return;
    container.innerHTML = '';
    if (!alerts.length) {
        container.innerHTML = '<div class="alert-item success"><div class="alert-dot success"></div>No critical alerts at this time.</div>';
        return;
    }
    alerts.slice(0, 4).forEach(alert => {
        const el = document.createElement('div');
        const isRed = alert.startsWith('🔴');
        el.className = `alert-item ${isRed ? 'danger' : 'warning'}`;
        el.innerHTML = `<div class="alert-dot ${isRed ? 'danger' : 'warning'}"></div><div style="font-size:0.82rem">${escapeHTML(alert)}</div>`;
        container.appendChild(el);
    });
}

function renderOrgActions(actions) {
    const container = document.getElementById('org-actions');
    if (!container) return;
    container.innerHTML = '';
    actions.forEach((action, i) => {
        const el = document.createElement('div');
        el.className = 'action-item';
        const priority = i === 0 ? 'high' : i === 1 ? 'medium' : 'low';
        el.innerHTML = `<div class="action-item-priority ${priority}"></div><div class="action-item-text">${escapeHTML(action)}</div>`;
        container.appendChild(el);
    });
}

async function loadVolunteerDeployment() {
    const container = document.getElementById('org-volunteer-deployments');
    if (!container) return;
    container.innerHTML = '<div style="padding:0.5rem;text-align:center;font-size:0.82rem;color:var(--text-muted)"><i class="fa-solid fa-spinner spin-anim"></i></div>';

    const ctx = contextEngine.getSnapshot();
    const result = await geminiService.recommendVolunteerDeployment(ctx);

    container.innerHTML = '';
    (result?.deployments || []).forEach(dep => {
        const el = document.createElement('div');
        el.className = 'action-item';
        el.innerHTML = `
          <div class="action-item-priority ${dep.priority || 'medium'}"></div>
          <div class="action-item-text">
            <strong>${escapeHTML(dep.team)}</strong>: ${escapeHTML(dep.from)} → ${escapeHTML(dep.to)} · ${escapeHTML(dep.task)}
            <div class="text-xs text-muted mt-xs">${escapeHTML(dep.reason)}</div>
          </div>`;
        container.appendChild(el);
    });
}

function updateOrgKPIs() {
    const ctx = contextEngine.getSnapshot();
    const match = ctx.match;
    const zones = Object.values(ctx.stadium.zones);
    const critical = zones.filter(z => z.density > 80).length;
    const openGates = Object.values(ctx.stadium.gates).filter(g => g.status === 'open').length;
    const volCount  = Object.values(ctx.stadium.volunteers).reduce((s, v) => s + v.count, 0);

    safeText('kpi-attendance', match.attendance.toLocaleString());
    safeText('kpi-critical-zones', String(critical));
    safeText('kpi-gates-open', String(openGates));
    safeText('kpi-volunteers', String(volCount));
    safeText('kpi-attendance-trend', `${Math.round(match.attendance / match.capacity * 100)}% capacity`);
    safeText('kpi-zones-trend', critical > 0 ? `↑ ${critical} above 80%` : '✓ All normal');
    safeText('kpi-vol-trend', `${Object.values(ctx.stadium.volunteers).reduce((s, v) => s + v.available, 0)} available`);
}

function renderOrgAlerts() {
    const alerts = contextEngine.getLiveState().alerts || [];
    renderOrgCriticalAlerts(alerts.filter(a => a.type !== 'success').map(a => a.message));
}

function renderOrgGates() {
    const container = document.getElementById('org-gates');
    if (!container) return;
    container.innerHTML = '';
    const gates = contextEngine.getLiveState().gates;
    Object.values(gates).forEach(gate => {
        const level = gate.crowdLevel > 75 ? 'danger' : gate.crowdLevel > 45 ? 'warning' : 'success';
        const el = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(gate.name)} (${gate.direction})</span>
            <div class="d-flex gap-xs items-center">
              <span class="density-badge ${level}">${gate.avgWait}min</span>
              <button class="btn btn-xs ${gate.status==='open'?'btn-danger':'btn-success'}" data-gateid="${gate.id}" aria-label="${gate.status==='open'?'Close':'Open'} ${gate.name}">
                ${gate.status==='open' ? 'Close' : 'Open'}
              </button>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill ${level}" style="width:${gate.crowdLevel}%"></div></div>
          <div class="heatmap-prediction">${gate.crowdLevel}% · ${gate.status==='open'?'Open ✓':'Closed ✗'} · ${escapeHTML(gate.direction)}</div>`;
        el.querySelector('button')?.addEventListener('click', (e) => {
            toggleGateStatus(gate.id, gate.status);
            gate.status = gate.status === 'open' ? 'closed' : 'open';
            orgLog(`Gate ${gate.name} set to ${gate.status.toUpperCase()}`);
            renderOrgGates();
        });
        container.appendChild(el);
    });
}

function renderEcoMetrics() {
    const eco = contextEngine.getLiveState().sustainability;
    safeText('eco-score', String(eco.ecoScore));
    safeText('eco-score-label', `Eco Score: ${eco.ecoScore}`);

    const ring = document.querySelector('.eco-score-ring');
    if (ring) ring.style.setProperty('--score-pct', `${Math.round(eco.ecoScore / 100 * 360)}deg`);

    const metrics = [
        { icon:'🌿', name:'Carbon Saved', val:`${eco.carbonSaved.toLocaleString()} kg CO₂`, desc:'vs driving alone' },
        { icon:'🚇', name:'Public Transport', val:`${eco.publicTransportPct}% of fans`, desc:'used transit today' },
        { icon:'💧', name:'Water Refills', val:`${eco.waterRefillCount.toLocaleString()}`, desc:'plastic bottles avoided' },
        { icon:'♻️', name:'Recycling Rate', val:`${eco.recyclingRate}%`, desc:'of waste recycled' },
        { icon:'☀️', name:'Solar Energy', val:`${eco.solarPowerPct}%`, desc:'stadium power from solar' },
    ];

    const container = document.getElementById('eco-metrics');
    if (!container) return;
    container.innerHTML = '';
    metrics.forEach(m => {
        const el = document.createElement('div');
        el.className = 'eco-metric';
        el.innerHTML = `<div class="eco-metric-icon">${m.icon}</div><div class="eco-metric-info"><div class="eco-metric-name">${m.name}</div><div class="eco-metric-val">${escapeHTML(m.val)}</div><div class="eco-metric-desc">${escapeHTML(m.desc)}</div></div>`;
        container.appendChild(el);
    });
}

function updateDigitalTwin() {
    const zones = contextEngine.getLiveState().zones;
    const zoneMap = {
        'zone1': 'twin-zone-north',
        'zone2': 'twin-zone-south',
        'zone3': 'twin-zone-merch',
        'zone5': 'twin-zone-vip',
    };
    Object.entries(zoneMap).forEach(([zoneKey, svgId]) => {
        const zone = zones[zoneKey];
        const el   = document.getElementById(svgId);
        if (!zone || !el) return;
        const density = zone.density;
        let color;
        if (density > 75) color = `rgba(255,71,87,${0.2 + density/300})`;
        else if (density > 45) color = `rgba(255,167,38,${0.2 + density/300})`;
        else color = `rgba(0,230,118,${0.15 + density/300})`;
        el.style.fill = color;
        el.setAttribute('opacity', '0.75');
    });
}

function orgTriggerEmergency() {
    if (confirm('⚠️ Trigger global emergency evacuation? This will alert all users.')) {
        showGlobalEmergencyOverlay('evacuation');
        orgLog('EMERGENCY: Global evacuation triggered.');
    }
}

function orgBroadcast() {
    const msg = prompt('Enter broadcast message for all stadium users:');
    if (msg) { orgLog(`BROADCAST: ${msg}`); alert('📢 Message broadcast to all users successfully!'); }
}

function orgLog(msg) {
    const log = document.getElementById('org-log');
    if (!log) return;
    const el = document.createElement('div');
    el.className = 'text-xs text-muted';
    el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(el);
}

// ═══════════════════════════════════════════════════════════════════════════
// VOLUNTEER APP
// ═══════════════════════════════════════════════════════════════════════════
async function initVolunteerApp() {
    bindVolunteerActions();
    renderVolZones();
    await loadVolAITask();
}

function bindVolunteerActions() {
    const actions = {
        'vol-btn-crowd':      () => volAskAI('Where am I most needed for crowd control right now?'),
        'vol-btn-translate':  () => toggleTranslateTool(),
        'vol-btn-wheelchair': () => volAskAI('Where is the nearest wheelchair assistance point and who can I contact for wheelchair support?'),
        'vol-btn-lost-child': () => volAskAI('A child is lost. Give me the step-by-step lost child protocol I should follow right now.'),
        'vol-btn-medical':    () => volAskAI('I need medical assistance urgently. Where is the nearest medical center and what should I do?'),
        'vol-btn-incident':   () => volAskAI('I need to report a crowd incident. What information should I collect and who should I contact?'),
    };
    Object.entries(actions).forEach(([id, fn]) => {
        document.getElementById(id)?.addEventListener('click', fn);
    });

    document.getElementById('vol-translate-btn')?.addEventListener('click', doVolTranslation);
}

async function loadVolAITask() {
    const ctx = contextEngine.getSnapshot();
    const result = await geminiService.recommendVolunteerDeployment(ctx);
    const dep = result?.deployments?.[0];
    if (dep) {
        safeText('vol-ai-task', `📍 ${dep.team}: ${dep.from} → ${dep.to}`);
        safeText('vol-ai-detail', `Priority: ${dep.priority.toUpperCase()} · Task: ${dep.task} · ${dep.reason}`);
    } else {
        safeText('vol-ai-task', '✅ No immediate reassignment needed.');
        safeText('vol-ai-detail', 'Stay at current position. Monitor Zone Alpha.');
    }
}

async function volAskAI(question) {
    const responseBox = document.getElementById('vol-ai-response');
    const textEl      = document.getElementById('vol-response-text');
    if (!responseBox || !textEl) return;

    responseBox.classList.remove('hidden');
    textEl.textContent = '⏳ Gemini is analyzing...';

    const ctx = contextEngine.getSnapshot();
    const reply = await geminiService.chat(question, ctx);
    textEl.textContent = reply || 'Unable to get response. Please contact command center.';

    // Hide translate tool if showing
    const tt = document.getElementById('vol-translate-tool');
    if (tt) tt.style.display = 'none';
}

function toggleTranslateTool() {
    const tt = document.getElementById('vol-translate-tool');
    if (!tt) return;
    const visible = tt.style.display !== 'none';
    tt.style.display = visible ? 'none' : 'block';
    document.getElementById('vol-ai-response')?.classList.add('hidden');
}

async function doVolTranslation() {
    const lang    = document.getElementById('vol-translate-lang')?.value;
    const text    = document.getElementById('vol-translate-input')?.value.trim();
    const resultEl = document.getElementById('vol-translate-result');
    if (!text || !lang || !resultEl) return;

    resultEl.classList.remove('hidden');
    resultEl.textContent = '⏳ Translating...';

    const ctx = contextEngine.getSnapshot();
    const translated = await geminiService.translateMessage(text, lang, ctx);
    resultEl.textContent = translated || text;
}

function renderVolZones() {
    const container = document.getElementById('vol-zone-status');
    if (!container) return;
    container.innerHTML = '';
    const zones = contextEngine.getLiveState().zones;
    Object.values(zones).slice(0, 4).forEach(zone => {
        const level = zone.density > 75 ? 'high' : zone.density > 45 ? 'medium' : 'low';
        const el = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(zone.name)}</span>
            <span class="density-badge ${level}">${zone.density}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${level}" style="width:${zone.density}%"></div></div>`;
        container.appendChild(el);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// STAFF APP
// ═══════════════════════════════════════════════════════════════════════════
function initStaffApp() {
    bindStaffControls();
    renderStaffGates();
    renderStaffZones();
}

function bindStaffControls() {
    document.getElementById('btn-staff-emergency')?.addEventListener('click', () => {
        if (confirm('Trigger emergency evacuation for all staff and fans?')) {
            showGlobalEmergencyOverlay('evacuation');
            staffLog('EMERGENCY: Evacuation triggered.');
        }
    });
    document.getElementById('btn-staff-broadcast')?.addEventListener('click', () => {
        const msg = prompt('Enter staff broadcast message:');
        if (msg) { staffLog(`BROADCAST: ${msg}`); alert('Alert sent!'); }
    });
    document.getElementById('btn-staff-request-cleaning')?.addEventListener('click', () => {
        staffLog('Cleaning team requested for Sections 101-104.');
        alert('🧹 Cleaning team notified!');
    });
}

function renderStaffGates() {
    const container = document.getElementById('staff-gates');
    if (!container) return;
    container.innerHTML = '';
    Object.values(contextEngine.getLiveState().gates).forEach(gate => {
        const level = gate.crowdLevel > 75 ? 'danger' : gate.crowdLevel > 45 ? 'warning' : 'success';
        const el = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(gate.name)}</span>
            <div class="d-flex gap-xs items-center">
              <span class="density-badge ${level}">${gate.avgWait}min</span>
              <button class="btn btn-xs ${gate.status==='open'?'btn-danger':'btn-success'}" data-gateid="${gate.id}">
                ${gate.status === 'open' ? 'Close' : 'Open'}
              </button>
            </div>
          </div>
          <div class="progress-bar"><div class="progress-fill ${level}" style="width:${gate.crowdLevel}%"></div></div>
          <div class="heatmap-prediction">${gate.crowdLevel}% · ${gate.status==='open'?'Open':'Closed'} · Predicted: ${gate.predictedIn10||gate.crowdLevel+5}% in 10 min</div>`;
        el.querySelector('button')?.addEventListener('click', () => {
            toggleGateStatus(gate.id, gate.status);
            gate.status = gate.status === 'open' ? 'closed' : 'open';
            staffLog(`Gate ${gate.name} → ${gate.status.toUpperCase()}`);
            renderStaffGates();
        });
        container.appendChild(el);
    });
}

function renderStaffZones() {
    const container = document.getElementById('staff-zones');
    if (!container) return;
    container.innerHTML = '';
    Object.values(contextEngine.getLiveState().zones).forEach(zone => {
        const level = zone.density > 75 ? 'high' : zone.density > 45 ? 'medium' : 'low';
        const el = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(zone.name)}</span>
            <span class="density-badge ${level}">${zone.density}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${level}" style="width:${zone.density}%"></div></div>`;
        container.appendChild(el);
    });
}

function staffLog(msg) {
    const log = document.getElementById('staff-log');
    if (!log) return;
    const el = document.createElement('div');
    el.className = 'text-xs text-muted';
    el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(el);
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL EMERGENCY OVERLAY
// ═══════════════════════════════════════════════════════════════════════════
function bindGlobalEmergency() {
    // Nothing to bind at global level — triggered programmatically
}

function showGlobalEmergencyOverlay(type) {
    const overlay = document.getElementById('emergency-overlay');
    const border  = document.getElementById('emergency-border');
    if (!overlay) return;

    const labels = { fire:'🔥 FIRE ALERT', medical:'🏥 MEDICAL EMERGENCY', evacuation:'🚨 EVACUATION IN PROGRESS', security:'🛡️ SECURITY ALERT' };
    overlay.classList.add('active');
    overlay.innerHTML = `
      <div style="position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:200;background:rgba(255,71,87,0.95);color:#fff;padding:0.75rem 1.5rem;border-radius:50px;font-weight:800;font-size:0.9rem;pointer-events:auto;animation:emergency-pulse 1s infinite">
        ${labels[type] || '🚨 EMERGENCY'}
      </div>`;
    border?.classList.remove('hidden');

    // Auto-clear after 30s
    setTimeout(() => {
        overlay.classList.remove('active');
        overlay.innerHTML = '';
        border?.classList.add('hidden');
        contextEngine.clearEmergency();
    }, 30000);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}
