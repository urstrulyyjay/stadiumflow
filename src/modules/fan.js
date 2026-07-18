/**
 * src/modules/fan.js
 * StadiumFlow AI — Fan App Module
 *
 * All fan-specific UI logic: Home Dashboard, AI Chat, Navigation,
 * Crowd Intelligence, Food & Queues, Match Day Planner, Emergency.
 *
 * Default export: initFanApp() — called by app.js when Fan role is selected.
 */

import { contextEngine } from '../services/contextEngine.js';
import { geminiService  } from '../services/ai.js';
import { escapeHTML, safeText, capitalize, crowdClass, crowdColor, renderBold, statusBadge, updateNavBadge, showSkeleton } from '../utils/dom.js';
import { formatTimeLocal, formatMatchPhase, startKickoffCountdown } from '../utils/time.js';

let selectedDiet    = 'all';
let selectedLang    = 'en';
let chatDisabled    = false;
let navRouteType    = 'fastest';
let _countdownId    = null;
let _proactiveTimer = null;

// ─── Entry Point ────────────────────────────────────────────────────────────────
export default function initFanApp() {
    bindFanNav();
    bindChatInterface();
    bindNavigationView();
    bindFoodFilters();
    bindEmergencyView();
    bindHeaderButtons();
    bindTicketWallet();
    bindPlannerView();

    renderHomeView();
    renderHomeAlerts();
    renderHomeTransport();

    _countdownId = startKickoffCountdown('kickoff-countdown', () => contextEngine.getMatch().minutesUntilKickoff);

    // Non-blocking async loads
    setTimeout(() => updateProactiveAICard(), 800);
    setTimeout(() => renderSustainabilityCard(), 1200);

    // Proactive AI refreshes every 2 minutes
    _proactiveTimer = setInterval(() => {
        if (contextEngine.shouldRefreshProactive()) updateProactiveAICard();
    }, 120_000);

    console.log('[FanApp] Initialized.');
}

/** Called by app.js when the user exits the fan role. */
export function destroyFanApp() {
    if (_countdownId)    clearInterval(_countdownId);
    if (_proactiveTimer) clearInterval(_proactiveTimer);
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function bindFanNav() {
    document.querySelectorAll('#fan-app .nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchFanTab(btn.dataset.tab));
    });
    document.getElementById('btn-go-assistant')?.addEventListener('click', () => switchFanTab('assistant'));
    document.getElementById('btn-go-navigate')?.addEventListener('click',  () => switchFanTab('navigate'));
    document.getElementById('btn-go-crowd')?.addEventListener('click',     () => switchFanTab('crowd'));
    document.getElementById('btn-go-plan')?.addEventListener('click',      () => switchFanTab('plan'));
}

