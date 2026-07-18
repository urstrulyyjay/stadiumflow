/**
 * src/utils/dom.js
 * Shared DOM utility functions used across all role modules.
 * Centralises XSS-safe rendering and common DOM operations.
 */

/**
 * Set element text content safely (no XSS, null-safe).
 * @param {string} id - Element ID
 * @param {string} text
 */
export function safeText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(text ?? '');
}

/**
 * Set element innerHTML after escaping user-supplied content.
 * Only use `trustedHTML` for templates YOU construct — not user input.
 * @param {string} id
 * @param {string} trustedHTML
 */
export function safeHTML(id, trustedHTML) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = trustedHTML;
}

/**
 * Escape HTML special characters to prevent XSS.
 * Use this on any user-supplied or external data before inserting into innerHTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Show a skeleton loader in a container while content loads.
 * @param {string} containerId
 * @param {number} [count=3]
 */
export function showSkeleton(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Array(count).fill('<div class="skeleton-item"></div>').join('');
}

/**
 * Toggle the 'hidden' class on an element.
 * @param {string} id
 * @param {boolean} [force] - if provided, forces show (false) or hide (true)
 */
export function toggleHidden(id, force) {
    const el = document.getElementById(id);
    if (!el) return;
    if (force === true)  el.classList.add('hidden');
    else if (force === false) el.classList.remove('hidden');
    else el.classList.toggle('hidden');
}

/**
 * Animate a number counting up from current to target.
 * @param {string} id - Element ID
 * @param {number} target
 * @param {string} [suffix='']
 * @param {number} [durationMs=800]
 */
export function animateNumber(id, target, suffix = '', durationMs = 800) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseFloat(el.textContent) || 0;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / durationMs, 1);
        const current = start + (target - start) * easeOut(progress);
        el.textContent = `${Math.round(current)}${suffix}`;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/** Ease-out curve for smooth number animations */
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/**
 * Get crowd level severity class.
 * @param {number} level - 0 to 100
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function crowdClass(level) {
    if (level >= 85) return 'critical';
    if (level >= 65) return 'high';
    if (level >= 40) return 'medium';
    return 'low';
}

/**
 * Get crowd level color CSS variable.
 * @param {number} level
 * @returns {string}
 */
export function crowdColor(level) {
    if (level >= 85) return 'var(--danger)';
    if (level >= 65) return 'var(--warning)';
    if (level >= 40) return 'var(--warning-dim, #ffa72699)';
    return 'var(--success)';
}

/**
 * Render markdown-style **bold** text safely.
 * Only processes **bold** markers — no other markdown.
 * @param {string} text
 * @returns {string} HTML string (safe)
 */
export function renderBold(text) {
    return escapeHTML(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Create a status badge HTML string.
 * @param {string} text
 * @param {'ok'|'warning'|'danger'|'info'|'live'} type
 * @returns {string}
 */
export function statusBadge(text, type = 'info') {
    return `<span class="status-badge badge-${type}">${escapeHTML(text)}</span>`;
}

/**
 * Update a notification badge count on a nav item.
 * @param {string} badgeId
 * @param {number} count
 */
export function updateNavBadge(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}
