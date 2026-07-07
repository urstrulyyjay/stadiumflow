// src/services/ai.js
// Gemini AI Service — Single instance, 8 functions, all context-aware
// Every function receives a context snapshot from contextEngine.getSnapshot()
// Graceful fallback to local logic when API key is not configured.

import { CONFIG } from '../config.js';

// ─── Gemini Lazy Init ────────────────────────────────────────────────────────
const isGeminiConfigured = CONFIG.GEMINI_API_KEY &&
    CONFIG.GEMINI_API_KEY !== "" &&
    CONFIG.GEMINI_API_KEY !== "your_gemini_api_key_here";

let _aiInstance = null;
let _aiPromise = null;

async function getAI() {
    if (!isGeminiConfigured) return null;
    if (_aiInstance) return _aiInstance;
    if (_aiPromise) return _aiPromise;
    _aiPromise = (async () => {
        try {
            const { GoogleGenAI } = await import('https://esm.sh/@google/genai');
            _aiInstance = new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });
            console.log('[GeminiService] Initialized.');
            return _aiInstance;
        } catch (e) {
            console.warn('[GeminiService] Init failed, using fallback:', e.message);
            return null;
        }
    })();
    return _aiPromise;
}

// ─── Core Helper ─────────────────────────────────────────────────────────────
async function geminiGenerate(systemPrompt, userPrompt) {
    const ai = await getAI();
    if (!ai) return null;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'text/plain',
            }
        });
        return response.text;
    } catch (e) {
        console.warn('[GeminiService] generateContent error:', e.message);
        return null;
    }
}

async function geminiGenerateJSON(systemPrompt, userPrompt) {
    const ai = await getAI();
    if (!ai) return null;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
            }
        });
        const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.warn('[GeminiService] JSON generation error:', e.message);
        return null;
    }
}

// ─── Build context string for system instructions ─────────────────────────────
function buildContextString(ctx) {
    return `
STADIUM CONTEXT (FIFA World Cup 2026 — Live Data):
Match: ${ctx.match.homeTeam} vs ${ctx.match.awayTeam}
Venue: ${ctx.match.venue}
Phase: ${ctx.match.currentPhase} | Kickoff in: ${ctx.match.minutesUntilKickoff} min
Attendance: ${ctx.match.attendance}/${ctx.match.capacity}

USER:
Role: ${ctx.user.role} | Seat: ${ctx.user.seat} | Gate: ${ctx.user.gate}
Language: ${ctx.user.language}
Accessibility: ${JSON.stringify(ctx.user.accessibility)}
Dietary preferences: ${ctx.user.preferences.dietaryRestrictions.join(', ') || 'none'}
Walking speed: ${ctx.user.preferences.walkingSpeed}
Current location: ${ctx.user.location.zone}

LIVE GATES:
${Object.values(ctx.stadium.gates).map(g =>
    `${g.name} (${g.direction}): ${g.crowdLevel}% full | Wait: ${g.avgWait}min | Status: ${g.status}`
).join('\n')}

FOOD QUEUES:
${Object.values(ctx.stadium.food).map(f =>
    `${f.name} (${f.section}): ${f.queueTime}min wait | ${f.distance} | Dietary: ${f.dietary.join(',')}`
).join('\n')}

ZONES:
${Object.values(ctx.stadium.zones).map(z =>
    `${z.name}: ${z.density}% density | Trend: ${z.trend}`
).join('\n')}

WEATHER: ${ctx.stadium.weather.temp}°C, ${ctx.stadium.weather.condition}
TRANSPORT: ${Object.values(ctx.stadium.transport).map(t => `${t.name}: ${t.status}`).join(' | ')}
EMERGENCY ACTIVE: ${ctx.emergency.active}
`.trim();
}

