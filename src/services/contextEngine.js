// src/services/contextEngine.js
// AI Context Engine — Single Source of Truth for all Gemini interactions
// Every AI function draws context from here. No duplicated state building.

import { stadiumData, simulateLiveUpdates, startSimulation } from './mock_data.js';

// ─── User Profile ───────────────────────────────────────────────────────────
const userProfile = {
    role: 'fan',          // fan | organizer | volunteer | staff
    name: 'Match Fan',
    seat: 'A-214',
    gate: 'Gate B',
    section: 'North Stand',
    ticketId: 'FIFA-2026-7741-A',
    language: 'en',       // en | es | fr | ar | hi | ja | pt
    accessibility: {
        wheelchair: false,
        visuallyImpaired: false,
        senior: false,
        familyWithChildren: false,
    },
    preferences: {
        dietaryRestrictions: [],   // vegetarian, halal, vegan, gluten-free
        walkingSpeed: 'normal',    // slow | normal | fast
    },
    location: {
        zone: 'Parking Lot C',
        lat: null,
        lng: null,
    },
};

// ─── Match Context ───────────────────────────────────────────────────────────
const matchContext = {
    homeTeam: 'Brazil',
    awayTeam: 'Germany',
    venue: 'MetLife Stadium, New York',
    kickoff: '21:00 EST',
    currentPhase: 'Pre-Match',  // Pre-Match | First Half | Half Time | Second Half | Post-Match
    score: '0 - 0',
    minutesUntilKickoff: 47,
    attendance: 82000,
    capacity: 82500,
};

// ─── Live Stadium State ──────────────────────────────────────────────────────
// Pulled from mock_data.js (or Firestore when configured)
let liveState = {
    gates: {},
    food: {},
    zones: {},
    parking: {},
    medical: {},
    volunteers: {},
    weather: {},
    transport: {},
    sustainability: {},
    emergencyActive: false,
    emergencyType: null,
    alerts: [],
};

// ─── Conversation History ────────────────────────────────────────────────────
let conversationHistory = [];

// ─── Emergency State ─────────────────────────────────────────────────────────
let emergencyState = {
    active: false,
    type: null,          // fire | medical | evacuation | security
    nearestExit: null,
    nearestMedical: null,
    evacuationRoute: null,
    broadcastMessage: null,
};

// ─── Initialize Engine ───────────────────────────────────────────────────────
function init() {
    // Seed live state from mock data
    liveState.gates = { ...stadiumData.gates };
    liveState.food = { ...stadiumData.food };
    liveState.zones = { ...stadiumData.zones };
    liveState.parking = { ...stadiumData.parking };
    liveState.medical = { ...stadiumData.medical };
    liveState.volunteers = { ...stadiumData.volunteers };
    liveState.weather = { ...stadiumData.weather };
    liveState.transport = { ...stadiumData.transport };
    liveState.sustainability = { ...stadiumData.sustainability };
    liveState.alerts = [...stadiumData.alerts];

    // Start live simulation
    startSimulation((updated) => {
        Object.assign(liveState.gates, updated.gates);
        Object.assign(liveState.food, updated.food);
        Object.assign(liveState.zones, updated.zones);
        Object.assign(liveState.parking, updated.parking);
        Object.assign(liveState.sustainability, updated.sustainability);
    });

    console.log('[ContextEngine] Initialized successfully.');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns a complete snapshot of all context for use in AI prompts.
 * This is the single object passed to every Gemini function.
 */
function getSnapshot() {
    return {
        user: { ...userProfile },
        match: { ...matchContext },
        stadium: {
            gates: { ...liveState.gates },
            food: { ...liveState.food },
            zones: { ...liveState.zones },
            parking: { ...liveState.parking },
            medical: { ...liveState.medical },
            volunteers: { ...liveState.volunteers },
            weather: { ...liveState.weather },
            transport: { ...liveState.transport },
            sustainability: { ...liveState.sustainability },
            alerts: [...liveState.alerts],
        },
        emergency: { ...emergencyState },
        conversationHistory: conversationHistory.slice(-6), // last 6 turns for context
        timestamp: new Date().toISOString(),
    };
}

/**
 * Get live state directly (for UI rendering without AI)
 */
function getLiveState() {
    return liveState;
}

/**
 * Get match context
 */
function getMatch() {
    return matchContext;
}

/**
 * Get user profile
 */
function getUser() {
    return userProfile;
}

/**
 * Update user profile fields
 */
function updateUser(fields) {
    Object.assign(userProfile, fields);
}

/**
 * Update user accessibility flags
 */
function setAccessibility(flags) {
    Object.assign(userProfile.accessibility, flags);
}

/**
 * Set user language preference
 */
function setLanguage(lang) {
    userProfile.language = lang;
}

/**
 * Add a message to conversation history
 */
function addToHistory(role, content) {
    conversationHistory.push({
        role, // 'user' | 'model'
        content,
        timestamp: new Date().toISOString(),
    });
    // Keep only last 20 turns
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }
}

