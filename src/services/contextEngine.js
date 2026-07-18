/**
 * src/services/contextEngine.js
 * StadiumFlow AI — Global Context Engine (v2)
 *
 * The single source of truth for ALL state in the application.
 * Every AI function, every render, every recommendation draws from here.
 *
 * Architecture: contextEngine is stateful and imperative by design —
 * no frameworks, no reactive stores — keeping it universally compatible.
 *
 * Data domains: user | match | stadium | emergency | conversation |
 *               notifications | sustainability | proactive | meta
 */

import { METLIFE_STADIUM } from '../data/metlife_stadium.js';
import { MATCH, getCurrentMatchPhase, getCurrentMatchMinute, getMinutesUntilKickoff } from '../data/match_schedule.js';
import { startSimulation, setGateStatus } from './simulation.js';

// ─── User Profile ────────────────────────────────────────────────────────────
const userProfile = {
    role: 'fan',           // fan | organizer | volunteer | staff
    name: 'Match Fan',
    seat: MATCH.ticketInfo.seat,
    gate: MATCH.ticketInfo.gate,
    section: MATCH.ticketInfo.section,
    stand: MATCH.ticketInfo.stand,
    ticketId: MATCH.ticketInfo.id,
    ticketType: MATCH.ticketInfo.type,
    barcodeValue: MATCH.ticketInfo.barcodeValue,
    language: 'en',        // en | es | fr | ar | hi | ja | pt
    accessibility: {
        wheelchair: false,
        visuallyImpaired: false,
        hearingImpaired: false,
        senior: false,
        familyWithChildren: false,
    },
    preferences: {
        dietaryRestrictions: [],    // vegetarian | halal | vegan | gluten-free
        walkingSpeed: 'normal',     // slow | normal | fast
        notificationsEnabled: true,
        highContrast: false,
    },
    location: {
        zone: 'Green Lot 6 — East Parking',
        area: 'parking',            // parking | concourse | gate | seat | food
        gate: null,
        lat: 40.8135,
        lng: -74.0745,
    },
};

// ─── Live Stadium State ───────────────────────────────────────────────────────
// Seeded from METLIFE_STADIUM; continuously updated by simulation.
let liveState = {
    gates:          {},
    food:           {},
    zones:          {},
    parking:        {},
    medical:        { ...METLIFE_STADIUM.medical },
    volunteers:     { ...METLIFE_STADIUM.volunteers },
    weather:        { ...METLIFE_STADIUM.weather },
    transport:      { ...METLIFE_STADIUM.transport },
    sustainability: {},
    alerts:         [],
    incidents:      [...METLIFE_STADIUM.incidents],
    emergencyActive: false,
    emergencyType:  null,
};

// ─── Emergency State ──────────────────────────────────────────────────────────
let emergencyState = {
    active: false,
    type: null,              // fire | medical | evacuation | security | lost-child
    activatedAt: null,
    nearestExit: null,
    nearestMedical: null,
    evacuationRoute: null,
    broadcastMessage: null,
    assemblyPoint: null,
};

// ─── Conversation History ─────────────────────────────────────────────────────
let conversationHistory = [];

// ─── Notification Queue ───────────────────────────────────────────────────────
let notifications = [];
let _notifIdCounter = 1;
let _dismissedIds = new Set();

// ─── Proactive AI State ───────────────────────────────────────────────────────
let proactiveState = {
    lastSuggestion: null,        // { title, body, urgency, action, timestamp }
    nextSuggestionDue: Date.now(),
    suppressedUntil: 0,
};

// ─── Incidents ────────────────────────────────────────────────────────────────
let incidents = [];
let _incidentIdCounter = 1;