// ─── 1. CHAT — Main AI Assistant ─────────────────────────────────────────────
export async function chat(userMessage, ctx) {
    const system = `You are StadiumFlow AI, an intelligent assistant for fans at the FIFA World Cup 2026.
You have access to live stadium data and help fans with navigation, food, queues, directions, translation, and emergencies.
Be concise, friendly, and action-oriented. Use emoji where appropriate. Maximum 3 sentences per response.
If asked to translate, translate directly. If asked for navigation, give step-by-step directions.
Always prioritize safety if emergency is active.

${buildContextString(ctx)}

RECENT CONVERSATION:
${ctx.conversationHistory.map(m => `${m.role === 'user' ? 'Fan' : 'AI'}: ${m.content}`).join('\n')}`;

    const text = await geminiGenerate(system, userMessage);
    if (text) return text;

    // ── Local Fallback ──
    const msg = userMessage.toLowerCase();
    const bestGate = Object.values(ctx.stadium.gates)
        .filter(g => g.status === 'open')
        .sort((a, b) => a.crowdLevel - b.crowdLevel)[0];
    const fastFood = Object.values(ctx.stadium.food)
        .sort((a, b) => a.queueTime - b.queueTime)[0];

    if (msg.includes('gate') || msg.includes('enter') || msg.includes('entry')) {
        return `🚪 Head to **${bestGate?.name || 'Gate B'}** — only ${bestGate?.avgWait || 5} min wait! It's the least crowded right now. Follow the green signs from your current location.`;
    }
    if (msg.includes('food') || msg.includes('eat') || msg.includes('hungry')) {
        return `🍔 **${fastFood?.name || 'Drinks Bar'}** has the shortest queue right now — only ${fastFood?.queueTime || 3} min wait. It's ${fastFood?.distance || '1 min walk'} away.`;
    }
    if (msg.includes('washroom') || msg.includes('toilet') || msg.includes('restroom')) {
        return `🚻 Nearest washroom is at **Section 103**, 2 min walk from your current position. Follow the blue signs along the main concourse.`;
    }
    if (msg.includes('seat') || msg.includes('where is')) {
        return `💺 Your seat is **${ctx.user.seat}** in the ${ctx.user.section}. From Gate B, follow the green corridor to Section A — about 8 min walk.`;
    }
    if (msg.includes('parking') || msg.includes('car')) {
        const lot = Object.values(ctx.stadium.parking).sort((a, b) => b.available - a.available)[0];
        return `🅿️ **${lot?.name}** has the most spaces (${lot?.available} available) — ${lot?.distance} from your gate. EV charging: ${lot?.ev ? 'Available ✅' : 'Not available'}.`;
    }
    if (msg.includes('emergency') || msg.includes('help') || msg.includes('danger')) {
        return `🚨 **Emergency assistance**: Nearest exit is **Gate B**, 3 min away. Medical center is at the Gate B entrance. Stay calm and follow the orange emergency signs.`;
    }
    if (msg.includes('translat')) {
        return `🌐 I can translate to Spanish, French, Arabic, Hindi, Japanese, or Portuguese! Just tell me what to translate and the target language.`;
    }
    if (msg.includes('transport') || msg.includes('train') || msg.includes('bus')) {
        return `🚊 **Express Shuttle #42** is arriving in 5 min with low crowding — best option right now! PATH Train is delayed (~15 min). Rideshare wait: 12-18 min from Gate E.`;
    }
    return `👋 I'm StadiumFlow AI, your smart stadium companion for Brazil vs Germany! I can help with navigation, food, queues, translations, and emergencies. What do you need?`;
}

// ─── 2. NAVIGATION PLAN ───────────────────────────────────────────────────────
export async function generateNavigationPlan(destination, routeType, ctx) {
    // routeType: fastest | least-crowded | accessible | family | emergency
    const system = `You are a stadium navigation AI for FIFA World Cup 2026.
Generate a clear, step-by-step navigation plan. Use emoji for each step.
Output ONLY a JSON object with: { "steps": ["step1", "step2", ...], "eta": "X min", "distance": "X m", "notes": "any special note" }

${buildContextString(ctx)}`;

    const prompt = `Generate a ${routeType} route to: ${destination}. User is currently at: ${ctx.user.location.zone}.`;
    const result = await geminiGenerateJSON(system, prompt);
    if (result) return result;

    // ── Local Fallback ──
    const etas = { fastest: '8', 'least-crowded': '12', accessible: '10', family: '14', emergency: '3' };
    const steps = {
        fastest:       ['🚶 Exit parking via North ramp', '➡️ Follow green signs to Gate B', '🏟️ Enter at turnstile 12', '📍 Take escalator to Level 2', `💺 Find seat ${ctx.user.seat} in Row A`],
        'least-crowded': ['🚶 Take East walkway from parking', '↗️ Use underpass to Gate E', '🏟️ Enter at turnstile 8', '🔵 Follow blue corridor (less crowded)', `💺 Arrive at seat ${ctx.user.seat}`],
        accessible:    ['♿ Take accessible ramp from parking', '🅿️ Use designated accessible path', '🏟️ Enter at Gate B accessible gate', '🛗 Take elevator to Level 2', `💺 Accessible seating area near ${ctx.user.seat}`],
        family:        ['👨‍👩‍👧 Use family-friendly path from parking', '🚸 Follow yellow family signs', '🏟️ Enter at Gate B family lane', '🎠 Kids zone is on Level 1', `💺 Reach seat ${ctx.user.seat} via ramp`],
        emergency:     ['🚨 MOVE IMMEDIATELY to nearest exit', '➡️ Gate B is closest — 3 min away', '🏃 Do not use elevators', '👮 Follow orange emergency signs', '✅ Assemble at South Muster Point'],
    };
    return {
        steps: steps[routeType] || steps.fastest,
        eta: `${etas[routeType] || '8'} min`,
        distance: '420 m',
        notes: routeType === 'accessible' ? 'All paths are wheelchair accessible' :
               routeType === 'emergency' ? 'Emergency route — shortest path to safety' : '',
    };
}

