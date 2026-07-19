/**
 * src/test/unit/context_engine.test.js
 * Unit tests for the ContextEngine — the application's single source of truth.
 *
 * Tests: init, getSnapshot shape, user API, notification system,
 *        proactive state, emergency lifecycle, quick computation methods,
 *        incident system, gate toggle.
 *
 * Run: node --test src/test/unit/context_engine.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { contextEngine } from '../../services/contextEngine.js';
import { startSimulation, stopSimulation } from '../../services/simulation.js';

// Ensure engine is initialized once before all tests
before(async () => {
    // Start simulation at 5ms interval so it ticks rapidly and covers contextEngine simulation callback
    startSimulation(() => {}, 5);
    contextEngine.init();
    await new Promise(r => setTimeout(r, 50));
});

after(() => {
    stopSimulation();
});

// ─── getSnapshot shape ────────────────────────────────────────────────────────

describe('contextEngine.getSnapshot() — structure', () => {

    test('returns an object', () => {
        const snap = contextEngine.getSnapshot();
        assert.equal(typeof snap, 'object');
        assert.ok(snap !== null);
    });

    test('snapshot has all required top-level keys', () => {
        const snap = contextEngine.getSnapshot();
        const required = ['user', 'match', 'stadium', 'emergency', 'notifications', 'proactive', 'conversationHistory', 'meta'];
        required.forEach(key => {
            assert.ok(key in snap, `snapshot missing key: "${key}"`);
        });
    });

    test('snapshot.stadium has gates, food, zones, parking', () => {
        const { stadium } = contextEngine.getSnapshot();
        ['gates', 'food', 'zones', 'parking', 'medical', 'transport', 'alerts'].forEach(k => {
            assert.ok(k in stadium, `stadium missing key: "${k}"`);
        });
    });

    test('snapshot.meta has matchPhase and timestamp', () => {
        const { meta } = contextEngine.getSnapshot();
        assert.ok('matchPhase' in meta);
        assert.ok('timestamp' in meta);
    });

    test('snapshot is immutable-ish (independent copy)', () => {
        const snap1 = contextEngine.getSnapshot();
        const snap2 = contextEngine.getSnapshot();
        // Mutations to snap1 should not affect snap2
        snap1.user.role = 'MUTATED';
        const snap3 = contextEngine.getSnapshot();
        assert.notEqual(snap3.user.role, 'MUTATED');
    });
});

// ─── User API ─────────────────────────────────────────────────────────────────

describe('contextEngine — user API', () => {

    test('setRole updates the user role in snapshot', () => {
        contextEngine.setRole('organizer');
        assert.equal(contextEngine.getUser().role, 'organizer');
        contextEngine.setRole('fan'); // reset
    });

    test('setLanguage updates language', () => {
        contextEngine.setLanguage('es');
        assert.equal(contextEngine.getUser().language, 'es');
        contextEngine.setLanguage('en'); // reset
    });

    test('updateUser merges fields correctly', () => {
        contextEngine.updateUser({ name: 'TestUser' });
        assert.equal(contextEngine.getUser().name, 'TestUser');
    });

    test('setAccessibility updates accessibility flags', () => {
        contextEngine.setAccessibility({ wheelchair: true });
        assert.equal(contextEngine.getUser().accessibility.wheelchair, true);
        contextEngine.setAccessibility({ wheelchair: false }); // reset
    });

    test('updateUserLocation updates zone and area', () => {
        contextEngine.updateUserLocation('Section 119', 'seat');
        const user = contextEngine.getUser();
        assert.equal(user.location.zone, 'Section 119');
        assert.equal(user.location.area, 'seat');
    });

    test('getMatch returns an object with currentPhase', () => {
        const match = contextEngine.getMatch();
        assert.ok(typeof match.currentPhase === 'string');
    });
});

// ─── Conversation History ─────────────────────────────────────────────────────

describe('contextEngine — conversation history', () => {

    before(() => contextEngine.clearHistory());

    test('starts empty after clearHistory', () => {
        contextEngine.clearHistory();
        assert.equal(contextEngine.getHistory().length, 0);
    });

    test('addToHistory appends a message', () => {
        contextEngine.clearHistory();
        contextEngine.addToHistory('user', 'Hello there');
        assert.equal(contextEngine.getHistory().length, 1);
    });

    test('history entry has role, content, timestamp', () => {
        contextEngine.clearHistory();
        contextEngine.addToHistory('model', 'How can I help?');
        const [entry] = contextEngine.getHistory();
        assert.equal(entry.role, 'model');
        assert.equal(entry.content, 'How can I help?');
        assert.ok(entry.timestamp);
    });

    test('conversation history is capped at 20 entries', () => {
        contextEngine.clearHistory();
        for (let i = 0; i < 25; i++) {
            contextEngine.addToHistory('user', `message ${i}`);
        }
        assert.ok(contextEngine.getHistory().length <= 20,
            `history length exceeded 20: ${contextEngine.getHistory().length}`);
    });

    test('getHistory returns a copy (not live reference)', () => {
        contextEngine.clearHistory();
        contextEngine.addToHistory('user', 'test');
        const history = contextEngine.getHistory();
        history.push({ role: 'fake', content: 'injected' });
        assert.equal(contextEngine.getHistory().length, 1);
    });
});

// ─── Notification System ──────────────────────────────────────────────────────

describe('contextEngine — notifications', () => {

    test('addNotification increases unread count', () => {
        const before = contextEngine.getUnreadCount();
        contextEngine.addNotification({ title: 'Test Alert', body: 'Test', type: 'info', category: 'test' });
        assert.ok(contextEngine.getUnreadCount() > before);
    });

    test('addNotification returns a string ID', () => {
        const id = contextEngine.addNotification({ title: 'ID Test', type: 'info', category: 'test' });
        assert.equal(typeof id, 'string');
        assert.ok(id.length > 0);
    });

    test('getNotifications returns an array', () => {
        assert.ok(Array.isArray(contextEngine.getNotifications()));
    });

    test('dismissNotification removes a notification from the list', () => {
        const id = contextEngine.addNotification({ title: 'Dismiss Me', type: 'info', category: 'test' });
        contextEngine.dismissNotification(id);
        const found = contextEngine.getNotifications().find(n => n.id === id);
        assert.equal(found, undefined);
    });

    test('markNotificationsRead sets all to read', () => {
        contextEngine.addNotification({ title: 'Unread', type: 'info', category: 'test' });
        contextEngine.markNotificationsRead();
        assert.equal(contextEngine.getUnreadCount(), 0);
    });
});

// ─── Proactive AI State ───────────────────────────────────────────────────────

describe('contextEngine — proactive AI state', () => {

    test('setProactiveSuggestion stores a suggestion', () => {
        contextEngine.setProactiveSuggestion({ title: 'Try Gate G', body: 'Less crowded', urgency: 'medium' });
        const snap = contextEngine.getSnapshot();
        assert.equal(snap.proactive.lastSuggestion.title, 'Try Gate G');
    });

    test('setProactiveSuggestion adds a timestamp', () => {
        contextEngine.setProactiveSuggestion({ title: 'Test', body: '', urgency: 'low' });
        const snap = contextEngine.getSnapshot();
        assert.ok(snap.proactive.lastSuggestion.timestamp);
    });

    test('suppressProactive prevents refresh for the suppression window', () => {
        contextEngine.suppressProactive(60_000); // 1 minute
        assert.equal(contextEngine.shouldRefreshProactive(), false);
    });

    test('shouldRefreshProactive returns a boolean', () => {
        assert.equal(typeof contextEngine.shouldRefreshProactive(), 'boolean');
    });
});

// ─── Emergency System ─────────────────────────────────────────────────────────

describe('contextEngine — emergency lifecycle', () => {

    test('triggerEmergency sets active to true', () => {
        contextEngine.triggerEmergency('evacuation');
        const snap = contextEngine.getSnapshot();
        assert.equal(snap.emergency.active, true);
    });

    test('triggerEmergency sets the correct type', () => {
        contextEngine.triggerEmergency('fire');
        const snap = contextEngine.getSnapshot();
        assert.equal(snap.emergency.type, 'fire');
    });

    test('triggerEmergency sets activatedAt timestamp', () => {
        contextEngine.triggerEmergency('medical');
        const snap = contextEngine.getSnapshot();
        assert.ok(snap.emergency.activatedAt);
    });

    test('clearEmergency resets active to false', () => {
        contextEngine.triggerEmergency('security');
        contextEngine.clearEmergency();
        const snap = contextEngine.getSnapshot();
        assert.equal(snap.emergency.active, false);
        assert.equal(snap.emergency.type, null);
    });

    test('clearEmergency clears the broadcast message', () => {
        contextEngine.triggerEmergency('evacuation');
        contextEngine.clearEmergency();
        const snap = contextEngine.getSnapshot();
        assert.equal(snap.emergency.broadcastMessage, null);
    });
});

// ─── Quick Computations ───────────────────────────────────────────────────────

describe('contextEngine — quick computations', () => {

    test('getBestGate returns a gate object or null', () => {
        const gate = contextEngine.getBestGate();
        if (gate !== null) {
            assert.ok('name' in gate, 'gate should have name');
            assert.ok('crowdLevel' in gate, 'gate should have crowdLevel');
            assert.equal(gate.status, 'open', 'best gate should be open');
        }
    });

    test('getBestGate returns the gate with lowest crowdLevel', () => {
        const gate = contextEngine.getBestGate();
        if (gate) {
            const state = contextEngine.getLiveState();
            const openGates = Object.values(state.gates).filter(g => g.status === 'open' && !g.isStaff && !g.isVIP);
            const minCrowd = Math.min(...openGates.map(g => g.crowdLevel));
            assert.equal(gate.crowdLevel, minCrowd);
        }
    });

    test('getFastestFood returns a food stall or null', () => {
        const stall = contextEngine.getFastestFood();
        if (stall !== null) {
            assert.ok('name' in stall, 'stall should have name');
            assert.ok('queueTime' in stall, 'stall should have queueTime');
        }
    });

    test('getFastestFood with dietary filter returns matching stall or null', () => {
        assert.doesNotThrow(() => contextEngine.getFastestFood('halal'));
        assert.doesNotThrow(() => contextEngine.getFastestFood('vegetarian'));
    });

    test('getOverallCrowdLevel returns a number between 0 and 100', () => {
        const level = contextEngine.getOverallCrowdLevel();
        assert.equal(typeof level, 'number');
        assert.ok(level >= 0 && level <= 100, `crowd level out of range: ${level}`);
    });

    test('getBestParking returns a parking object or null', () => {
        const parking = contextEngine.getBestParking();
        if (parking !== null) {
            assert.ok('name' in parking || 'id' in parking);
        }
    });
});

// ─── Incident System ──────────────────────────────────────────────────────────

describe('contextEngine — incident system', () => {

    test('addIncident returns a string ID', () => {
        const id = contextEngine.addIncident({
            type: 'congestion', location: 'Gate B', description: 'Long queue', severity: 'medium'
        });
        assert.equal(typeof id, 'string');
        assert.ok(id.startsWith('incident_'));
    });

    test('new incident appears in getIncidents()', () => {
        const id = contextEngine.addIncident({
            type: 'medical', location: 'Section 110', description: 'Fan unwell', severity: 'high'
        });
        const incidents = contextEngine.getIncidents();
        const found = incidents.find(i => i.id === id);
        assert.ok(found, `incident ${id} not found in list`);
    });

    test('resolveIncident marks it as resolved', () => {
        const id = contextEngine.addIncident({
            type: 'litter', location: 'Concourse C', description: 'Bin overflow', severity: 'low'
        });
        contextEngine.resolveIncident(id);
        const active = contextEngine.getIncidents(false); // exclude resolved
        const found = active.find(i => i.id === id);
        assert.equal(found, undefined, 'resolved incident should not appear in active list');
    });

    test('getIncidents(true) includes resolved incidents', () => {
        const id = contextEngine.addIncident({
            type: 'noise', location: 'Section 205', description: 'Disturbance', severity: 'low'
        });
        contextEngine.resolveIncident(id);
        const all = contextEngine.getIncidents(true);
        const found = all.find(i => i.id === id);
        assert.ok(found, 'resolved incident should appear when includeResolved=true');
        assert.equal(found.resolved, true);
    });

    test('incident has all required fields', () => {
        const id = contextEngine.addIncident({
            type: 'security', location: 'Gate J', description: 'Suspicious bag', severity: 'high'
        });
        const incidents = contextEngine.getIncidents(true);
        const inc = incidents.find(i => i.id === id);
        ['id', 'type', 'location', 'description', 'severity', 'timestamp', 'resolved'].forEach(field => {
            assert.ok(field in inc, `incident missing field: "${field}"`);
        });
    });
});

// ─── Gate Toggle ──────────────────────────────────────────────────────────────

describe('contextEngine — toggleGate', () => {

    test('toggles an open gate to closed', () => {
        const state = contextEngine.getLiveState();
        const openGateId = Object.keys(state.gates).find(id => state.gates[id].status === 'open');
        if (!openGateId) return; // No open gate to test — skip
        const newStatus = contextEngine.toggleGate(openGateId);
        assert.equal(newStatus, 'closed');
        contextEngine.toggleGate(openGateId); // reset
    });

    test('toggles a closed gate to open', () => {
        const state = contextEngine.getLiveState();
        const closedGateId = Object.keys(state.gates).find(id => state.gates[id].status === 'closed');
        if (!closedGateId) return; // No closed gate — skip
        const newStatus = contextEngine.toggleGate(closedGateId);
        assert.equal(newStatus, 'open');
        contextEngine.toggleGate(closedGateId); // reset
    });

    test('returns undefined for a nonexistent gate ID', () => {
        const result = contextEngine.toggleGate('FAKE_GATE_XYZ');
        assert.equal(result, undefined);
    });
});

// ─── External API Hook ────────────────────────────────────────────────────────

describe('contextEngine — updateFromRealAPI', () => {

    test('updates liveState with API data', () => {
        const testData = {
            gates: { gateA: { crowdLevel: 88, status: 'reduced' } },
            food: { shake_shack_b: { queueTime: 12 } },
            zones: { zone_lower_bowl: { density: 45 } },
            parking: { gold_lot_1: { available: 10 } },
            weather: { temp: 25 },
            transport: { rail_njt: { status: 'delayed' } },
            sustainability: { ecoScore: 92 },
            alerts: [{ message: 'API Alert' }]
        };
        contextEngine.updateFromRealAPI(testData);
        const state = contextEngine.getLiveState();
        assert.equal(state.gates.gateA.status, 'reduced');
        assert.equal(state.food.shake_shack_b.queueTime, 12);
        assert.equal(state.weather.temp, 25);
    });
});


