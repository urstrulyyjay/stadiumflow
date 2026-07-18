/**
 * src/utils/time.js
 * Time formatting utilities for StadiumFlow AI.
 */

/**
 * Format a Date as "HH:MM" in Eastern Time (for match-day display).
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatTimeET(date = new Date()) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
        hour12: false, timeZone: 'America/New_York',
    });
}

/**
 * Format a Date as "HH:MM" in local time.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatTimeLocal(date = new Date()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get a human-readable "time ago" string.
 * @param {string|Date} timestamp
 * @returns {string} e.g. "2 min ago", "just now"
 */
export function timeAgo(timestamp) {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
}

/**
 * Format seconds as MM:SS countdown.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatCountdown(totalSeconds) {
    const m = Math.floor(Math.abs(totalSeconds) / 60);
    const s = Math.abs(totalSeconds) % 60;
    return `${totalSeconds < 0 ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format minutes as a readable string.
 * @param {number} mins
 * @returns {string} e.g. "1h 12min", "45 min"
 */
export function formatMinutes(mins) {
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Returns a label for the current match phase with emoji.
 * @param {string} phase
 * @param {number|string|null} matchMinute
 * @returns {string}
 */
export function formatMatchPhase(phase, matchMinute) {
    const labels = {
        'Pre-Match': '⏳ Pre-Match',
        'First Half': `⚽ 1st Half${matchMinute !== null ? ` — ${matchMinute}'` : ''}`,
        'Half Time': '☕ Half Time',
        'Second Half': `⚽ 2nd Half${matchMinute !== null ? ` — ${matchMinute}'` : ''}`,
        'Full Time': '🏁 Full Time',
        'Extra Time': '⏰ Extra Time',
    };
    return labels[phase] || phase;
}

/**
 * Start a countdown that updates a DOM element every minute.
 * @param {string} elementId
 * @param {Function} getMins - function returning current minutes to kickoff
 * @returns {number} interval ID (call clearInterval to stop)
 */
export function startKickoffCountdown(elementId, getMins) {
    function tick() {
        const mins = getMins();
        const el = document.getElementById(elementId);
        if (!el) return;
        if (mins > 0)       el.textContent = `${mins} min`;
        else if (mins === 0) el.textContent = 'KICK-OFF!';
        else                el.textContent = 'LIVE';
    }
    tick();
    return setInterval(tick, 60_000);
}