function switchFanTab(tabId) {
    document.querySelectorAll('#fan-app .view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('#fan-app .nav-item').forEach(n => { n.classList.remove('active'); n.setAttribute('aria-selected', 'false'); });

    document.getElementById(`view-${tabId}`)?.classList.add('active');
    const activeBtn = document.querySelector(`#fan-app .nav-item[data-tab="${tabId}"]`);
    activeBtn?.classList.add('active');
    activeBtn?.setAttribute('aria-selected', 'true');

    const onActivate = {
        home:      () => { updateHeroCard(); renderHomeAlerts(); renderSustainabilityCard(); },
        assistant: () => { if (!chatHasMessages()) showWelcomeMessage(); },
        navigate:  () => {},
        crowd:     () => renderCrowdView(),
        food:      () => renderFoodView(),
        emergency: () => renderExitList(),
        plan:      () => renderMatchDayPlanner(),
    };
    onActivate[tabId]?.();
    document.getElementById('fan-content')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
function renderHomeView() { updateHeroCard(); }

function updateHeroCard() {
    const state     = contextEngine.getLiveState();
    const match     = contextEngine.getMatch();
    const bestGate  = contextEngine.getBestGate();
    const crowdLvl  = contextEngine.getOverallCrowdLevel();
    const crowdLbl  = crowdLvl > 80 ? 'Critical' : crowdLvl > 65 ? 'High' : crowdLvl > 40 ? 'Moderate' : 'Low';
    const crowdClr  = crowdLvl > 80 ? 'var(--danger)' : crowdLvl > 65 ? 'var(--warning)' : crowdLvl > 40 ? '#ffb300' : 'var(--success)';
    const w         = state.weather;

    safeText('hero-gate',   bestGate ? bestGate.name : 'Gate B');
    safeText('hero-wait',   bestGate ? `${bestGate.avgWait} min` : '6 min');

    const crowdEl = document.getElementById('hero-crowd');
    if (crowdEl) { crowdEl.textContent = crowdLbl; crowdEl.style.color = crowdClr; }

    safeText('home-weather',  `${w.temp}°C ${w.condition}`);
    safeText('home-capacity', `${match.attendance.toLocaleString()} / ${match.capacity.toLocaleString()}`);

    const phaseEl = document.getElementById('hero-phase');
    if (phaseEl) phaseEl.textContent = formatMatchPhase(match.currentPhase, match.matchMinute);

    const wMini = document.getElementById('fan-weather-mini');
    if (wMini) wMini.innerHTML = `${w.temp}°C`;

    // Update match status pill
    const pillEl = document.getElementById('hero-status-pill');
    if (pillEl) {
        if (match.currentPhase === 'First Half' || match.currentPhase === 'Second Half') {
            pillEl.innerHTML = `<div class="hero-status-dot live-pulse"></div> LIVE · ${formatMatchPhase(match.currentPhase, match.matchMinute)}`;
        } else {
            pillEl.innerHTML = `<div class="hero-status-dot"></div> ${formatMatchPhase(match.currentPhase, match.matchMinute)}`;
        }
    }
}

// ─── PROACTIVE AI CARD ────────────────────────────────────────────────────────
async function updateProactiveAICard() {
    const card    = document.getElementById('proactive-ai-card');
    const titleEl = document.getElementById('proactive-title');
    const bodyEl  = document.getElementById('proactive-body');
    const actionBtn = document.getElementById('proactive-action-btn');
    if (!card) return;

    // Show loading state
    if (titleEl) titleEl.textContent = '✨ Analyzing your match day situation...';
    if (bodyEl) bodyEl.textContent = '';
    card.classList.add('loading');

    const ctx = contextEngine.getSnapshot();
    const suggestion = await geminiService.generateProactiveSuggestion(ctx);

    card.classList.remove('loading');

    if (!suggestion?.shouldNotify) {
        // Show a gentle standing suggestion
        if (titleEl) titleEl.textContent = '✅ All clear — stadium running smoothly';
        if (bodyEl) bodyEl.textContent = 'No urgent alerts. Enjoy the match!';
        if (actionBtn) actionBtn.classList.add('hidden');
        contextEngine.setProactiveSuggestion({ title: 'All clear', body: '', urgency: 'low' });
        return;
    }

    if (titleEl) titleEl.innerHTML = `${suggestion.icon || '✨'} ${escapeHTML(suggestion.title)}`;
    if (bodyEl) bodyEl.textContent = suggestion.body;

    if (actionBtn && suggestion.actionLabel) {
        actionBtn.textContent = suggestion.actionLabel;
        actionBtn.classList.remove('hidden');
        actionBtn.onclick = () => {
            if (suggestion.action === 'navigate') switchFanTab('navigate');
            else if (suggestion.action === 'food')     switchFanTab('food');
            else if (suggestion.action === 'crowd')    switchFanTab('crowd');
        };
    }

    // Apply urgency styling
    card.className = `proactive-card urgency-${suggestion.urgency || 'low'}`;
    contextEngine.setProactiveSuggestion(suggestion);

    // Add as notification if high urgency
    if (suggestion.urgency === 'high') {
        contextEngine.addNotification({ title: suggestion.title, body: suggestion.body, type: 'warning', category: 'proactive' });
        updateNavBadge('badge-home', contextEngine.getUnreadCount());
    }
}

// ─── SUSTAINABILITY CARD ─────────────────────────────────────────────────────
async function renderSustainabilityCard() {
    const s = contextEngine.getLiveState().sustainability;
    safeText('sustain-co2',      `${s.carbonSaved.toLocaleString()} kg`);
    safeText('sustain-transit',  `${s.publicTransportPct}%`);
    safeText('sustain-water',    s.waterRefillCount.toLocaleString());
    safeText('sustain-eco',      `${Math.round(s.ecoScore)}/100`);

    // Progress bar
    const bar = document.getElementById('sustain-eco-bar');
    if (bar) bar.style.width = `${s.ecoScore}%`;
}

// ─── HOME ALERTS ─────────────────────────────────────────────────────────────
function renderHomeAlerts() {
    const container = document.getElementById('home-alerts');
    if (!container) return;
    container.innerHTML = '';
    const alerts = contextEngine.getLiveState().alerts || [];
    alerts.slice(0, 4).forEach(a => {
        const el = document.createElement('div');
        el.className = `alert-item ${a.type}`;
        el.innerHTML = `<div class="alert-dot ${a.type}"></div><div style="flex:1"><div style="font-size:0.82rem">${escapeHTML(a.message)}</div><div class="text-xs text-muted mt-xs">${a.time}</div></div>`;
        container.appendChild(el);
    });
}

// ─── HOME TRANSPORT ──────────────────────────────────────────────────────────
function renderHomeTransport() {
    const container = document.getElementById('home-transport');
    if (!container) return;
    container.innerHTML = '';
    const transport = contextEngine.getLiveState().transport;
    const iconMap = { rail: '🚆', bus: '🚌', shuttle: '🚐', rideshare: '🚗' };

    Object.values(transport).slice(0, 4).forEach(t => {
        const statusKey = (t.status || '').toLowerCase();
        const statusClass = statusKey.includes('time') ? 'on-time' : statusKey.includes('delay') ? 'delayed' : 'busy';
        const el = document.createElement('div');
        el.className = 'transport-card';
        el.innerHTML = `
          <div class="transport-icon">${iconMap[t.type] || '🚌'}</div>
          <div class="transport-info">
            <div class="transport-name">${escapeHTML(t.name)}</div>
            <div class="transport-eta">${t.nextArrival ? `Next: ${t.nextArrival}` : t.eta || ''} · ${escapeHTML(t.crowding || '')}</div>
          </div>
          <span class="transport-status ${statusClass}">${escapeHTML(t.status)}</span>`;
        container.appendChild(el);
    });
}

// ─── TICKET WALLET ────────────────────────────────────────────────────────────
function bindTicketWallet() {
    const btn = document.getElementById('btn-show-ticket');
    const wallet = document.getElementById('ticket-wallet-detail');
    if (!btn || !wallet) return;
    btn.addEventListener('click', () => wallet.classList.toggle('hidden'));
}

// ─── CHAT INTERFACE ──────────────────────────────────────────────────────────
function bindChatInterface() {
    const input   = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const clearBtn= document.getElementById('chat-clear-btn');

    sendBtn?.addEventListener('click', sendChatMessage);
    clearBtn?.addEventListener('click', clearChat);

    input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
    input?.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 100) + 'px'; });

    document.querySelectorAll('.prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const inp = document.getElementById('chat-input');
            if (inp) { inp.value = chip.dataset.prompt; inp.focus(); sendChatMessage(); }
        });
    });

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
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;
    showTypingIndicator();

    const ctx = contextEngine.getSnapshot();
    try {
        const reply = await geminiService.chat(msg, ctx);
        hideTypingIndicator();
        appendChatMessage('ai', reply || '🤖 I had trouble processing that. Please try again.');
        contextEngine.addToHistory('model', reply || '');
    } catch (e) {
        hideTypingIndicator();
        appendChatMessage('ai', '⚠️ Connection issue. Please check your network.');
    }

    chatDisabled = false;
    if (sendBtn) sendBtn.disabled = false;
    document.getElementById('chat-input')?.focus();
}

