/**
 * src/test/unit/cache.test.js
 * Unit tests for the TTL Cache utility.
 *
 * Tests: set/get, TTL expiry, max-size eviction, has/delete/clear,
 *        buildCacheKey determinism and bucketing.
 *
 * Run: node --test src/test/unit/cache.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aiCache, buildCacheKey } from '../../utils/cache.js';

// ─── TTLCache behaviour ────────────────────────────────────────────────────────

describe('TTLCache — basic operations', () => {

    test('set and get a value before TTL expires', () => {
        aiCache.clear();
        aiCache.set('key1', { data: 42 }, 5000);
        const result = aiCache.get('key1');
        assert.deepEqual(result, { data: 42 });
    });

    test('get returns undefined for a missing key', () => {
        aiCache.clear();
        assert.equal(aiCache.get('nonexistent'), undefined);
    });

    test('get returns undefined after TTL has expired', async () => {
        aiCache.clear();
        aiCache.set('shortlived', 'hello', 1); // 1ms TTL
        await new Promise(r => setTimeout(r, 10));
        assert.equal(aiCache.get('shortlived'), undefined);
    });

    test('has returns true for a fresh key', () => {
        aiCache.clear();
        aiCache.set('present', true, 5000);
        assert.equal(aiCache.has('present'), true);
    });

    test('has returns false for expired key', async () => {
        aiCache.clear();
        aiCache.set('expired', 'value', 1);
        await new Promise(r => setTimeout(r, 10));
        assert.equal(aiCache.has('expired'), false);
    });

    test('delete removes a key', () => {
        aiCache.clear();
        aiCache.set('toDelete', 'bye', 5000);
        aiCache.delete('toDelete');
        assert.equal(aiCache.get('toDelete'), undefined);
    });

    test('clear empties all entries', () => {
        aiCache.set('a', 1, 5000);
        aiCache.set('b', 2, 5000);
        aiCache.clear();
        assert.equal(aiCache.size, 0);
    });

    test('size reflects stored (possibly expired) entries', () => {
        aiCache.clear();
        aiCache.set('x', 1, 5000);
        aiCache.set('y', 2, 5000);
        assert.equal(aiCache.size, 2);
    });

    test('overwriting a key replaces the value', () => {
        aiCache.clear();
        aiCache.set('dup', 'first', 5000);
        aiCache.set('dup', 'second', 5000);
        assert.equal(aiCache.get('dup'), 'second');
    });

    test('stores falsy values (0, false, empty string)', () => {
        aiCache.clear();
        aiCache.set('zero', 0, 5000);
        aiCache.set('false', false, 5000);
        aiCache.set('empty', '', 5000);
        assert.equal(aiCache.get('zero'), 0);
        assert.equal(aiCache.get('false'), false);
        assert.equal(aiCache.get('empty'), '');
    });

    test('evicts oldest entry when size exceeds max size limit', () => {
        aiCache.clear();
        for (let i = 0; i < 55; i++) {
            aiCache.set(`key_${i}`, i, 5000);
        }
        assert.equal(aiCache.get('key_0'), undefined);
        assert.equal(aiCache.get('key_4'), undefined);
        assert.equal(aiCache.get('key_5'), 5);
        assert.equal(aiCache.size, 50);
    });
});

// ─── buildCacheKey ─────────────────────────────────────────────────────────────

describe('buildCacheKey — determinism and bucketing', () => {

    const mockCtx = {
        meta: { matchPhase: 'Pre-Match', minsToKickoff: 47 },
        user: { language: 'en', role: 'fan', preferences: { dietaryRestrictions: [] } },
        stadium: {
            zones: { z1: { density: 60 }, z2: { density: 40 } },
            gates: { A: { status: 'open', crowdLevel: 30, id: 'A' }, B: { status: 'closed', crowdLevel: 90, id: 'B' } }
        },
        emergency: { active: false }
    };

    test('same inputs produce same key (deterministic)', () => {
        const k1 = buildCacheKey('crowd', mockCtx, '');
        const k2 = buildCacheKey('crowd', mockCtx, '');
        assert.equal(k1, k2);
    });

    test('different function names produce different keys', () => {
        const k1 = buildCacheKey('crowd', mockCtx, '');
        const k2 = buildCacheKey('food', mockCtx, '');
        assert.notEqual(k1, k2);
    });

    test('different extra strings produce different keys', () => {
        const k1 = buildCacheKey('chat', mockCtx, 'where is gate A');
        const k2 = buildCacheKey('chat', mockCtx, 'what food is nearest');
        assert.notEqual(k1, k2);
    });

    test('different languages produce different keys', () => {
        const ctxES = { ...mockCtx, user: { ...mockCtx.user, language: 'es' } };
        const k1 = buildCacheKey('chat', mockCtx, 'hello');
        const k2 = buildCacheKey('chat', ctxES, 'hello');
        assert.notEqual(k1, k2);
    });

    test('minsToKickoff is bucketed to nearest 5 minutes', () => {
        const ctx47 = { ...mockCtx, meta: { ...mockCtx.meta, minsToKickoff: 47 } };
        const ctx48 = { ...mockCtx, meta: { ...mockCtx.meta, minsToKickoff: 48 } };
        const ctx50 = { ...mockCtx, meta: { ...mockCtx.meta, minsToKickoff: 50 } };
        // 47 and 48 both bucket to 45; 50 buckets to 50 → different key
        const k47 = buildCacheKey('crowd', ctx47);
        const k48 = buildCacheKey('crowd', ctx48);
        const k50 = buildCacheKey('crowd', ctx50);
        assert.equal(k47, k48);
        assert.notEqual(k47, k50);
    });

    test('active emergency changes the key', () => {
        const ctxEmergency = { ...mockCtx, emergency: { active: true, type: 'evacuation' } };
        const k1 = buildCacheKey('nav', mockCtx);
        const k2 = buildCacheKey('nav', ctxEmergency);
        assert.notEqual(k1, k2);
    });

    test('extra string is truncated to 80 chars', () => {
        const long80  = 'a'.repeat(80);
        const long200 = 'a'.repeat(200);
        // Both should produce the same key since both truncate to 'a' * 80
        const k1 = buildCacheKey('chat', mockCtx, long80);
        const k2 = buildCacheKey('chat', mockCtx, long200);
        assert.equal(k1, k2);
    });

    test('returns a JSON string', () => {
        const key = buildCacheKey('food', mockCtx, 'halal');
        assert.doesNotThrow(() => JSON.parse(key));
    });

    test('handles missing context fields gracefully', () => {
        assert.doesNotThrow(() => buildCacheKey('crowd', {}, ''));
        assert.doesNotThrow(() => buildCacheKey('food', { meta: null, user: null }, ''));
    });
});