// ─── 3. CROWD ANALYSIS ───────────────────────────────────────────────────────
export async function analyzeCrowd(ctx) {
    const system = `You are a crowd intelligence AI for a FIFA stadium.
Analyze the current crowd data and predict the next 10 minutes.
Output ONLY JSON: { "overallLevel": "low|medium|high|critical", "hotspots": ["zone: reason"], "predictions": ["gate: prediction"], "recommendation": "one sentence action" }

${buildContextString(ctx)}`;

    const result = await geminiGenerateJSON(system, 'Analyze current crowd levels and predict next 10 minutes.');
    if (result) return result;

    // ── Local Fallback ──
    const zones = Object.values(ctx.stadium.zones);
    const avgDensity = zones.reduce((s, z) => s + z.density, 0) / zones.length;
    const level = avgDensity > 80 ? 'critical' : avgDensity > 65 ? 'high' : avgDensity > 40 ? 'medium' : 'low';
    const hotspots = zones.filter(z => z.density > 70).map(z => `${z.name}: ${z.density}% full, ${z.trend}`);
    return {
        overallLevel: level,
        hotspots: hotspots.length ? hotspots : ['No critical hotspots currently'],
        predictions: [
            `Gate A: Expected to reach ${Math.min(100, ctx.stadium.gates.gateA?.predictedIn10 || 95)}% in 10 min`,
            `Gate B: Will stay around ${ctx.stadium.gates.gateB?.predictedIn10 || 40}% — recommended`,
        ],
        recommendation: level === 'high' || level === 'critical'
            ? 'Redirect fans from North Concourse to South entrance — open Gate E at full capacity.'
            : 'Crowd levels manageable. Monitor North Concourse — trend is rising.',
    };
}

// ─── 4. FOOD RECOMMENDATION ──────────────────────────────────────────────────
export async function recommendFood(preferences, ctx) {
    const system = `You are a food recommendation AI for a FIFA stadium.
Consider queue times, dietary preferences, walking distance, and fan preferences.
Output ONLY JSON: { "trigger": true/false, "topPick": { "name": "", "reason": "", "waitTime": 0, "distance": "" }, "alternatives": [{ "name": "", "waitTime": 0 }], "message": "" }

${buildContextString(ctx)}`;

    const prompt = `Recommend food for a fan with preferences: ${JSON.stringify(preferences)}. Prioritize short queues and dietary compatibility.`;
    const result = await geminiGenerateJSON(system, prompt);
    if (result) return result;

    // ── Local Fallback ──
    let stalls = Object.values(ctx.stadium.food);
    if (preferences?.dietary?.length) {
        const filtered = stalls.filter(s => preferences.dietary.some(d => s.dietary.includes(d)));
        if (filtered.length) stalls = filtered;
    }
    stalls.sort((a, b) => a.queueTime - b.queueTime);
    const top = stalls[0];
    return {
        trigger: true,
        topPick: { name: top.name, reason: `Shortest queue and matches your preferences`, waitTime: top.queueTime, distance: top.distance },
        alternatives: stalls.slice(1, 3).map(s => ({ name: s.name, waitTime: s.queueTime })),
        message: `🍽️ Best option right now: **${top.name}** — only ${top.queueTime} min wait, ${top.distance}.`,
    };
}

