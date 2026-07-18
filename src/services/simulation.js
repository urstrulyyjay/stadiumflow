/**
 * src/services/simulation.js
 * StadiumFlow AI — Match-Phase-Aware Live Simulation Engine
 *
 * Replaces the simplistic random-jitter simulation in mock_data.js with
 * a physics-based model driven by match phase and time.
 *
 * Simulation produces realistic crowd, food queue, gate, and
 * parking changes that mirror real stadium dynamics:
 *
 *  Phase Timeline:
 *  ─────────────────────────────────────────────────────────
 *  Pre-Match (−90 to −30 min) : Crowd builds gradually
 *  Pre-Match Rush (−30 to 0)  : Gates surge, food queues spike
 *  First Half (0 to 45 min)   : Gates quiet, concourses clear
 *  Half Time (45 to 60 min)   : Massive concourse surge
 *  Second Half (60 to 105 min): Stadium full, concourses quiet
 *  Post-Match (105+ min)      : Mass exodus, gates re-surge
 */

import { METLIFE_STADIUM } from '../data/metlife_stadium.js';
import { getMinutesUntilKickoff, getCurrentMatchPhase } from '../data/match_schedule.js';

// ─── Internal simulation state ─────────────────────────────────────────────
let _interval = null;
let _callbacks = [];
let _tickCount = 0;
let _alertIdCounter = 10;

// Deep clone initial data so simulation works on live copies
let _liveGates     = deepClone(METLIFE_STADIUM.gates);
let _liveFood      = deepClone(METLIFE_STADIUM.food);
let _liveZones     = deepClone(METLIFE_STADIUM.zones);
let _liveParking   = deepClone(METLIFE_STADIUM.parking);
let _liveSustain   = deepClone(METLIFE_STADIUM.sustainability);
let _pendingAlerts = [];

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ─── Phase multipliers ─────────────────────────────────────────────────────
// Controls how aggressively crowd/queues change per tick in each phase.
function getPhaseParams(minutesToKickoff) {
    if (minutesToKickoff > 60)  return { gateDir: +1, gateMag: 1, foodMag: 0.5, zoneDir: +1, zoneMag: 1 };
    if (minutesToKickoff > 20)  return { gateDir: +1, gateMag: 3, foodMag: 2,   zoneDir: +1, zoneMag: 2 };  // rush
    if (minutesToKickoff > 0)   return { gateDir: +1, gateMag: 4, foodMag: 3,   zoneDir: +1, zoneMag: 3 };  // final rush
    if (minutesToKickoff > -45) return { gateDir: -1, gateMag: 2, foodMag: 1,   zoneDir: -1, zoneMag: 2 };  // 1st half — gates emptying
    if (minutesToKickoff > -60) return { gateDir: +1, gateMag: 3, foodMag: 4,   zoneDir: +1, zoneMag: 4 };  // half time surge
    if (minutesToKickoff > -105)return { gateDir: -1, gateMag: 1, foodMag: 1,   zoneDir: -1, zoneMag: 1 };  // 2nd half
    return                             { gateDir: +1, gateMag: 4, foodMag: -2,  zoneDir: +1, zoneMag: 4 };  // post-match exodus
}

// ─── Gate simulation ───────────────────────────────────────────────────────
function tickGates(params) {
    for (const id in _liveGates) {
        const gate = _liveGates[id];
        if (gate.status !== 'open' || gate.isStaff) continue;

        // Base change: directed movement + small random noise
        const delta = (params.gateDir * params.gateMag) + (Math.random() * 6 - 3);
        gate.crowdLevel = clamp(gate.crowdLevel + delta, 0, 100);

        // VIP and staff gates barely change
        if (gate.isVIP) { gate.crowdLevel = clamp(gate.crowdLevel + (Math.random() * 2 - 1), 0, 30); }

        // Wait time is proportional to crowd level (realistic formula)
        gate.avgWait = Math.max(0, Math.round(gate.crowdLevel * 0.28));

        // 10-minute prediction: follow trend with slight exaggeration
        const trend = params.gateDir * params.gateMag * 2;
        gate.predictedIn10 = clamp(gate.crowdLevel + trend + (Math.random() * 8 - 4), 0, 100);
    }
}

// ─── Food queue simulation ─────────────────────────────────────────────────
function tickFood(params) {
    for (const id in _liveFood) {
        const stall = _liveFood[id];
        const delta = (params.foodMag * (Math.random() * 2 - 0.8));
        stall.queueTime = Math.max(0, Math.round(stall.queueTime + delta));

        // Club level and VIP stalls don't get as crowded
        if (stall.level >= 200) {
            stall.queueTime = Math.min(stall.queueTime, 15);
        }

        // Beverages max at 10 min (many locations)
        if (stall.cuisine === 'Beverages') {
            stall.queueTime = Math.min(stall.queueTime, 10);
        }
    }
}

// ─── Zone density simulation ───────────────────────────────────────────────
function tickZones(params) {
    for (const id in _liveZones) {
        const zone = _liveZones[id];
        const delta = (params.zoneDir * params.zoneMag) + (Math.random() * 10 - 5);
        zone.density = clamp(zone.density + delta, 0, 100);

        // Determine trend
        if (delta > 2)       zone.trend = 'rising';
        else if (delta < -2) zone.trend = 'falling';
        else                 zone.trend = 'stable';

        // Merch zone is always high pre-match, empties at kickoff
        if (id === 'zone_merch') {
            const minsToKO = getMinutesUntilKickoff();
            if (minsToKO > 0)  zone.density = clamp(zone.density + 1, 70, 95);
            else               zone.density = clamp(zone.density - 3, 10, 50);
        }
    }
}