function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const wrap = document.createElement('div');
    wrap.className = `chat-bubble-wrap ${role}`;

    const avatar = document.createElement('div');
    avatar.className = `chat-avatar ${role}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = role === 'ai' ? '✨' : '🙋';

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = renderBold(text);

    const time = document.createElement('div');
    time.className = 'chat-bubble-time';
    time.textContent = formatTimeLocal();
    bubble.appendChild(time);

    if (role === 'ai') {
        const actionsRow = document.createElement('div');
        actionsRow.className = 'chat-bubble-actions';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'chat-copy-btn';
        copyBtn.setAttribute('aria-label', 'Copy response');
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(text).then(() => {
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'; }, 1500);
            });
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
    indicator.innerHTML = `<div class="chat-avatar ai" aria-hidden="true">✨</div><div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    container?.appendChild(indicator);
    container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function hideTypingIndicator() { document.getElementById('typing-indicator')?.remove(); }

function clearChat() {
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    contextEngine.clearHistory();
    showWelcomeMessage();
}

function chatHasMessages() { return (document.getElementById('chat-messages')?.children.length || 0) > 0; }

function showWelcomeMessage() {
    const match = contextEngine.getMatch();
    appendChatMessage('ai', `👋 Hi! I'm **StadiumFlow AI**, your match companion at MetLife Stadium. I can help with gate entry, food queues, seat navigation, translations, and emergencies — for **${match.homeTeam.name} ${match.homeTeam.flag} vs ${match.awayTeam.flag} ${match.awayTeam.name}**! What do you need right now?`);
}