// ─── 5. QUEUE ESTIMATE ───────────────────────────────────────────────────────
export async function estimateQueue(stallId, ctx) {
    const stall = ctx.stadium.food[stallId];
    if (!stall) return { waitTime: 0, trend: 'unknown', bestArrival: 'now' };

    const system = `You are a queue prediction AI for a stadium food court.
Output ONLY JSON: { "currentWait": 0, "waitIn15min": 0, "trend": "rising|falling|stable", "bestArrivalTime": "now|15min|30min", "reason": "" }

${buildContextString(ctx)}`;

    const result = await geminiGenerateJSON(system, `Predict queue for: ${stall.name} (current wait: ${stall.queueTime} min)`);
    if (result) return result;

    // ── Local Fallback ──
    const trendMap = { rising: stall.queueTime + 8, falling: Math.max(0, stall.queueTime - 5), stable: stall.queueTime };
    return {
        currentWait: stall.queueTime,
        waitIn15min: trendMap[stall.queueTime > 15 ? 'rising' : 'stable'],
        trend: stall.queueTime > 15 ? 'rising' : 'stable',
        bestArrivalTime: stall.queueTime > 15 ? '30min' : 'now',
        reason: stall.queueTime > 15 ? 'Pre-match rush — wait 30 min for shorter queues.' : 'Good time to go now before pre-match rush.',
    };
}

// ─── 6. EMERGENCY PLAN ───────────────────────────────────────────────────────
export async function generateEmergencyPlan(emergencyType, ctx) {
    const system = `You are an emergency response AI for a FIFA World Cup stadium with 82,000 fans.
Generate an immediate, clear evacuation/emergency plan. Safety is the absolute priority.
Output ONLY JSON: { "immediateActions": ["action"], "evacuationRoute": ["step"], "nearestExit": "", "nearestMedical": "", "broadcastMessage": "", "doNotDo": ["warning"] }

${buildContextString(ctx)}`;

    const result = await geminiGenerateJSON(system, `Emergency type: ${emergencyType}. Generate immediate response plan.`);
    if (result) return result;

    // ── Local Fallback ──
    const exit = Object.values(ctx.stadium.gates).filter(g => g.status === 'open').sort((a, b) => a.crowdLevel - b.crowdLevel)[0];
    const medical = Object.values(ctx.stadium.medical)[0];
    return {
        immediateActions: ['🚨 Stay calm and do not panic', '📱 Follow StadiumFlow AI instructions', '🚪 Move to nearest exit immediately', '📞 Call emergency: 911'],
        evacuationRoute: [`Move to ${exit?.name || 'Gate B'}`, 'Follow orange emergency signs', 'Use stairs — NOT elevators', 'Assemble at South Muster Point'],
        nearestExit: exit?.name || 'Gate B',
        nearestMedical: medical?.location || 'Gate B Entrance',
        broadcastMessage: `⚠️ ATTENTION: Please proceed calmly to the nearest exit. Follow staff instructions. Emergency services are on site.`,
        doNotDo: ['❌ Do not use elevators', '❌ Do not run or push', '❌ Do not use mobile phones while walking', '❌ Do not return to collect belongings'],
    };
}

// ─── 7. TRANSLATE MESSAGE ────────────────────────────────────────────────────
export async function translateMessage(text, targetLang, ctx) {
    const langNames = { es: 'Spanish', fr: 'French', ar: 'Arabic', hi: 'Hindi', ja: 'Japanese', pt: 'Portuguese', en: 'English' };
    const langName = langNames[targetLang] || targetLang;

    const system = `You are a multilingual stadium assistant for FIFA World Cup 2026. Translate the given text to ${langName} naturally and fluently. Return ONLY the translated text, nothing else.`;
    const translated = await geminiGenerate(system, text);
    if (translated) return translated;

    // ── Local Fallback (key phrases only) ──
    const phrases = {
        es: { 'Where is my seat?': '¿Dónde está mi asiento?', 'Help me': 'Ayúdame', 'Emergency': 'Emergencia' },
        fr: { 'Where is my seat?': 'Où est mon siège?', 'Help me': 'Aidez-moi', 'Emergency': 'Urgence' },
        ar: { 'Where is my seat?': 'أين مقعدي؟', 'Help me': 'ساعدني', 'Emergency': 'طوارئ' },
        hi: { 'Where is my seat?': 'मेरी सीट कहाँ है?', 'Help me': 'मेरी मदद करें', 'Emergency': 'आपातकाल' },
    };
    return phrases[targetLang]?.[text] || `[${langName} translation]: ${text}`;
}

