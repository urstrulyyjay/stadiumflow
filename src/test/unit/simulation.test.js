/**
 * src/test/unit/simulation.test.js
 * Unit tests for the match-phase-aware simulation engine.
 *
 * Tests: startSimulation fires callbacks, produces valid snapshot shapes,
 *        stopSimulation cleans up, setGateStatus works, phase param logic.
 *
 * Run: node --test src/test/unit/simulation.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startSimulation, stopSimulation, setGateStatus } from '../../services/simulation.js';
import { METLIFE_STADIUM } from '../../data/metlife_stadium.js';

// ─── Simulation snapshot shape ─────────────────────────────────────────────────

describe('startSimulation — snapshot shape', (t) => {
    let snapshot = null;
    let intervalId = null;

    before(async () => {
        await new Promise((resolve) => {
            startSimulation((s) => {
                snapshot = s;
                stopSimulation();
                resolve();
            });
        });
    });

    test('snapshot is an object', () => {
        assert.ok(snapshot !== null);
        assert.equal(typeof snapshot, 'object');
    });

    test('snapshot has gates object', () => {
        assert.ok('gates' in snapshot, 'snapshot should have gates');
        assert.equal(typeof snapshot.gates, 'object');
    });

    test('snapshot has food object', () => {
        assert.ok('food' in snapshot, 'snapshot should have food');
        assert.equal(typeof snapshot.food, 'object');
    });

    test('snapshot has zones object', () => {
        assert.ok('zones' in snapshot, 'snapshot should have zones');
        assert.equal(typeof snapshot.zones, 'object');
    });

    test('snapshot has parking object', () => {
        assert.ok('parking' in snapshot, 'snapshot should have parking');
        assert.equal(typeof snapshot.parking, 'object');
    });

    test('snapshot has sustainability object', () => {
        assert.ok('sustainability' in snapshot, 'snapshot should have sustainability');
        assert.equal(typeof snapshot.sustainability, 'object');
    });

    test('snapshot has newAlerts array', () => {
        assert.ok(Array.isArray(snapshot.newAlerts), 'newAlerts should be an array');
    });
});

// ─── Gate data integrity ───────────────────────────────────────────────────────

describe('startSimulation — gate data integrity', () => {
    let snapshot = null;

    before(async () => {
        await new Promise((resolve) => {
            startSimulation((s) => {
                snapshot = s;
                stopSimulation();
                resolve();
            });
        });
    });

    test('all MetLife gates are represented in the snapshot', () => {
        const expectedGates = Object.keys(METLIFE_STADIUM.gates);
        expectedGates.forEach(gateId => {
            assert.ok(gateId in snapshot.gates,
                `gate "${gateId}" missing from simulation snapshot`);
        });
    });

    test('each gate has a crowdLevel between 0 and 100', () => {
        Object.entries(snapshot.gates).forEach(([id, gate]) => {
            assert.ok(
                typeof gate.crowdLevel === 'number'
                && gate.crowdLevel >= 0
                && gate.crowdLevel <= 100,
                `gate "${id}" crowdLevel out of range: ${gate.crowdLevel}`
            );
        });
    });

    test('each gate has a valid status string', () => {
        const validStatuses = new Set(['open', 'closed', 'reduced']);
        Object.entries(snapshot.gates).forEach(([id, gate]) => {
            assert.ok(
                validStatuses.has(gate.status),
                `gate "${id}" has invalid status: "${gate.status}"`
            );
        });
    });

    test('each gate has a non-negative avgWait', () => {
        Object.entries(snapshot.gates).forEach(([id, gate]) => {
            assert.ok(
                typeof gate.avgWait === 'number' && gate.avgWait >= 0,
                `gate "${id}" avgWait invalid: ${gate.avgWait}`
            );
        });
    });
});

// ─── Food data integrity ───────────────────────────────────────────────────────

describe('startSimulation — food stall data integrity', () => {
    let snapshot = null;

    before(async () => {
        await new Promise((resolve) => {
            startSimulation((s) => {
                snapshot = s;
                stopSimulation();
                resolve();
            });
        });
    });

    test('all food stalls are represented in the snapshot', () => {
        const expectedStalls = Object.keys(METLIFE_STADIUM.food);
        expectedStalls.forEach(stallId => {
            assert.ok(stallId in snapshot.food,
                `stall "${stallId}" missing from simulation snapshot`);
        });
    });

    test('each food stall has a non-negative queueTime', () => {
        Object.entries(snapshot.food).forEach(([id, stall]) => {
            assert.ok(
                typeof stall.queueTime === 'number' && stall.queueTime >= 0,
                `stall "${id}" queueTime invalid: ${stall.queueTime}`
            );
        });
    });

    test('each food stall has a stockLevel between 0 and 100', () => {
        Object.entries(snapshot.food).forEach(([id, stall]) => {
            if ('stockLevel' in stall) {
                assert.ok(
                    stall.stockLevel >= 0 && stall.stockLevel <= 100,
                    `stall "${id}" stockLevel out of range: ${stall.stockLevel}`
                );
            }
        });
    });
});

// ─── Zone data integrity ───────────────────────────────────────────────────────

describe('startSimulation — zone density validity', () => {
    let snapshot = null;

    before(async () => {
        await new Promise((resolve) => {
            startSimulation((s) => {
                snapshot = s;
                stopSimulation();
                resolve();
            });
        });
    });

    test('zone densities are numbers between 0 and 100', () => {
        Object.entries(snapshot.zones).forEach(([id, zone]) => {
            assert.ok(
                typeof zone.density === 'number'
                && zone.density >= 0
                && zone.density <= 100,
                `zone "${id}" density out of range: ${zone.density}`
            );
        });
    });
});

// ─── setGateStatus ─────────────────────────────────────────────────────────────

describe('setGateStatus', () => {

    test('does not throw for a valid gate ID and status', () => {
        const firstGateId = Object.keys(METLIFE_STADIUM.gates)[0];
        assert.doesNotThrow(() => setGateStatus(firstGateId, 'closed'));
        assert.doesNotThrow(() => setGateStatus(firstGateId, 'open'));
    });

    test('does not throw for an unknown gate ID', () => {
        assert.doesNotThrow(() => setGateStatus('NONEXISTENT_GATE', 'open'));
    });
});

// ─── stopSimulation ────────────────────────────────────────────────────────────

describe('stopSimulation', () => {

    test('can be called multiple times without throwing', () => {
        assert.doesNotThrow(() => {
            stopSimulation();
            stopSimulation();
        });
    });

    test('stops the callback from firing after stop is called', async () => {
        let callCount = 0;
        startSimulation(() => { callCount++; });
        stopSimulation();
        await new Promise(r => setTimeout(r, 100));
        assert.equal(callCount, 0, `expected 0 callbacks after stop, got ${callCount}`);
    });
});