// ─── Parking simulation ───────────────────────────────────────────────────
function tickParking() {
    const minsToKO = getMinutesUntilKickoff();
    for (const id in _liveParking) {
        const lot = _liveParking[id];
        // Pre-match: lots fill; Post-match: lots empty
        const delta = minsToKO > 0 ? -(Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 12) + 2);
        lot.available = clamp(lot.available + delta, 0, lot.total);
    }
}

// ─── Sustainability simulation ────────────────────────────────────────────
function tickSustainability() {
    _liveSustain.waterRefillCount  += Math.floor(Math.random() * 15 + 5);
    _liveSustain.walkingKm         += Math.floor(Math.random() * 8 + 2);
    _liveSustain.carbonSaved       += Math.floor(Math.random() * 5 + 1);
    _liveSustain.plasticReduced    += Math.floor(Math.random() * 3);
    _liveSustain.evChargingSessions+= Math.random() < 0.1 ? 1 : 0;
    // Eco score: slightly adjust based on transport usage
    _liveSustain.ecoScore = clamp(_liveSustain.ecoScore + (Math.random() * 0.4 - 0.15), 75, 92);
    _liveSustain.ecoScore = Math.round(_liveSustain.ecoScore * 10) / 10;
}

// ─── Proactive Alert Injection ────────────────────────────────────────────
// Fires realistic alerts based on thresholds — mirrors real stadium ops.
function checkAlertThresholds() {
    const phase = getCurrentMatchPhase();
    const minsToKO = getMinutesUntilKickoff();

    // Gate A overloading
    if (_liveGates.gateA?.crowdLevel > 85 && _tickCount % 5 === 0) {
        _pendingAlerts.push({
            id: `auto_${_alertIdCounter++}`, type: 'warning',
            message: `Gate A: ${Math.round(_liveGates.gateA.crowdLevel)}% full — redirecting fans to Gate B or C.`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            category: 'gates', auto: true,
        });
    }

    // Shake Shack queue getting too long
    if (_liveFood.shake_shack_b?.queueTime > 25 && _tickCount % 8 === 0) {
        _pendingAlerts.push({
            id: `auto_${_alertIdCounter++}`, type: 'info',
            message: `Shake Shack queue now ${_liveFood.shake_shack_b.queueTime} min — Garden Fresh Vegan Bar only ${_liveFood.garden_fresh.queueTime} min wait.`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            category: 'food', auto: true,
        });
    }

    // Pre-match rush alert
    if (minsToKO === 30 && _tickCount % 20 === 0) {
        _pendingAlerts.push({
            id: `auto_${_alertIdCounter++}`, type: 'warning',
            message: '30 minutes to kickoff — all main gates opening supplementary lanes. Enter now for shorter wait.',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            category: 'gates', auto: true,
        });
    }

    // Half-time warning
    if (phase === 'Half Time' && _tickCount % 15 === 0) {
        _pendingAlerts.push({
            id: `auto_${_alertIdCounter++}`, type: 'info',
            message: 'Half Time: Food courts are at peak. Return to seat 5 min early to beat the rush.',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            category: 'match', auto: true,
        });
    }

    // Coach USA delay update
    if (_tickCount === 3) {
        _pendingAlerts.push({
            id: `auto_${_alertIdCounter++}`, type: 'info',
            message: 'NJ Transit Bus #320 now arriving at Gate D in 5 min. Good alternative to Coach USA shuttle.',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            category: 'transport', auto: true,
        });
    }
}

// ─── Main Tick ─────────────────────────────────────────────────────────────
function tick() {
    _tickCount++;
    const minsToKO = getMinutesUntilKickoff();
    const params = getPhaseParams(minsToKO);

    tickGates(params);
    tickFood(params);
    tickZones(params);
    tickParking();
    if (_tickCount % 3 === 0) tickSustainability();
    checkAlertThresholds();

    // Notify all registered callbacks
    const snapshot = {
        gates:        _liveGates,
        food:         _liveFood,
        zones:        _liveZones,
        parking:      _liveParking,
        sustainability: _liveSustain,
        newAlerts:    [..._pendingAlerts],
    };
    _pendingAlerts = [];

    _callbacks.forEach(cb => { try { cb(snapshot); } catch(e) { console.warn('[Simulation] Callback error:', e.message); } });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Start the simulation. Calls `callback` every `intervalMs` with a state snapshot.
 * Multiple callbacks can be registered.
 * @param {Function} callback - (snapshot) => void
 * @param {number} [intervalMs=4000] - tick interval in milliseconds
 */
export function startSimulation(callback, intervalMs = 4000) {
    _callbacks.push(callback);
    if (_interval) return; // already running
    _interval = setInterval(tick, intervalMs);
    console.log('[Simulation] Started — match-phase-aware engine running.');
}

/**
 * Stop the simulation (e.g. when tab is hidden or role exits).
 */
export function stopSimulation() {
    if (_interval) { clearInterval(_interval); _interval = null; }
    console.log('[Simulation] Stopped.');
}

/**
 * Get the current live gate data (direct reference — read only).
 */
export function getLiveGates()   { return _liveGates; }
export function getLiveFood()    { return _liveFood; }
export function getLiveZones()   { return _liveZones; }
export function getLiveParking() { return _liveParking; }

/**
 * Manually update a gate status (for staff operations).
 * @param {string} gateId
 * @param {string} status - 'open' | 'closed' | 'restricted'
 */
export function setGateStatus(gateId, status) {
    if (_liveGates[gateId]) {
        _liveGates[gateId].status = status;
        if (status === 'closed') {
            _liveGates[gateId].crowdLevel = 0;
            _liveGates[gateId].avgWait = 0;
        }
        console.log(`[Simulation] Gate ${gateId} set to ${status}`);
    }
}

// ─── Utility ───────────────────────────────────────────────────────────────
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