// ─── 8. SUMMARIZE OPERATIONS (Organizer) ─────────────────────────────────────
export async function summarizeOperations(ctx) {
    const system = `You are an AI Operations Manager for a FIFA World Cup stadium.
Provide an executive summary for the Organizer/Command Center.
Output ONLY JSON: {
  "situationSummary": "",
  "criticalAlerts": ["alert"],
  "gateRecommendations": ["recommendation"],
  "volunteerDeployment": ["deployment"],
  "predictedChallenges": ["challenge"],
  "immediateActions": ["action"],
  "overallStatus": "normal|watch|warning|critical"
}

${buildContextString(ctx)}`;

    const result = await geminiGenerateJSON(system, 'Generate complete operations summary for command center.');
    if (result) return result;

    // ── Local Fallback ──
    const criticalZones = Object.values(ctx.stadium.zones).filter(z => z.density > 80);
    const overloadedGates = Object.values(ctx.stadium.gates).filter(g => g.crowdLevel > 75 && g.status === 'open');
    return {
        situationSummary: `Stadium is operating at ${Math.round(ctx.match.attendance / ctx.match.capacity * 100)}% capacity. ${criticalZones.length} zones are above 80% density. Pre-match crowd surge expected in 45 minutes.`,
        criticalAlerts: [
            ...criticalZones.map(z => `🔴 ${z.name}: ${z.density}% density — trending ${z.trend}`),
            ...overloadedGates.map(g => `⚠️ ${g.name}: ${g.crowdLevel}% capacity, ${g.avgWait}min wait`),
        ],
        gateRecommendations: [
            '✅ Open Gate E to full capacity — currently underutilized at 20%',
            '🔄 Redirect Gate A overflow to Gate B and Gate E',
            '⚠️ Gate D approaching threshold — monitor closely',
        ],
        volunteerDeployment: [
            '👷 Deploy Team Delta from Merch Area to North Concourse (high density)',
            '♿ Team Beta: increase presence at Gate B for pre-match accessibility needs',
            '🌐 Team Gamma: translation support needed at Gate A (international fans)',
        ],
        predictedChallenges: [
            '📈 North Concourse will reach critical density in 20 min',
            '🚌 PATH Train delay will push more fans to Gate E — prepare overflow plan',
            '🍔 Burger Stand will have 35+ min queue at kickoff — prepare overflow food vouchers',
        ],
        immediateActions: [
            '1️⃣ Open Gate E supplementary lanes NOW',
            '2️⃣ Deploy Team Delta to North Concourse',
            '3️⃣ Broadcast alternate route to Gate B/E via StadiumFlow',
        ],
        overallStatus: criticalZones.length > 2 ? 'warning' : 'normal',
    };
}

// ─── 9. VOLUNTEER DEPLOYMENT RECOMMENDATION ───────────────────────────────────
export async function recommendVolunteerDeployment(ctx) {
    const system = `You are a volunteer coordination AI for a FIFA World Cup stadium.
Output ONLY JSON: { "deployments": [{ "team": "", "from": "", "to": "", "task": "", "priority": "high|medium|low", "reason": "" }], "summary": "" }

${buildContextString(ctx)}`;

    const result = await geminiGenerateJSON(system, 'Recommend optimal volunteer deployment based on current stadium conditions.');
    if (result) return result;

    // ── Local Fallback ──
    return {
        deployments: [
            { team: 'Team Alpha', from: 'Gate A', to: 'North Concourse', task: 'crowd-control', priority: 'high', reason: 'North Concourse at 82% density, trending up' },
            { team: 'Team Beta', from: 'South', to: 'Gate B', task: 'accessibility', priority: 'medium', reason: 'Pre-match accessibility rush expected' },
            { team: 'Team Delta', from: 'Merch', to: 'Gate E', task: 'crowd-control', priority: 'medium', reason: 'Transit delay diverting fans to Gate E' },
        ],
        summary: '3 redeployments recommended to manage pre-match crowd surge. Priority: North Concourse.',
    };
}

export const geminiService = {
    chat,
    generateNavigationPlan,
    analyzeCrowd,
    recommendFood,
    estimateQueue,
    generateEmergencyPlan,
    translateMessage,
    summarizeOperations,
    recommendVolunteerDeployment,
};