// ─── NAVIGATION VIEW ─────────────────────────────────────────────────────────
function bindNavigationView() {
    document.querySelectorAll('#route-type-selector .route-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#route-type-selector .route-chip').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
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

    const ctx  = contextEngine.getSnapshot();
    const plan = await geminiService.generateNavigationPlan(`${ctx.user.section} — Seat ${ctx.user.seat}`, navRouteType, ctx);

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Get AI Navigation Plan'; }
    if (!plan) return;

    safeText('eta-time', plan.eta || '—');
    safeText('eta-dist', plan.distance || '—');
    safeText('eta-crowd', capitalize(plan.crowdAvoidance || navRouteType));

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
            note.className = 'text-xs text-muted p-sm nav-note';
            note.textContent = plan.notes;
            stepsCard.appendChild(note);
        }
    }
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
        accessible: 'var(--secondary)', family: 'var(--warning)', emergency: 'var(--danger)',
    };
    path.setAttribute('d', routes[routeType] || routes.fastest);
    path.style.stroke = colors[routeType] || 'var(--primary)';
}

// ─── CROWD VIEW ──────────────────────────────────────────────────────────────
async function renderCrowdView() {
    const ctx = contextEngine.getSnapshot();
    renderGatePredictions(ctx);
    renderHeatmap(ctx);
    renderParkingStatus(ctx);

    const titleEl = document.getElementById('crowd-ai-title');
    const bodyEl  = document.getElementById('crowd-ai-body');
    if (titleEl) titleEl.textContent = '🧠 Gemini analyzing crowd patterns...';

    const analysis = await geminiService.analyzeCrowd(ctx);
    if (analysis) {
        const levelEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
        if (titleEl) titleEl.textContent = `${levelEmoji[analysis.overallLevel] || '🟡'} ${capitalize(analysis.overallLevel)} — ${analysis.recommendation}`;
        if (bodyEl) {
            const hotspots = (analysis.hotspots || []).slice(0, 3).map(h => `• ${h}`).join('\n');
            bodyEl.textContent = hotspots || analysis.recommendation || '';
        }
        const aiBox = document.getElementById('crowd-ai-insight');
        if (aiBox) aiBox.className = `ai-box ${['critical', 'high'].includes(analysis.overallLevel) ? 'danger' : ''}`;
    }
}

function renderGatePredictions(ctx) {
    const container = document.getElementById('gate-predictions');
    if (!container) return;
    container.innerHTML = '';

    Object.values(ctx.stadium.gates).filter(g => !g.isStaff).slice(0, 6).forEach(gate => {
        const isBest = gate.crowdLevel < 35 && gate.status === 'open';
        const isBad  = gate.crowdLevel > 75 || gate.status === 'closed';
        const cls    = isBest ? 'recommended' : isBad ? 'critical' : '';
        const color  = crowdColor(gate.crowdLevel);
        const card   = document.createElement('div');
        card.className = `gate-pred-card ${cls}`;
        card.innerHTML = `
          <div class="gate-pred-name">${escapeHTML(gate.name)}</div>
          <div class="gate-pred-dir text-muted text-xs">${escapeHTML(gate.direction)}</div>
          <div class="gate-pred-now" style="color:${color}">${gate.crowdLevel.toFixed(0)}% <span style="font-size:0.75rem;font-weight:400">(${gate.avgWait}min)</span></div>
          <div class="gate-pred-future text-muted">10min: ${(gate.predictedIn10 || gate.crowdLevel).toFixed(0)}%</div>
          ${gate.status === 'closed' ? '<div class="gate-pred-rec text-danger">🔒 Closed</div>'
            : isBest ? '<div class="gate-pred-rec text-success">✅ Recommended</div>'
            : isBad  ? '<div class="gate-pred-rec text-danger">⚠️ Avoid</div>' : ''}`;
        container.appendChild(card);
    });
}