// ─── Initialize ───────────────────────────────────────────────────────────────
function init() {
    // Seed live state from real MetLife data
    liveState.gates          = JSON.parse(JSON.stringify(METLIFE_STADIUM.gates));
    liveState.food           = JSON.parse(JSON.stringify(METLIFE_STADIUM.food));
    liveState.zones          = JSON.parse(JSON.stringify(METLIFE_STADIUM.zones));
    liveState.parking        = JSON.parse(JSON.stringify(METLIFE_STADIUM.parking));
    liveState.sustainability = JSON.parse(JSON.stringify(METLIFE_STADIUM.sustainability));
    liveState.alerts         = [...METLIFE_STADIUM.alerts];

    // Start match-phase-aware simulation
    startSimulation((snapshot) => {
        // Apply gate updates
        for (const id in snapshot.gates) {
            if (liveState.gates[id]) Object.assign(liveState.gates[id], snapshot.gates[id]);
        }
        // Apply food updates
        for (const id in snapshot.food) {
            if (liveState.food[id]) Object.assign(liveState.food[id], snapshot.food[id]);
        }
        // Apply zone updates
        for (const id in snapshot.zones) {
            if (liveState.zones[id]) Object.assign(liveState.zones[id], snapshot.zones[id]);
        }
        // Apply parking updates
        for (const id in snapshot.parking) {
            if (liveState.parking[id]) Object.assign(liveState.parking[id], snapshot.parking[id]);
        }
        // Apply sustainability updates
        Object.assign(liveState.sustainability, snapshot.sustainability);

        // Inject any auto-generated alerts (max 10 stored)
        if (snapshot.newAlerts?.length) {
            liveState.alerts = [...snapshot.newAlerts, ...liveState.alerts].slice(0, 10);
            // Also queue as notifications if urgent
            snapshot.newAlerts.forEach(a => {
                if (a.type === 'warning' || a.type === 'danger') {
                    addNotification({ title: a.message, body: '', type: a.type, category: a.category });
                }
            });
        }
    });

    console.log('[ContextEngine] Initialized — MetLife Stadium data loaded.');
}

// ─── Full Context Snapshot ────────────────────────────────────────────────────
/**
 * Returns a complete, immutable snapshot of all context for AI prompts.
 * This single object is passed to every Gemini AI function.
 */
function getSnapshot() {
    const matchMinute   = getCurrentMatchMinute();
    const matchPhase    = getCurrentMatchPhase();
    const minsToKickoff = getMinutesUntilKickoff();

    return {
        user: { ...userProfile },
        match: {
            ...MATCH,
            currentPhase:        matchPhase,
            matchMinute,
            minutesUntilKickoff: minsToKickoff,
            score:               liveState.score || MATCH.score,
            attendance:          MATCH.attendance,
            capacity:            MATCH.capacity,
        },
        stadium: {
            name:           METLIFE_STADIUM.name,
            address:        METLIFE_STADIUM.address,
            capacity:       METLIFE_STADIUM.capacity,
            gates:          { ...liveState.gates },
            food:           { ...liveState.food },
            zones:          { ...liveState.zones },
            parking:        { ...liveState.parking },
            medical:        { ...liveState.medical },
            volunteers:     { ...liveState.volunteers },
            weather:        { ...liveState.weather },
            transport:      { ...liveState.transport },
            sustainability: { ...liveState.sustainability },
            alerts:         [...liveState.alerts],
            incidents:      [...incidents],
            emergencyExits: { ...METLIFE_STADIUM.emergencyExits },
        },
        emergency:    { ...emergencyState },
        notifications: notifications.filter(n => !_dismissedIds.has(n.id)).slice(0, 5),
        proactive:    { ...proactiveState },
        conversationHistory: conversationHistory.slice(-6),
        meta: {
            timestamp:    new Date().toISOString(),
            matchMinute,
            matchPhase,
            minsToKickoff,
            simPhase:     matchPhase,
        },
    };
}

// ─── User API ─────────────────────────────────────────────────────────────────
function getLiveState()  { return liveState; }
function getMatch()      { return { ...MATCH, currentPhase: getCurrentMatchPhase(), minutesUntilKickoff: getMinutesUntilKickoff(), matchMinute: getCurrentMatchMinute() }; }
function getUser()       { return userProfile; }

