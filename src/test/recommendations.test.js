/**
 * src/test/recommendations.test.js
 * StadiumFlow AI — Food Recommendation Integration Tests
 *
 * Updated to use the v2 API: geminiService.recommendFood()
 * and the new context snapshot shape from contextEngine.
 *
 * Run from browser console:
 *   window.runStadiumTests()
 *
 * Or from a Node test runner that supports ES modules.
 */

import { geminiService } from '../services/ai.js';
import { contextEngine  } from '../services/contextEngine.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        return true;
    } else {
        console.error(`  ❌ FAIL: ${label}`);
        return false;
    }
}

async function runTest(name, fn) {
    console.groupCollapsed(`▶ ${name}`);
    const start = performance.now();
    try {
        await fn();
    } catch (e) {
        console.error(`  💥 ERROR: ${e.message}`);
    }
    console.log(`  ⏱ ${(performance.now() - start).toFixed(0)}ms`);
    console.groupEnd();
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

export const runTests = async () => {
    console.group('🧪 StadiumFlow AI — Integration Tests');
    console.log('Initializing context engine...');
    contextEngine.init();
    const ctx = contextEngine.getSnapshot();

    // ── Test 1: Food recommendation fallback ──────────────────────────────
    await runTest('Food recommendation — offline fallback', async () => {
        const result = await geminiService.recommendFood({}, ctx);
        assert(result !== null && result !== undefined, 'Result is not null');
        assert(typeof result === 'object', 'Result is an object');
        assert('trigger' in result, 'Result has trigger field');
        if (result.trigger) {
            assert(result.topPick !== undefined, 'When triggered, topPick is present');
        }
    });

    // ── Test 2: Crowd analysis returns expected shape ─────────────────────
    await runTest('Crowd analysis — response shape', async () => {
        const result = await geminiService.analyzeCrowd(ctx);
        assert(result !== null, 'Result is not null');
        assert(typeof result === 'object', 'Result is an object');
        assert('overallLevel' in result, 'Has overallLevel field');
        assert(
            ['low', 'medium', 'high', 'critical'].includes(result.overallLevel),
            `overallLevel is valid: "${result.overallLevel}"`
        );
        assert('recommendation' in result, 'Has recommendation field');
        assert(Array.isArray(result.hotspots), 'hotspots is an array');
    });

    // ── Test 3: Navigation plan response shape ────────────────────────────
    await runTest('Navigation plan — response shape', async () => {
        const result = await geminiService.generateNavigationPlan('Section 119', 'fastest', ctx);
        assert(result !== null, 'Result is not null');
        assert(typeof result === 'object', 'Result is an object');
        assert('steps' in result, 'Has steps field');
        assert(Array.isArray(result.steps), 'steps is an array');
        assert(result.steps.length > 0, `Has at least 1 step (got ${result.steps.length})`);
        assert('eta' in result, 'Has eta field');
    });

    // ── Test 4: Proactive suggestion response shape ────────────────────────
    await runTest('Proactive suggestion — response shape', async () => {
        const result = await geminiService.generateProactiveSuggestion(ctx);
        assert(result !== null, 'Result is not null');
        assert('shouldNotify' in result, 'Has shouldNotify field');
        assert(typeof result.shouldNotify === 'boolean', 'shouldNotify is boolean');
        if (result.shouldNotify) {
            assert('title' in result, 'When notifying, has title');
            assert('urgency' in result, 'When notifying, has urgency');
            assert(
                ['low', 'medium', 'high'].includes(result.urgency),
                `urgency is valid: "${result.urgency}"`
            );
        }
    });

    // ── Test 5: Emergency plan response shape ─────────────────────────────
    await runTest('Emergency plan — response shape', async () => {
        const result = await geminiService.generateEmergencyPlan('evacuation', ctx);
        assert(result !== null, 'Result is not null');
        assert('evacuationRoute' in result || 'immediateActions' in result,
            'Has evacuationRoute or immediateActions');
        assert('broadcastMessage' in result, 'Has broadcastMessage');
    });

    // ── Test 6: Context engine — best gate logic ─────────────────────────
    await runTest('ContextEngine — getBestGate()', () => {
        const gate = contextEngine.getBestGate();
        assert(gate !== null, 'getBestGate returns a gate object');
        assert('name' in gate, 'Gate has name');
        assert('crowdLevel' in gate, 'Gate has crowdLevel');
        assert(gate.status === 'open', 'Best gate is open');
    });

    // ── Test 7: Context engine — crowd level computation ─────────────────
    await runTest('ContextEngine — getOverallCrowdLevel()', () => {
        const level = contextEngine.getOverallCrowdLevel();
        assert(typeof level === 'number', 'Returns a number');
        assert(level >= 0 && level <= 100, `Level is in range 0-100 (got ${level})`);
    });

    // ── Test 8: Context engine — gate toggle ──────────────────────────────
    await runTest('ContextEngine — toggleGate()', () => {
        const gate = contextEngine.getBestGate();
        if (!gate) { console.warn('  ⚠️ No open gate found to test toggle.'); return; }
        const original = gate.status;
        const toggled  = contextEngine.toggleGate(gate.id);
        assert(toggled !== original, `Status changed from "${original}" to "${toggled}"`);
        // Toggle back
        contextEngine.toggleGate(gate.id);
        assert(gate.status === original, 'Toggled back to original state');
    });

    // ── Test 9: Match Day Plan response shape ─────────────────────────────
    await runTest('Match Day Plan — response shape', async () => {
        const result = await geminiService.generateMatchDayPlan(ctx);
        assert(result !== null, 'Result is not null');
        assert('items' in result, 'Has items field');
        assert(Array.isArray(result.items), 'items is an array');
        assert(result.items.length > 0, `Has at least 1 item (got ${result.items.length})`);
        if (result.items[0]) {
            assert('time' in result.items[0], 'Items have time field');
            assert('title' in result.items[0], 'Items have title field');
        }
    });

    // ── Test 10: Notification system ─────────────────────────────────────
    await runTest('Notification system — add and count', () => {
        const before = contextEngine.getUnreadCount();
        contextEngine.addNotification({ title: 'Test Notification', body: 'Test body', type: 'info', category: 'test' });
        const after = contextEngine.getUnreadCount();
        assert(after === before + 1, `Unread count incremented from ${before} to ${after}`);
    });

    console.groupEnd();
    console.log('✅ All tests complete. Check above for individual results.');
};

// ── Auto-register for browser console ───────────────────────────────────────
if (typeof window !== 'undefined') {
    window.runStadiumTests = runTests;
    console.log('[Tests] window.runStadiumTests() is ready. Open DevTools console and call it to run all integration tests.');
}
