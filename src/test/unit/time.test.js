/**
 * src/test/unit/time.test.js
 * Unit tests for time formatting utilities.
 *
 * Tests: formatCountdown, formatMinutes, formatMatchPhase, timeAgo.
 * All functions are pure — no browser/DOM needed.
 *
 * Run: node --test src/test/unit/time.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatCountdown,
    formatMinutes,
    formatMatchPhase,
    timeAgo,
} from '../../utils/time.js';

// ─── formatCountdown ───────────────────────────────────────────────────────────

describe('formatCountdown', () => {

    test('formats zero as 00:00', () => {
        assert.equal(formatCountdown(0), '00:00');
    });

    test('formats 90 seconds as 01:30', () => {
        assert.equal(formatCountdown(90), '01:30');
    });

    test('formats 3600 seconds as 60:00', () => {
        assert.equal(formatCountdown(3600), '60:00');
    });

    test('formats 65 seconds as 01:05', () => {
        assert.equal(formatCountdown(65), '01:05');
    });

    test('formats negative values with a leading dash', () => {
        const result = formatCountdown(-120);
        assert.ok(result.startsWith('-'), `expected leading dash, got: ${result}`);
    });

    test('negative and positive same magnitude produce same digits', () => {
        const pos = formatCountdown(300);
        const neg = formatCountdown(-300);
        assert.equal(neg, `-${pos}`);
    });

    test('pads single-digit seconds with a zero', () => {
        assert.equal(formatCountdown(61), '01:01');
    });

    test('handles very large values (e.g. 2h)', () => {
        assert.equal(formatCountdown(7200), '120:00');
    });
});

// ─── formatMinutes ─────────────────────────────────────────────────────────────

describe('formatMinutes', () => {

    test('returns "X min" for values under 60', () => {
        assert.equal(formatMinutes(30), '30 min');
        assert.equal(formatMinutes(1), '1 min');
        assert.equal(formatMinutes(59), '59 min');
    });

    test('returns "Xh" for exact hours', () => {
        assert.equal(formatMinutes(60), '1h');
        assert.equal(formatMinutes(120), '2h');
    });

    test('returns "Xh Ymin" for hours and minutes', () => {
        assert.equal(formatMinutes(90), '1h 30min');
        assert.equal(formatMinutes(75), '1h 15min');
    });

    test('rounds sub-minute fractions', () => {
        assert.equal(formatMinutes(30.4), '30 min');
        assert.equal(formatMinutes(30.6), '31 min');
    });

    test('returns "0 min" for zero', () => {
        assert.equal(formatMinutes(0), '0 min');
    });
});

// ─── formatMatchPhase ──────────────────────────────────────────────────────────

describe('formatMatchPhase', () => {

    test('Pre-Match returns formatted label', () => {
        const result = formatMatchPhase('Pre-Match', null);
        assert.ok(result.includes('Pre-Match'));
    });

    test('First Half includes the minute number when provided', () => {
        const result = formatMatchPhase('First Half', 23);
        assert.ok(result.includes("23'"), `expected "23'" in: ${result}`);
    });

    test('First Half without minute omits the apostrophe', () => {
        const result = formatMatchPhase('First Half', null);
        assert.ok(!result.includes("null'"), `should not include "null'" — got: ${result}`);
    });

    test('Half Time returns formatted label', () => {
        const result = formatMatchPhase('Half Time', null);
        assert.ok(result.includes('Half Time'));
    });

    test('Second Half includes the minute number', () => {
        const result = formatMatchPhase('Second Half', 67);
        assert.ok(result.includes("67'"), `expected "67'" in: ${result}`);
    });

    test('Full Time returns formatted label', () => {
        const result = formatMatchPhase('Full Time', null);
        assert.ok(result.includes('Full Time'));
    });

    test('Extra Time returns formatted label', () => {
        const result = formatMatchPhase('Extra Time', null);
        assert.ok(result.includes('Extra Time'));
    });

    test('unknown phase falls back to the phase string itself', () => {
        const result = formatMatchPhase('Penalty Shootout', null);
        assert.equal(result, 'Penalty Shootout');
    });

    test('returns a string for all known phases', () => {
        const phases = ['Pre-Match', 'First Half', 'Half Time', 'Second Half', 'Full Time', 'Extra Time'];
        phases.forEach(p => {
            assert.equal(typeof formatMatchPhase(p, 0), 'string');
        });
    });
});

// ─── timeAgo ───────────────────────────────────────────────────────────────────

describe('timeAgo', () => {

    test('"just now" for timestamps less than 60 seconds ago', () => {
        const ts = new Date(Date.now() - 30_000).toISOString();
        assert.equal(timeAgo(ts), 'just now');
    });

    test('"X min ago" for timestamps 1–59 minutes ago', () => {
        const ts = new Date(Date.now() - 5 * 60_000).toISOString();
        assert.ok(timeAgo(ts).includes('min ago'), `expected "min ago" — got: ${timeAgo(ts)}`);
    });

    test('"Xh ago" for timestamps over an hour ago', () => {
        const ts = new Date(Date.now() - 2 * 3600_000).toISOString();
        assert.ok(timeAgo(ts).includes('h ago'), `expected "h ago" — got: ${timeAgo(ts)}`);
    });

    test('returns a date string for timestamps over 24 hours ago', () => {
        const ts = new Date(Date.now() - 48 * 3600_000).toISOString();
        const result = timeAgo(ts);
        // Should NOT say "min ago" or "h ago"
        assert.ok(!result.includes('min ago') && !result.includes('h ago'),
            `expected date string, got: ${result}`);
    });

    test('accepts Date objects as input', () => {
        const date = new Date(Date.now() - 10_000);
        assert.doesNotThrow(() => timeAgo(date));
    });
});
