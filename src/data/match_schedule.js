/**
 * src/data/match_schedule.js
 * FIFA World Cup 2026 — Match Data
 *
 * Brazil vs Germany — Group Stage
 * MetLife Stadium, East Rutherford, NJ
 * July 14, 2026 · 8:00 PM ET
 */

export const MATCH = {
    id: 'FIFA-2026-ML-GS-27',
    tournament: 'FIFA World Cup 2026',
    stage: 'Group Stage — Group F, Matchday 2',
    venue: 'MetLife Stadium, East Rutherford, NJ',
    venueShort: 'MetLife Stadium',
    city: 'East Rutherford, NJ, USA',

    homeTeam: {
        name: 'Brazil',
        code: 'BRA',
        flag: '🇧🇷',
        color: '#009c3b',
        ranking: 1,
    },
    awayTeam: {
        name: 'Germany',
        code: 'GER',
        flag: '🇩🇪',
        color: '#000000',
        ranking: 12,
    },

    kickoff: '20:00',       // 8:00 PM ET
    kickoffISO: '2026-07-14T20:00:00-04:00',
    date: 'July 14, 2026',
    dateShort: 'Jul 14',
    timezone: 'ET (UTC-4)',
    broadcast: ['Fox Sports', 'Telemundo', 'BBC Sport', 'DAZN'],

    // Live match state (updated in contextEngine)
    currentPhase: 'Pre-Match',  // Pre-Match | First Half | Half Time | Second Half | Full Time | Extra Time
    matchMinute: null,          // null = not started; 0-90 = in play; HT = half time
    score: { home: 0, away: 0 },
    minutesUntilKickoff: 58,   // decremented by simulation

    attendance: 81840,
    capacity: 82500,
    selloutPct: 99.2,

    officials: {
        referee: 'Szymon Marciniak (Poland)',
        assistant1: 'Paweł Sokolnicki (Poland)',
        assistant2: 'Tomasz Listkiewicz (Poland)',
        var: 'Tomasz Kwiatkowski (Poland)',
    },

    weather: {
        atKickoff: '27°C / 81°F, Partly Cloudy, Light SW Breeze',
        pitch: 'Artificial Turf — Excellent Condition',
    },

    ticketInfo: {
        id: 'FIFA-2026-7741-A',
        section: 'Section 118',
        row: 'Row 14',
        seat: 'A-214',
        seatLabel: 'Seat 214',
        stand: 'North Stand',
        gate: 'Gate B',
        type: 'Standard',
        holder: 'Match Fan',
        barcodeValue: '2026|BRA-GER|S118|R14|A214',
    },
};

/**
 * Returns the current match minute based on a real kickoff timestamp.
 * Uses current system time to simulate a real match in progress.
 * If you want to simulate a specific phase, adjust MATCH.kickoffISO.
 * @returns {number|string|null} minute number, 'HT', or null if not started
 */
export function getCurrentMatchMinute() {
    const now = Date.now();
    const kickoff = new Date(MATCH.kickoffISO).getTime();
    const elapsed = Math.floor((now - kickoff) / 60000); // minutes since kickoff

    if (elapsed < 0) return null;              // Pre-match
    if (elapsed >= 0 && elapsed <= 45) return elapsed;  // First Half
    if (elapsed > 45 && elapsed <= 60) return 'HT';    // Half Time
    if (elapsed > 60 && elapsed <= 105) return elapsed - 15; // Second Half (adjust for break)
    if (elapsed > 105) return 'FT';            // Full Time
    return null;
}

/**
 * Returns the current match phase string based on system time.
 * @returns {string}
 */
export function getCurrentMatchPhase() {
    const now = Date.now();
    const kickoff = new Date(MATCH.kickoffISO).getTime();
    const elapsed = Math.floor((now - kickoff) / 60000);

    if (elapsed < -90) return 'Pre-Match';
    if (elapsed < 0) return 'Pre-Match';
    if (elapsed <= 45) return 'First Half';
    if (elapsed <= 60) return 'Half Time';
    if (elapsed <= 105) return 'Second Half';
    return 'Full Time';
}

/**
 * Returns minutes until kickoff (negative if match has started).
 */
export function getMinutesUntilKickoff() {
    const now = Date.now();
    const kickoff = new Date(MATCH.kickoffISO).getTime();
    return Math.floor((kickoff - now) / 60000);
}
