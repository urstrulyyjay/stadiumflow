/**
 * src/utils/cache.js
 * Lightweight TTL-based AI Response Cache
 *
 * Prevents duplicate Gemini API calls when context hasn't meaningfully changed.
 * Uses a string-keyed Map with TTL eviction.
 * Estimated 80%+ reduction in API calls on repeated renders.
 */

const DEFAULT_TTL_MS = 90_000;  // 90 seconds

/**
 * Simple LRU-ish TTL cache.
 * @template T
 */
class TTLCache {
    constructor(maxSize = 50) {
        this._store = new Map();
        this._maxSize = maxSize;
    }

    /**
     * Get a cached value. Returns undefined if expired or missing.
     * @param {string} key
     * @returns {*|undefined}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    /**
     * Set a value with a TTL.
     * @param {string} key
     * @param {*} value
     * @param {number} [ttlMs]
     */
    set(key, value, ttlMs = DEFAULT_TTL_MS) {
        if (this._store.size >= this._maxSize) {
            // Evict oldest entry
            const oldestKey = this._store.keys().next().value;
            this._store.delete(oldestKey);
        }
        this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    /** Check if a non-expired key exists. */
    has(key) { return this.get(key) !== undefined; }

    /** Remove a specific key. */
    delete(key) { this._store.delete(key); }

    /** Clear all entries. */
    clear() { this._store.clear(); }

    /** Returns number of stored (possibly expired) entries. */
    get size() { return this._store.size; }
}

// ─── Shared AI cache instance ─────────────────────────────────────────────────
export const aiCache = new TTLCache(50);

/**
 * Build a deterministic cache key from context fields that matter for a given function.
 * Only includes fields that actually influence the AI output — ignores timestamp etc.
 *
 * @param {string} fnName - The AI function name (e.g. 'chat', 'crowd', 'food')
 * @param {object} ctx - Full context snapshot
 * @param {string} [extra] - Extra discriminant (e.g. user's message, route type)
 * @returns {string}
 */
export function buildCacheKey(fnName, ctx, extra = '') {
    const keyParts = {
        fn:    fnName,
        extra: extra.slice(0, 80), // truncate long messages
        phase: ctx.meta?.matchPhase || '',
        minsToKO: Math.floor((ctx.meta?.minsToKickoff || 0) / 5) * 5, // 5-min buckets
        lang:  ctx.user?.language || 'en',
        role:  ctx.user?.role || 'fan',
        diet:  (ctx.user?.preferences?.dietaryRestrictions || []).join(','),
        // Crowd bucketed to nearest 10%
        crowdBucket: Math.round((
            Object.values(ctx.stadium?.zones || {}).reduce((s, z) => s + (z.density || 0), 0) /
            Math.max(1, Object.keys(ctx.stadium?.zones || {}).length)
        ) / 10) * 10,
        // Best gate ID
        bestGate: Object.values(ctx.stadium?.gates || {})
            .filter(g => g.status === 'open')
            .sort((a, b) => a.crowdLevel - b.crowdLevel)[0]?.id || '',
        // Emergency status
        emergency: ctx.emergency?.active ? ctx.emergency.type : 'none',
    };
    return JSON.stringify(keyParts);
}