function renderHeatmap(ctx) {
    const container = document.getElementById('heatmap-zones');
    if (!container) return;
    container.innerHTML = '';

    Object.values(ctx.stadium.zones).forEach(zone => {
        const level = crowdClass(zone.density);
        const el    = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(zone.name)}</span>
            <span class="density-badge ${level}">${capitalize(level)}</span>
          </div>
          <div class="progress-bar" role="progressbar" aria-valuenow="${zone.density.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-fill ${level}" style="width:${zone.density.toFixed(0)}%"></div>
          </div>
          <div class="heatmap-prediction">
            <span>${zone.density.toFixed(0)}% full</span><span>·</span>
            <span style="color:${zone.trend === 'rising' ? 'var(--danger)' : zone.trend === 'falling' ? 'var(--success)' : 'var(--text-muted)'}">
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
        const pct   = Math.round((1 - lot.available / lot.total) * 100);
        const level = crowdClass(pct);
        const el    = document.createElement('div');
        el.className = 'heatmap-zone';
        el.innerHTML = `
          <div class="heatmap-zone-header">
            <span class="heatmap-zone-name">${escapeHTML(lot.name)}</span>
            <span class="density-badge ${level}">${lot.available.toLocaleString()} spaces</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${level}" style="width:${pct}%"></div>
          </div>
          <div class="heatmap-prediction">${escapeHTML(lot.distance)} walk${lot.ev ? ' · ⚡ EV charging' : ''}${lot.accessible ? ' · ♿ Accessible' : ''}</div>`;
        container.appendChild(el);
    });
}

// ─── FOOD VIEW ───────────────────────────────────────────────────────────────
const FOOD_ICONS = { American: '🍔', Italian: '🍕', Beverages: '🥤', BBQ: '🍖', Vegan: '🥗', Mexican: '🌮', Mediterranean: '🥙', 'Premium American': '🥩', Café: '☕', Snacks: '🥨' };

function bindFoodFilters() {
    document.querySelectorAll('#dietary-filters .route-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#dietary-filters .route-chip').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
            chip.classList.add('active');
            chip.setAttribute('aria-pressed', 'true');
            selectedDiet = chip.dataset.diet;
            renderFoodView();
        });
    });
}

async function renderFoodView() {
    const ctx   = contextEngine.getSnapshot();
    let stalls  = Object.values(ctx.stadium.food);

    if (selectedDiet !== 'all') {
        const filtered = stalls.filter(s => s.dietary?.includes(selectedDiet));
        if (filtered.length) stalls = filtered;
    }
    stalls.sort((a, b) => a.queueTime - b.queueTime);

    const container = document.getElementById('food-list');
    if (container) {
        container.innerHTML = '';
        stalls.forEach((stall, idx) => {
            const waitColor = stall.queueTime > 20 ? 'var(--danger)' : stall.queueTime > 10 ? 'var(--warning)' : 'var(--success)';
            const tags      = (stall.dietary || []).filter(d => d !== 'none').map(d => `<span class="dietary-tag">${escapeHTML(d)}</span>`).join(' ');
            const card      = document.createElement('div');
            card.className  = 'food-card';
            card.style.animationDelay = `${idx * 0.04}s`;
            card.innerHTML  = `
              <div class="food-card-icon">${FOOD_ICONS[stall.cuisine] || '🍽️'}</div>
              <div class="food-card-info">
                <div class="food-card-name">${escapeHTML(stall.name)}</div>
                <div class="food-card-meta">
                  <span>📍 ${escapeHTML(stall.section)}</span>
                  <span>🚶 ${escapeHTML(stall.distance)}</span>
                  <span>${escapeHTML(stall.price || '')}</span>
                </div>
                ${stall.signature ? `<div class="food-signature text-xs text-muted mt-xs">${escapeHTML(stall.signature)}</div>` : ''}
                ${tags ? `<div style="margin-top:0.3rem">${tags}</div>` : ''}
              </div>
              <div class="food-card-right">
                <div class="food-wait-time" style="color:${waitColor}">${stall.queueTime}m</div>
                <div class="food-wait-label">Wait</div>
                <button class="btn btn-xs mt-xs" style="border-color:${waitColor};color:${waitColor}" data-stallid="${escapeHTML(stall.id)}" aria-label="Join virtual queue for ${escapeHTML(stall.name)}">Queue</button>
              </div>`;
            card.querySelector('button')?.addEventListener('click', e => joinVirtualQueue(e.target.dataset.stallid, stall.name, stall.queueTime));
            container.appendChild(card);
        });
    }

    const titleEl = document.getElementById('food-ai-title');
    const bodyEl  = document.getElementById('food-ai-body');
    const pref    = selectedDiet !== 'all' ? { dietary: [selectedDiet] } : {};
    const rec     = await geminiService.recommendFood(pref, ctx);
    if (rec?.trigger && rec.topPick) {
        if (titleEl) titleEl.textContent = `🍽️ Top Pick: ${rec.topPick.name} — ${rec.topPick.waitTime}min wait`;
        if (bodyEl) bodyEl.textContent = rec.message || rec.topPick.reason || '';
    } else if (stalls[0]) {
        if (titleEl) titleEl.textContent = `✅ Shortest queue now: ${stalls[0].name} (${stalls[0].queueTime}min)`;
        if (bodyEl) bodyEl.textContent = `${stalls[0].distance} · ${stalls[0].section}`;
    }
}