function setRole(role) {
    userProfile.role = role;
    console.log('[ContextEngine] Role:', role);
}

function updateUser(fields) { Object.assign(userProfile, fields); }

function setAccessibility(flags) { Object.assign(userProfile.accessibility, flags); }

function setLanguage(lang) { userProfile.language = lang; }

function updateUserLocation(zone, area) {
    userProfile.location.zone = zone;
    userProfile.location.area = area;
}

// ─── Conversation History ─────────────────────────────────────────────────────
function addToHistory(role, content) {
    conversationHistory.push({ role, content, timestamp: new Date().toISOString() });
    if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);
}

function clearHistory() { conversationHistory = []; }

function getHistory() { return [...conversationHistory]; }

// ─── Notifications ────────────────────────────────────────────────────────────
/**
 * Add a new notification to the queue.
 * @param {{ title: string, body: string, type: string, category: string, action?: string }} notif
 */
function addNotification({ title, body = '', type = 'info', category = 'general', action = null }) {
    const id = `notif_${_notifIdCounter++}`;
    notifications.unshift({ id, title, body, type, category, action, timestamp: new Date().toISOString(), read: false });
    if (notifications.length > 20) notifications = notifications.slice(0, 20);
    return id;
}

function getNotifications() { return notifications.filter(n => !_dismissedIds.has(n.id)); }

function getUnreadCount() { return notifications.filter(n => !n.read && !_dismissedIds.has(n.id)).length; }

function dismissNotification(id) { _dismissedIds.add(id); }

function markNotificationsRead() { notifications.forEach(n => { n.read = true; }); }

// ─── Proactive AI ─────────────────────────────────────────────────────────────
function setProactiveSuggestion(suggestion) {
    proactiveState.lastSuggestion = { ...suggestion, timestamp: new Date().toISOString() };
    proactiveState.nextSuggestionDue = Date.now() + (2 * 60 * 1000); // 2 minutes
}

function shouldRefreshProactive() {
    return Date.now() >= proactiveState.nextSuggestionDue
        && Date.now() > proactiveState.suppressedUntil;
}

function suppressProactive(ms = 300000) { // default 5 min suppression
    proactiveState.suppressedUntil = Date.now() + ms;
}

// ─── Emergency ────────────────────────────────────────────────────────────────
function triggerEmergency(type = 'evacuation') {
    emergencyState.active      = true;
    emergencyState.type        = type;
    emergencyState.activatedAt = new Date().toISOString();
    liveState.emergencyActive  = true;
    liveState.emergencyType    = type;

    // Find least-crowded open gate as nearest exit
    const openGates = Object.values(liveState.gates).filter(g => g.status === 'open' && !g.isStaff && !g.isVIP);
    emergencyState.nearestExit     = openGates.sort((a, b) => a.crowdLevel - b.crowdLevel)[0] || null;
    emergencyState.nearestMedical  = Object.values(liveState.medical).filter(m => m.available)[0] || null;
    emergencyState.assemblyPoint   = METLIFE_STADIUM.emergencyExits.south_assembly;
    emergencyState.broadcastMessage = `⚠️ ATTENTION ALL FANS: ${type === 'fire' ? 'Fire alarm activated.' : type === 'medical' ? 'Medical emergency being addressed.' : 'Please proceed calmly to the nearest exit.'} Follow staff and orange emergency signs. Do not use elevators.`;

    console.warn('[ContextEngine] EMERGENCY:', type);
}

function clearEmergency() {
    emergencyState.active         = false;
    emergencyState.type           = null;
    emergencyState.activatedAt    = null;
    emergencyState.broadcastMessage = null;
    liveState.emergencyActive     = false;
    liveState.emergencyType       = null;
}

