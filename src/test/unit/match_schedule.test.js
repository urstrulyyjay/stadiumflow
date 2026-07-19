/**
 * src/test/unit/match_schedule.test.js
 * Unit tests for match schedule data and phase logic.
 *
 * Tests: MATCH data integrity, getCurrentMatchPhase() return values,
 *        getCurrentMatchMinute() types, getMinutesUntilKickoff() math.
 *
 * Run: node --test src/test/unit/match_schedule.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    MATCH,
    getCurrentMatchPhase,
    getCurrentMatchMinute,
    getMinutesUntilKickoff,
} from '../../data/match_schedule.js';

// ─── MATCH data integrity ─────────────────────────────────────────────────────

describe('MATCH — data integrity', () => {

    test('MATCH object is defined', () => {
        assert.ok(MATCH, 'MATCH should be truthy');
    });

    test('homeTeam is Brazil', () => {
        assert.equal(MATCH.homeTeam.code, 'BRA');
        assert.equal(MATCH.homeTeam.name, 'Brazil');
    });

    test('awayTeam is Germany', () => {
        assert.equal(MATCH.awayTeam.code, 'GER');
        assert.equal(MATCH.awayTeam.name, 'Germany');
    });

    test('venue is MetLife Stadium', () => {
        assert.ok(MATCH.venue.includes('MetLife'), `expected MetLife in venue: ${MATCH.venue}`);
    });

    test('kickoffISO is a valid date string', () => {
        const d = new Date(MATCH.kickoffISO);
        assert.ok(!isNaN(d.getTime()), `kickoffISO "${MATCH.kickoffISO}" is not a valid date`);
    });

    test('kickoff year is 2026', () => {
        const year = new Date(MATCH.kickoffISO).getFullYear();
        assert.equal(year, 2026);
    });

    test('capacity is a positive number', () => {
        assert.ok(typeof MATCH.capacity === 'number');
        assert.ok(MATCH.capacity > 0);
    });

    test('attendance does not exceed capacity', () => {
        assert.ok(MATCH.attendance <= MATCH.capacity,
            `attendance (${MATCH.attendance}) exceeds capacity (${MATCH.capacity})`);
    });

    test('score object has home and away fields', () => {
        assert.ok('home' in MATCH.score);
        assert.ok('away' in MATCH.score);
    });

    test('ticketInfo has required fields', () => {
        assert.ok(MATCH.ticketInfo.seat, 'seat is required');
        assert.ok(MATCH.ticketInfo.gate, 'gate is required');
        assert.ok(MATCH.ticketInfo.section, 'section is required');
    });

    test('homeTeam has a flag emoji', () => {
        assert.ok(MATCH.homeTeam.flag.length > 0);
    });

    test('awayTeam has a flag emoji', () => {
        assert.ok(MATCH.awayTeam.flag.length > 0);
    });

    test('tournament name references FIFA World Cup 2026', () => {
        assert.ok(MATCH.tournament.includes('2026'));
        assert.ok(MATCH.tournament.toLowerCase().includes('fifa'));
    });
});

// ─── getCurrentMatchPhase ─────────────────────────────────────────────────────

describe('getCurrentMatchPhase', () => {

    const VALID_PHASES = new Set([
        'Pre-Match', 'First Half', 'Half Time', 'Second Half', 'Full Time', 'Extra Time'
    ]);

    test('returns a string', () => {
        assert.equal(typeof getCurrentMatchPhase(), 'string');
    });

    test('returns one of the valid phase strings', () => {
        const phase = getCurrentMatchPhase();
        assert.ok(VALID_PHASES.has(phase),
            `unexpected phase: "${phase}". Expected one of: ${[...VALID_PHASES].join(', ')}`);
    });

    test('is deterministic for the same timestamp', () => {
        const p1 = getCurrentMatchPhase();
        const p2 = getCurrentMatchPhase();
        assert.equal(p1, p2);
    });

    // Since kickoffISO is July 14, 2026 and we are running tests before that date,
    // the phase should be 'Pre-Match'.
    test('is "Pre-Match" before July 14, 2026 kickoff', () => {
        const now = Date.now();
        const kickoff = new Date(MATCH.kickoffISO).getTime();
        if (now < kickoff) {
            assert.equal(getCurrentMatchPhase(), 'Pre-Match');
        } else {
            // Match has already started — just verify it returns a valid phase
            assert.ok(VALID_PHASES.has(getCurrentMatchPhase()));
        }
    });
});

// ─── getCurrentMatchMinute ────────────────────────────────────────────────────

describe('getCurrentMatchMinute', () => {

    test('returns null, a number, or a recognized string', () => {
        const min = getCurrentMatchMinute();
        const isValid = min === null
            || typeof min === 'number'
            || min === 'HT'
            || min === 'FT';
        assert.ok(isValid, `unexpected matchMinute value: ${min}`);
    });

    test('returns null before kickoff', () => {
        const now = Date.now();
        const kickoff = new Date(MATCH.kickoffISO).getTime();
        if (now < kickoff) {
            assert.equal(getCurrentMatchMinute(), null);
        }
        // If after kickoff, just ensure it doesn't throw
    });

    test('does not throw', () => {
        assert.doesNotThrow(() => getCurrentMatchMinute());
    });
});

// ─── getMinutesUntilKickoff ───────────────────────────────────────────────────

describe('getMinutesUntilKickoff', () => {

    test('returns a number', () => {
        assert.equal(typeof getMinutesUntilKickoff(), 'number');
    });

    test('returns a positive number before the match (pre-July 14, 2026)', () => {
        const now = Date.now();
        const kickoff = new Date(MATCH.kickoffISO).getTime();
        if (now < kickoff) {
            assert.ok(getMinutesUntilKickoff() > 0,
                `expected positive mins to kickoff before match starts`);
        }
    });

    test('two consecutive calls return the same or very close values', () => {
        const m1 = getMinutesUntilKickoff();
        const m2 = getMinutesUntilKickoff();
        // Should differ by at most 1 (floor rounding)
        assert.ok(Math.abs(m1 - m2) <= 1, `values differ too much: ${m1} vs ${m2}`);
    });

    test('does not throw', () => {
        assert.doesNotThrow(() => getMinutesUntilKickoff());
    });

    test('is consistent with kickoffISO date arithmetic', () => {
        const now = Date.now();
        const kickoff = new Date(MATCH.kickoffISO).getTime();
        const expected = Math.floor((kickoff - now) / 60000);
        const actual = getMinutesUntilKickoff();
        // Allow 1 minute tolerance for test execution time
        assert.ok(Math.abs(expected - actual) <= 1,
            `expected ~${expected} mins, got ${actual}`);
    });
});