function joinVirtualQueue(stallId, stallName, queueTime) {
    const position = Math.floor(Math.random() * 8) + 2;
    const eta = Math.round(queueTime * 0.8);
    const banner = document.createElement('div');
    banner.className = 'queue-joined-banner';
    banner.innerHTML = `<div class="queue-position">#${position}</div><div><div style="font-weight:700;font-size:0.9rem">Joined: ${escapeHTML(stallName)}</div><div class="text-xs text-muted mt-xs">Estimated wait: ~${eta} min · We'll notify you when your turn approaches</div></div>`;
    document.getElementById('food-list')?.prepend(banner);
    contextEngine.addNotification({ title: `Joined queue: ${stallName}`, body: `Position #${position} — ~${eta} min wait`, type: 'info', category: 'food', action: 'food' });
    updateNavBadge('badge-food', 1);
}

// ─── MATCH DAY PLANNER ────────────────────────────────────────────────────────
function bindPlannerView() {
    document.getElementById('btn-refresh-plan')?.addEventListener('click', renderMatchDayPlanner);
    document.getElementById('btn-exit-planner')?.addEventListener('click', renderExitPlan);
}

async function renderMatchDayPlanner() {
    const container = document.getElementById('plan-items');
    const keyTip    = document.getElementById('plan-keytip');
    if (!container) return;

    showSkeleton('plan-items', 4);
    const ctx  = contextEngine.getSnapshot();
    const plan = await geminiService.generateMatchDayPlan(ctx);
    if (!plan) { container.innerHTML = '<div class="text-muted p-sm">Unable to generate plan — please try again.</div>'; return; }

    safeText('plan-title', plan.planTitle || 'Your Match Day Plan');
    if (keyTip) keyTip.textContent = plan.keyTip || '';

    container.innerHTML = '';
    (plan.items || []).forEach((item, i) => {
        const priorityClass = item.priority === 'high' ? 'plan-item-high' : '';
        const div = document.createElement('div');
        div.className = `plan-item ${priorityClass}`;
        div.style.animationDelay = `${i * 0.08}s`;
        div.innerHTML = `
          <div class="plan-item-time">${escapeHTML(item.time)}</div>
          <div class="plan-item-icon">${item.icon || '📌'}</div>
          <div class="plan-item-content">
            <div class="plan-item-title">${escapeHTML(item.title)}</div>
            <div class="plan-item-desc text-muted text-xs">${escapeHTML(item.description)}</div>
          </div>`;
        container.appendChild(div);
    });

    safeText('plan-walking', `~${plan.totalEstimatedWalkingMin || 25} min total walking`);
}

async function renderExitPlan() {
    const container = document.getElementById('exit-planner-content');
    if (!container) return;
    container.innerHTML = '<div style="padding:1rem;text-align:center"><i class="fa-solid fa-spinner spin-anim" style="color:var(--primary)"></i> Generating exit strategy...</div>';

    const ctx  = contextEngine.getSnapshot();
    const plan = await geminiService.generateExitStrategy(ctx);
    if (!plan) { container.innerHTML = '<div class="text-muted">Unable to generate exit plan.</div>'; return; }

    container.innerHTML = `
      <div class="exit-plan-card">
        <div class="exit-plan-row"><span class="exit-plan-label">⏰ Leave at:</span><span class="exit-plan-value">${escapeHTML(plan.optimalExitTime)}</span></div>
        <div class="exit-plan-row"><span class="exit-plan-label">🚪 Best exit:</span><span class="exit-plan-value text-success">${escapeHTML(plan.recommendedGate)}</span></div>
        <div class="exit-plan-row"><span class="exit-plan-label">🔄 Alternate:</span><span class="exit-plan-value">${escapeHTML(plan.alternateGate)}</span></div>
        <div class="exit-plan-row"><span class="exit-plan-label">🚆 Transport:</span><span class="exit-plan-value text-xs">${escapeHTML(plan.transportRecommendation)}</span></div>
      </div>
      <div class="section-label mt-sm">Step-by-step exit</div>
      ${(plan.steps || []).map(s => `<div class="emergency-step"><div class="emergency-step-icon">➤</div><div class="emergency-step-text">${escapeHTML(s)}</div></div>`).join('')}
      ${plan.insiderTip ? `<div class="ai-box mt-sm"><strong>💡 Insider Tip</strong><div class="text-muted text-xs mt-xs">${escapeHTML(plan.insiderTip)}</div></div>` : ''}`;
}

