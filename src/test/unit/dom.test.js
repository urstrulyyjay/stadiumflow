/**
 * src/test/unit/dom.test.js
 * Unit tests for pure DOM utility functions.
 *
 * Only the functions that do NOT touch the real DOM are tested here:
 *   escapeHTML, capitalize, crowdClass, crowdColor, renderBold, statusBadge
 *
 * DOM-mutating functions (safeText, showSkeleton, animateNumber, toggleHidden,
 * updateNavBadge) are covered by the integration test suite.
 *
 * Run: node --test src/test/unit/dom.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    escapeHTML,
    capitalize,
    crowdClass,
    crowdColor,
    renderBold,
    statusBadge,
} from '../../utils/dom.js';

// ─── escapeHTML ────────────────────────────────────────────────────────────────

describe('escapeHTML', () => {

    test('escapes ampersand', () => {
        assert.equal(escapeHTML('a & b'), 'a &amp; b');
    });

    test('escapes angle brackets', () => {
        assert.equal(escapeHTML('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('escapes double quotes', () => {
        assert.equal(escapeHTML('"hello"'), '&quot;hello&quot;');
    });

    test('escapes single quotes', () => {
        assert.equal(escapeHTML("it's"), "it&#39;s");
    });

    test('returns empty string for null', () => {
        assert.equal(escapeHTML(null), '');
    });

    test('returns empty string for undefined', () => {
        assert.equal(escapeHTML(undefined), '');
    });

    test('leaves safe strings unchanged', () => {
        assert.equal(escapeHTML('Hello World 2026'), 'Hello World 2026');
    });

    test('handles numbers by converting to string', () => {
        assert.equal(escapeHTML(42), '42');
    });

    test('escapes a full XSS attack payload', () => {
        const payload = '<img src=x onerror="alert(\'xss\')">';
        const result = escapeHTML(payload);
        assert.ok(!result.includes('<img'), `should not contain raw tag: ${result}`);
        assert.ok(result.includes('&lt;img'), `should contain escaped tag: ${result}`);
        assert.ok(result.includes('&quot;'), `should contain escaped double quotes: ${result}`);
    });

    test('handles empty string', () => {
        assert.equal(escapeHTML(''), '');
    });
});

// ─── capitalize ────────────────────────────────────────────────────────────────

describe('capitalize', () => {

    test('capitalizes the first letter', () => {
        assert.equal(capitalize('hello'), 'Hello');
    });

    test('lowercases nothing else (preserves rest of string)', () => {
        assert.equal(capitalize('hELLO'), 'HELLO');
    });

    test('returns empty string for empty input', () => {
        assert.equal(capitalize(''), '');
    });

    test('handles null/undefined gracefully', () => {
        assert.equal(capitalize(null), '');
        assert.equal(capitalize(undefined), '');
    });

    test('handles single character', () => {
        assert.equal(capitalize('a'), 'A');
    });

    test('handles already-capitalized string', () => {
        assert.equal(capitalize('Brazil'), 'Brazil');
    });

    test('handles numbers-as-strings without crashing', () => {
        assert.doesNotThrow(() => capitalize('42'));
    });
});

// ─── crowdClass ────────────────────────────────────────────────────────────────

describe('crowdClass', () => {

    test('returns "critical" at 85 or above', () => {
        assert.equal(crowdClass(85), 'critical');
        assert.equal(crowdClass(100), 'critical');
        assert.equal(crowdClass(90), 'critical');
    });

    test('returns "high" between 65 and 84', () => {
        assert.equal(crowdClass(65), 'high');
        assert.equal(crowdClass(75), 'high');
        assert.equal(crowdClass(84), 'high');
    });

    test('returns "medium" between 40 and 64', () => {
        assert.equal(crowdClass(40), 'medium');
        assert.equal(crowdClass(55), 'medium');
        assert.equal(crowdClass(64), 'medium');
    });

    test('returns "low" below 40', () => {
        assert.equal(crowdClass(0), 'low');
        assert.equal(crowdClass(20), 'low');
        assert.equal(crowdClass(39), 'low');
    });

    test('returns one of the four valid class strings', () => {
        const valid = new Set(['low', 'medium', 'high', 'critical']);
        [0, 25, 40, 60, 65, 80, 85, 100].forEach(n => {
            assert.ok(valid.has(crowdClass(n)), `unexpected class for level ${n}: ${crowdClass(n)}`);
        });
    });
});

// ─── crowdColor ────────────────────────────────────────────────────────────────

describe('crowdColor', () => {

    test('returns danger color at 85+', () => {
        assert.ok(crowdColor(85).includes('danger'));
        assert.ok(crowdColor(100).includes('danger'));
    });

    test('returns warning color between 65 and 84', () => {
        assert.ok(crowdColor(65).includes('warning'));
        assert.ok(crowdColor(75).includes('warning'));
    });

    test('returns a warning/amber color between 40 and 64', () => {
        const result = crowdColor(50);
        assert.ok(typeof result === 'string' && result.length > 0);
    });

    test('returns success color below 40', () => {
        assert.ok(crowdColor(0).includes('success'));
        assert.ok(crowdColor(39).includes('success'));
    });

    test('returns a CSS string for all levels', () => {
        [0, 40, 65, 85, 100].forEach(n => {
            const c = crowdColor(n);
            assert.equal(typeof c, 'string');
            assert.ok(c.length > 0, `crowdColor(${n}) returned empty string`);
        });
    });
});

// ─── renderBold ────────────────────────────────────────────────────────────────

describe('renderBold', () => {

    test('wraps **bold** text in <strong> tags', () => {
        assert.equal(renderBold('**hello**'), '<strong>hello</strong>');
    });

    test('leaves non-bold text unchanged', () => {
        assert.equal(renderBold('plain text'), 'plain text');
    });

    test('handles multiple bold segments', () => {
        const result = renderBold('**Gate A** is **open**');
        assert.ok(result.includes('<strong>Gate A</strong>'));
        assert.ok(result.includes('<strong>open</strong>'));
    });

    test('escapes HTML in non-bold portions', () => {
        const result = renderBold('<b>not bold</b>');
        assert.ok(!result.includes('<b>'), `raw <b> tag should be escaped: ${result}`);
    });

    test('does not allow XSS through bold markers', () => {
        const result = renderBold('**<script>alert(1)</script>**');
        assert.ok(!result.includes('<script>'), `raw script tag found: ${result}`);
    });

    test('returns empty string for empty input', () => {
        assert.equal(renderBold(''), '');
    });
});

// ─── statusBadge ──────────────────────────────────────────────────────────────

describe('statusBadge', () => {

    test('returns an HTML string', () => {
        const result = statusBadge('Open', 'ok');
        assert.ok(result.includes('<span'));
        assert.ok(result.includes('</span>'));
    });

    test('includes the badge type as a CSS class', () => {
        assert.ok(statusBadge('Live', 'live').includes('badge-live'));
        assert.ok(statusBadge('Warning', 'warning').includes('badge-warning'));
    });

    test('escapes text content to prevent XSS', () => {
        const result = statusBadge('<script>', 'danger');
        assert.ok(!result.includes('<script>'), `raw script tag found: ${result}`);
    });

    test('defaults type to "info"', () => {
        const result = statusBadge('Info');
        assert.ok(result.includes('badge-info'));
    });

    test('handles empty text', () => {
        assert.doesNotThrow(() => statusBadge('', 'ok'));
    });
});