/**
 * Clear conversation history
 */
function clearHistory() {
    conversationHistory = [];
}

/**
 * Get conversation history
 */
function getHistory() {
    return [...conversationHistory];
}

/**
 * Activate emergency mode
 */
function triggerEmergency(type = 'evacuation') {
    emergencyState.active = true;
    emergencyState.type = type;
    liveState.emergencyActive = true;
    liveState.emergencyType = type;

    // Auto-find nearest exit and medical from mock data
    const openGates = Object.values(liveState.gates).filter(g => g.status === 'open');
    emergencyState.nearestExit = openGates.sort((a, b) => a.crowdLevel - b.crowdLevel)[0] || null;
    emergencyState.nearestMedical = Object.values(liveState.medical)[0] || null;

    console.warn('[ContextEngine] EMERGENCY ACTIVATED:', type);
}

/**
 * Deactivate emergency mode
 */
function clearEmergency() {
    emergencyState.active = false;
    emergencyState.type = null;
    liveState.emergencyActive = false;
    liveState.emergencyType = null;
}

/**
 * Update live state from external source (Firestore, Maps API, etc.)
 * This is the single hook to swap mock data for real data.
 */
function updateFromRealAPI(data) {
    if (data.gates) Object.assign(liveState.gates, data.gates);
    if (data.food) Object.assign(liveState.food, data.food);
    if (data.zones) Object.assign(liveState.zones, data.zones);
    if (data.parking) Object.assign(liveState.parking, data.parking);
    if (data.alerts) liveState.alerts = data.alerts;
}

/**
 * Get best gate recommendation (local logic — fast, no AI needed)
 */
function getBestGate() {
    const open = Object.values(liveState.gates).filter(g => g.status === 'open');
    return open.sort((a, b) => a.crowdLevel - b.crowdLevel)[0] || null;
}

/**
 * Get fastest food option (local logic)
 */
function getFastestFood() {
    const stalls = Object.values(liveState.food);
    return stalls.sort((a, b) => a.queueTime - b.queueTime)[0] || null;
}

/**
 * Get overall crowd level (0-100)
 */
function getOverallCrowdLevel() {
    const zones = Object.values(liveState.zones);
    if (!zones.length) return 0;
    return Math.round(zones.reduce((sum, z) => sum + z.density, 0) / zones.length);
}

/**
 * Set user role (fan | organizer | volunteer | staff)
 */
function setRole(role) {
    userProfile.role = role;
    console.log('[ContextEngine] Role set to:', role);
}

export const contextEngine = {
    init,
    getSnapshot,
    getLiveState,
    getMatch,
    getUser,
    updateUser,
    setAccessibility,
    setLanguage,
    setRole,
    addToHistory,
    clearHistory,
    getHistory,
    triggerEmergency,
    clearEmergency,
    updateFromRealAPI,
    getBestGate,
    getFastestFood,
    getOverallCrowdLevel,
};
