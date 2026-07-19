# ⚽ StadiumFlow AI
### Production-Grade Smart Stadium OS · FIFA World Cup 2026 · MetLife Stadium, NJ

> **Google GenAI Hackathon Project** — A complete Stadium Operating System powered by Gemini 2.5 Flash and a centralized AI context engine. Built to the standard of an official FIFA deployment.

[![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%202.5%20Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)
[![FIFA World Cup 2026](https://img.shields.io/badge/FIFA%20World%20Cup-2026%20%F0%9F%8F%86-gold)](https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026)
[![MetLife Stadium](https://img.shields.io/badge/Venue-MetLife%20Stadium%20NJ-0a7cff)](https://www.metlifestadium.com)
![Offline First](https://img.shields.io/badge/Offline-First-success)

---

## Live 
https://stadiumflow.vercel.app/



## 🌟 Vision

**StadiumFlow AI** is a premium, mobile-first smart stadium companion built for the **FIFA World Cup 2026 at MetLife Stadium, East Rutherford, New Jersey**. It serves four roles simultaneously — fans, organizers, volunteers, and operations staff — all driven by a single AI intelligence layer.

Instead of isolated features, StadiumFlow aggregates **real MetLife Stadium data**, a match-phase-aware **live simulation engine**, user profile, accessibility needs, and kickoff timeline into a **unified Context Engine** — then feeds everything to Gemini in one richly structured prompt.

---

## 🚀 Feature Overview

### 🙋 Fan Companion
| Feature | Description |
|---------|-------------|
| **Home Dashboard** | Live gate status, recommended entry gate, wait time, weather, match phase, crowd level |
| **Proactive AI Card** | Gemini proactively surfaces advice before you ask — _"Gate B is surging. Try Gate G — 3 min wait"_ |
| **Digital Ticket Wallet** | Show your FIFA ticket with seat/section/gate info and a scannable barcode |
| **AI Assistant** | Multi-turn chat with typing indicator, 7-language support, conversation history, quick-prompt chips |
| **Smart Navigation** | 5 route types: Fastest · Least Crowded · Accessible · Family-Friendly · Emergency |
| **Live Crowd Intelligence** | Zone density heatmap, gate predictions, concourse congestion |
| **Smart Concessions** | Dietary filters (Halal/Vegan/Vegetarian/GF), real-time queue times, **Digital Virtual Queue** |
| **Match Day Planner** | AI-generated timeline: when to arrive, eat, find your seat, best exit strategy |
| **Sustainability Card** | CO₂ saved, eco score, transit mode, water refill count |
| **Emergency SOS** | Full-screen takeover, nearest exits, AI evacuation plan, 911 shortcut |

### 📊 Organizer Command Center
| Feature | Description |
|---------|-------------|
| **AI Situation Report** | Natural-language summary of all gates, zones, alerts, and volunteer status |
| **Live KPI Grid** | Attendance, crowd level, gates open, eco score — updated every 15 seconds |
| **Critical Alerts** | Color-coded severity feed for incidents, congestion, and weather |
| **AI Immediate Actions** | Ranked list of recommended interventions — with one-tap execution |
| **Volunteer Redeployment** | AI-generated deployment suggestions based on real-time crowd spikes |
| **Sustainability Dashboard** | Live eco score, carbon saved, recycling rate, public transport % |

### 🦺 Volunteer Hub
| Feature | Description |
|---------|-------------|
| **AI Task Feed** | Live assignments based on current crowd conditions |
| **Quick Ops Buttons** | Crowd control · Accessibility assist · Lost child protocol · Medical dispatch |
| **Translation Assistant** | Real-time phrase translation into 6 languages for international visitors |
| **Incident Reporting** | Log incidents with location, type, and severity |

### 👷 Staff Operations
| Feature | Description |
|---------|-------------|
| **Gate Control Panel** | Click-to-toggle gates (Open/Closed); routing updates automatically |
| **Live Density Feeds** | Concourse zone fills and crowd pressure |
| **Facility Dispatch** | Cleaning teams, bin overflow, maintenance logging |

---

## 🏛️ Technical Architecture

```
index.html
  └── src/app.js  ← lean bootstrapper, lazy-loads role modules
        │
        ├── services/contextEngine.js  ← single source of truth (9 data domains)
        │     ├── data/metlife_stadium.js   ← real gate/food/zone/parking data
        │     ├── data/match_schedule.js    ← Brazil 🇧🇷 vs Germany 🇩🇪 · July 14, 2026
        │     └── services/simulation.js   ← match-phase-aware live engine (15s tick)
        │
        ├── services/ai.js  ← 13 Gemini functions + TTL cache + offline fallbacks
        │
        ├── utils/dom.js    ← XSS-safe DOM utilities
        ├── utils/time.js   ← kickoff countdown, match phase formatter, ET time
        │
        └── modules/
              ├── fan.js        ← 7 views (Home, AI, Navigate, Crowd, Food, Plan, SOS)
              ├── organizer.js  ← command center
              ├── volunteer.js  ← task management + translation
              └── staff.js      ← gate control + ops
```

### Key Design Decisions

- **No framework** — Pure ES Modules, zero build step, instant load
- **Offline-first** — Every AI function has a rich, pre-computed fallback. Works without a Gemini key
- **Single context snapshot** — `contextEngine.getSnapshot()` builds one structured payload; every AI call reads from it
- **Match-phase simulation** — Pre-match rush → Half-time surge → Post-match exodus all produce realistic crowd/queue changes automatically
- **Lazy module loading** — Role modules (fan.js etc.) are only imported when that role is selected; keeps initial load fast
- **XSS-safe** — All user-facing strings go through `escapeHTML()` before DOM injection

---

## 🗂️ File Structure

```
messiisdagoat/
├── index.html                    ← 4-role app shell (7 fan views)
├── src/
│   ├── app.js                    ← bootstrapper + global emergency overlay
│   ├── config.js                 ← API keys (gitignored)
│   ├── config.js.example         ← template
│   ├── data/
│   │   ├── metlife_stadium.js    ← gates, food, zones, parking, transport, medical
│   │   └── match_schedule.js     ← match data + phase logic
│   ├── services/
│   │   ├── ai.js                 ← 13 Gemini-backed AI functions
│   │   ├── contextEngine.js      ← global state (9 domains)
│   │   ├── simulation.js         ← live match-phase simulation
│   │   ├── maps.js               ← Google Maps (MetLife coords, gate markers)
│   │   ├── auth.js               ← Firebase Auth (optional, graceful fallback)
│   │   └── db.js                 ← Firestore (optional, graceful fallback)
│   ├── modules/
│   │   ├── fan.js                ← full fan UI logic (753 lines)
│   │   ├── organizer.js          ← command center logic
│   │   ├── volunteer.js          ← task + translation logic
│   │   └── staff.js              ← gate control logic
│   ├── utils/
│   │   ├── dom.js                ← escapeHTML, safeText, animateNumber, updateNavBadge
│   │   ├── time.js               ← kickoff countdown, formatMatchPhase, formatTimeET
│   │   └── cache.js              ← TTL cache for Gemini responses
│   ├── styles/
│   │   └── styles.css            ← dark glassmorphism design system (2500+ lines)
│   └── test/
│       └── recommendations.test.js  ← 10 integration tests
└── README.md
```

---

## ⚙️ Quick Start

> The app works **100% without any API keys** using built-in intelligent fallbacks.

### Step 1 — Get a Gemini Key (Optional but Recommended)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a free API key
3. Open `src/config.js` and paste it:

```js
// src/config.js
export const CONFIG = {
    GEMINI_API_KEY: "YOUR_KEY_HERE",   // ← paste here
    FIREBASE: { ... },                  // optional
    GOOGLE_MAPS_API_KEY: ""             // optional
};
```

### Step 2 — Serve Locally

**Python (macOS built-in):**
```bash
python3 -m http.server 8000
```
Open → [http://localhost:8000](http://localhost:8000)

**Node.js:**
```bash
npx serve
```
Open → [http://localhost:3000](http://localhost:3000)

### Step 3 — Choose Your Role

| Role | What You'll See |
|------|----------------|
| 🙋 **Fan** | Full match-day companion with AI chat, navigation, food queues, ticket wallet |
| 📊 **Organizer** | Real-time command center with AI situation reports and KPIs |
| 🦺 **Volunteer** | Task feed, translation tool, incident reporting |
| 👷 **Staff** | Gate toggle controls and live density feeds |

### Step 4 — Run Integration Tests (Optional)

Open DevTools → Console, then:
```js
window.runStadiumTests()
```
Runs 10 tests covering food recommendations, crowd analysis, navigation, emergency plans, context engine, and notifications.

---

## 🌐 AI Functions Reference

| Function | Description |
|----------|-------------|
| `chat()` | Multi-turn conversational assistant with full context |
| `recommendFood()` | Shortest queue + dietary filter recommendation |
| `analyzeCrowd()` | Zone-by-zone crowd intelligence with hotspots |
| `generateNavigationPlan()` | Step-by-step route to seat by type |
| `generateProactiveSuggestion()` | Surfaces the most important action right now |
| `generateEmergencyPlan()` | Evacuation steps + assembly point |
| `generateMatchDayPlan()` | Full match-day timeline from arrival to exit |
| `generateExitStrategy()` | Post-match crowd exit optimization |
| `translateMessage()` | Real-time phrase translation into 6 languages |
| `summarizeOperations()` | Organizer AI situation report |
| `recommendVolunteerDeployment()` | AI volunteer placement suggestions |
| `generateSustainabilityReport()` | Eco impact summary |

---

## 🔧 Configuration Reference

```js
// src/config.js
export const CONFIG = {
    // Required for live AI — free at aistudio.google.com
    GEMINI_API_KEY: "your_gemini_api_key_here",

    // Optional — enables real-time Firestore sync
    FIREBASE: {
        apiKey: "...", authDomain: "...", projectId: "...",
        storageBucket: "...", messagingSenderId: "...", appId: "..."
    },

    // Optional — enables interactive stadium map with crowd heatmap
    GOOGLE_MAPS_API_KEY: "your_maps_api_key_here"
};
```

All three integrations **gracefully degrade** — the app never crashes without them.

---

## 👨‍💻 Author

**Jay Dhokne**  
IT Student · Developer · Creative Technologist

- **GitHub**: [@urstrulyyjay](https://github.com/urstrulyyjay)
- **Repository**: [messiisdagoat](https://github.com/urstrulyyjay/messiisdagoat)

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!  
Built with ❤️ for the FIFA World Cup 2026 · Powered by Gemini AI