// ─── Incidents ────────────────────────────────────────────────────────────────
function addIncident({ type, location, description, severity = 'low' }) {
    const incident = {
        id: `incident_${_incidentIdCounter++}`,
        type, location, description, severity,
        timestamp: new Date().toISOString(),
        resolved: false,
    };
    incidents.unshift(incident);
    if (incidents.length > 50) incidents = incidents.slice(0, 50);
    return incident.id;
}

function resolveIncident(id) {
    const inc = incidents.find(i => i.id === id);
    if (inc) inc.resolved = true;
}

function getIncidents(includeResolved = false) {
    return incidents.filter(i => includeResolved || !i.resolved);
}

// ─── Gate Control (for Staff) ─────────────────────────────────────────────────
function toggleGate(gateId) {
    const gate = liveState.gates[gateId];
    if (!gate) return;
    const newStatus = gate.status === 'open' ? 'closed' : 'open';
    gate.status = newStatus;
    setGateStatus(gateId, newStatus); // also update simulation
    console.log(`[ContextEngine] Gate ${gateId} toggled to ${newStatus}`);
    return newStatus;
}

// ─── Quick Local Computations (no AI needed) ──────────────────────────────────
function getBestGate() {
    const open = Object.values(liveState.gates).filter(g => g.status === 'open' && !g.isStaff && !g.isVIP);
    return open.sort((a, b) => a.crowdLevel - b.crowdLevel)[0] || null;
}

function getFastestFood(dietaryFilter = null) {
    let stalls = Object.values(liveState.food);
    if (dietaryFilter) stalls = stalls.filter(s => s.dietary?.includes(dietaryFilter));
    return stalls.sort((a, b) => a.queueTime - b.queueTime)[0] || null;
}

function getOverallCrowdLevel() {
    const zones = Object.values(liveState.zones);
    if (!zones.length) return 0;
    return Math.round(zones.reduce((sum, z) => sum + z.density, 0) / zones.length);
}

function getBestParking() {
    return Object.values(liveState.parking).sort((a, b) => b.available - a.available)[0] || null;
}

/**
 * Hook for external data (Firestore, Maps, real APIs).
 * Swap mock data for real data seamlessly.
 */
function updateFromRealAPI(data) {
    if (data.gates)          for (const id in data.gates) { if (liveState.gates[id]) Object.assign(liveState.gates[id], data.gates[id]); }
    if (data.food)           for (const id in data.food)  { if (liveState.food[id]) Object.assign(liveState.food[id], data.food[id]); }
    if (data.zones)          Object.assign(liveState.zones, data.zones);
    if (data.parking)        Object.assign(liveState.parking, data.parking);
    if (data.alerts)         liveState.alerts = data.alerts;
    if (data.weather)        Object.assign(liveState.weather, data.weather);
    if (data.transport)      Object.assign(liveState.transport, data.transport);
    if (data.sustainability) Object.assign(liveState.sustainability, data.sustainability);
}

// ─── Public Export ────────────────────────────────────────────────────────────
export const contextEngine = {
    // Core
    init,
    getSnapshot,
    getLiveState,
    getMatch,
    getUser,

    // User
    setRole,
    updateUser,
    setAccessibility,
    setLanguage,
    updateUserLocation,

    // Conversation
    addToHistory,
    clearHistory,
    getHistory,

    // Notifications
    addNotification,
    getNotifications,
    getUnreadCount,
    dismissNotification,
    markNotificationsRead,

    // Proactive
    setProactiveSuggestion,
    shouldRefreshProactive,
    suppressProactive,

    // Emergency
    triggerEmergency,
    clearEmergency,

    // Incidents
    addIncident,
    resolveIncident,
    getIncidents,

    // Gate Control
    toggleGate,

    // Quick computations
    getBestGate,
    getFastestFood,
    getOverallCrowdLevel,
    getBestParking,

    // External API hook
    updateFromRealAPI,
};