// ─── EMERGENCY VIEW ──────────────────────────────────────────────────────────
function bindEmergencyView() {
    const types = { fire: 'fire', medical: 'medical', evacuate: 'evacuation', security: 'security' };
    Object.entries(types).forEach(([btnId, type]) => {
        document.getElementById(`btn-emergency-${btnId}`)?.addEventListener('click', () => triggerEmergencyPlan(type));
    });
    document.getElementById('btn-exit-planner')?.addEventListener('click', renderExitPlan);
}

function bindHeaderButtons() {
    document.getElementById('btn-fan-emergency-header')?.addEventListener('click', () => switchFanTab('emergency'));
}

async function triggerEmergencyPlan(type) {
    contextEngine.triggerEmergency(type);

    const planCard = document.getElementById('emergency-plan-card');
    const stepsEl  = document.getElementById('emergency-steps');
    const broadEl  = document.getElementById('emergency-broadcast');
    if (planCard) planCard.classList.remove('hidden');
    if (stepsEl) stepsEl.innerHTML = '<div style="padding:1rem;text-align:center"><i class="fa-solid fa-spinner spin-anim" style="color:var(--danger)"></i> Generating emergency plan...</div>';

    const ctx  = contextEngine.getSnapshot();
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

    // Show global overlay
    showGlobalEmergencyOverlay(type);
}

function renderExitList() {
    const container = document.getElementById('exit-list');
    if (!container) return;
    container.innerHTML = '';
    const gates = Object.values(contextEngine.getLiveState().gates).filter(g => g.status === 'open' && !g.isStaff).sort((a, b) => a.crowdLevel - b.crowdLevel);
    gates.slice(0, 5).forEach((gate, i) => {
        const el = document.createElement('div');
        el.className = 'stat-row';
        el.innerHTML = `<span class="stat-label">${i === 0 ? '🟢' : '🟡'} ${escapeHTML(gate.name)} — ${escapeHTML(gate.direction)}</span><span class="stat-value text-xs">${gate.avgWait} min wait · ${gate.crowdLevel.toFixed(0)}% full</span>`;
        container.appendChild(el);
    });
}

// ─── Global Emergency Overlay (accessed from app.js) ────────────────────────
export function showGlobalEmergencyOverlay(type) {
    const overlay = document.getElementById('emergency-overlay');
    const border  = document.getElementById('emergency-border');
    if (!overlay) return;
    const typeLabels = { fire: '🔥 FIRE', medical: '🚑 MEDICAL', evacuation: '🚨 EVACUATE', security: '🛡️ SECURITY' };
    const bestGate = contextEngine.getBestGate();
    overlay.innerHTML = `
      <div class="emergency-sos-header">
        <div class="emergency-sos-label">${typeLabels[type] || '🚨 EMERGENCY'}</div>
        <div class="emergency-sos-title">Move to ${bestGate?.name || 'Gate B'}</div>
        <div class="emergency-sos-sub">Follow orange signs · Do not use elevators</div>
        <div class="emergency-sos-number">📞 Emergency: 911</div>
        <button class="btn btn-sm mt-md" id="btn-clear-emergency" style="background:rgba(255,255,255,0.2);border-color:white;color:white;">Clear Emergency</button>
      </div>`;
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    if (border) border.classList.remove('hidden');
    document.getElementById('btn-clear-emergency')?.addEventListener('click', () => {
        overlay.style.display = 'none';
        if (border) border.classList.add('hidden');
        contextEngine.clearEmergency();
    });
}
