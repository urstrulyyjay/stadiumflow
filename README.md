# 🏟️ StadiumFlow AI
### Smart Stadium Companion System for FIFA World Cup 2026
> **Google GenAI-First Hackathon Project** — A complete Stadium Operating System powered by a centralized Gemini 2.5 Flash intelligence layer.

---

## Live 
https://stadiumflow.vercel.app/



## 🌟 Vision
**StadiumFlow AI** is a premium, mobile-first web companion designed for the FIFA World Cup 2026 at MetLife Stadium. Instead of deploying multiple disconnected AI features, StadiumFlow AI aggregates live stadium metrics, user profiles, accessibility needs, and match timelines into a **Single AI Context Engine**. 

From this single intelligence layer, Gemini powers real-time routing, conversational assistance, organizer command centers, multilingual volunteer tasks, and instant emergency protocols.

---

## 🚀 Key Features by Role

### 🙋 1. Fan Companion (User App)
- **🏟️ Premium Home Dashboard**: At-a-glance match overview (Brazil vs Germany), live entry gate congestion alerts, and estimated entry wait times.
- **🤖 AI Stadium Assistant**: An interactive chat interface equipped with multi-turn conversation history, a typing indicator, 7-language support (English, Spanish, French, Arabic, Hindi, Japanese, Portuguese), response copying, and quick-prompt suggestions.
- **⚡ Smart Navigation**: Select from 5 dynamic routing types:
  - *Fastest Route* (minimizes gate queues)
  - *Least Crowded Route* (avoids congested concourses)
  - *Accessible Route* (ramps, elevators, wheelchair friendly)
  - *Family-Friendly Route* (kids zone highlights, lower stairs)
  - *Emergency Route* (quickest path to safety)
- **👥 Live Crowd AI**: Heatmap zone overlays, gate arrival predictions (10-minute forecasts), and parking lot capacities.
- **🍔 Smart Concessions**: Recommends short-wait food stalls, filters by dietary preferences (Halal, Vegan, Vegetarian, Gluten-Free), and enables joining a **Digital Virtual Queue** so you can wait in your seat, not in line.
- **🚨 One-Tap SOS Emergency Mode**: Takeover screen with immediate evacuation routes, nearest exits, and localized assembly warnings.

### 📊 2. Organizer Command Center
- **🧠 AI Situation Report**: Gemini evaluates all active gates, crowd zones, and transit alerts, generating a natural language operational summary for venue directors.
- **⚡ AI Action Recommendations**: Operational items prioritised by severity (e.g. *"Open Gate E supplementary lanes now"*).
- **👷 AI Volunteer Redeployment**: Auto-assigns volunteer teams based on gate congestion or crowd spikes.
- **♻️ Sustainability Dashboard**: Tracks water refills, public transport usage, recycling rates, and dynamic carbon savings, calculated into a visual **Eco Score**.
- **📍 Live Digital Twin**: SVG visualization of the entire stadium arena overlaying live crowd densities, active emergency zones, and volunteer locations.
- **📢 Global Broadcast System**: Direct controls for stadium announcements.

### 🦺 3. Volunteer Hub
- **📍 AI Task Assignment**: Automatically fetches the volunteer's team assignments and priorities.
- **⚡ Quick Operations**: Specialized buttons to get step-by-step Gemini instructions for:
  - *Crowd Control* (Where am I needed?)
  - *Accessibility Assist* (Nearest wheelchair helper)
  - *Lost Child Protocol* (Lost child workflow)
  - *Medical Dispatch* (Nearest first aid)
- **🌐 Translation Assistant**: Real-time translation input to translate phrases for international visitors into Spanish, French, Arabic, Hindi, Japanese, or Portuguese.

### 👷 4. Staff Operations
- **🚪 Gate Management**: Click-to-toggle gates (Open/Closed). The AI engine instantly recalculates routing recommendations to avoid closed gates.
- **📊 Live Density Feeds**: Keep track of concourse fills.
- **🧹 Facility Service Actions**: Dispatch cleaning teams or log bin overflow.

---

## 🛠️ Technical Architecture

StadiumFlow AI is designed as a modular, lightweight, framework-free web app using ES modules for instant loading times and mobile-first responsiveness.

```
          ┌──────────────────────────────────────────────────────────┐
          │                      User Interface                      │
          │         (Fan App, Organizer, Volunteer, Staff)           │
          └────────────────────────────┬─────────────────────────────┘
                                       │ Input/Events
                                       ▼
          ┌──────────────────────────────────────────────────────────┐
          │                    src/app.js (Main)                     │
          └────────────────────────────┬─────────────────────────────┘
                                       │ Reads State
                                       ▼
          ┌──────────────────────────────────────────────────────────┐
          │            src/services/contextEngine.js                 │
          │  - Aggregates user role, seat, gate, queue times,       │
          │    sustainability data, weather, emergency status.       │
          └────────────────────────────┬─────────────────────────────┘
                                       │ Snapshot Payload
                                       ▼
          ┌──────────────────────────────────────────────────────────┐
          │                  src/services/ai.js                      │
          │  - Unified Gemini 2.5 Flash Wrapper                      │
          │  - Local offline fallback models if API key is missing   │
          └──────────────────────────────────────────────────────────┘
```

### File Structure
- `index.html`: Entry point representing the 4-role layouts and bottom navigation frames.
- `src/app.js`: Main coordinator logic managing user navigation, UI rendering, logs, SVG route generation, and chat history.
- `src/styles/styles.css`: Dark mode glassmorphism UI system featuring custom variables, typing indicators, animated alert cards, and layout grids.
- `src/services/contextEngine.js`: Global state aggregator providing a single JSON context snapshot to all AI models.
- `src/services/ai.js`: Main Gemini API integration handler containing the 9 core operational prompts.
- `src/services/mock_data.js`: Simulates stadium updates (queue changes, gate fluctuations, parking ticks) so the dashboard feels alive.

---

## ⚙️ Quick Start & Execution

Since the project utilizes ES modules, opening `index.html` directly (`file://`) will trigger browser security (CORS) blocks. A local web server is required.

### 1. Configure API Keys
Duplicate `src/config.js.example` to `src/config.js` and add your **Gemini API Key**:
```javascript
export const CONFIG = {
  FIREBASE: {
    apiKey: "demo-api-key",
    authDomain: "demo-project.firebaseapp.com",
    projectId: "demo-project"
  },
  GOOGLE_MAPS_API_KEY: "",
  GEMINI_API_KEY: "YOUR_GEMINI_API_KEY_HERE"  // <-- Insert your key here
};
```
*Note: If no key is provided, the application will gracefully fall back to locally calculated intelligent suggestions.*

### 2. Run Locally
Navigate to the `promptwarproject` directory and start a local server:

#### Option A: Node.js (npx)
```bash
npx serve
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Option B: Python (Built-in on macOS)
```bash
python3 -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 👨‍💻 Author
**Jay Dhokne**
IT Student | Developer | Creative Technologist

- **GitHub**: [urstrulyyjay](https://github.com/urstrulyyjay)
- **Repository**: [promptwarproject](https://github.com/urstrulyyjay/promptwarproject)

---

## ⭐ Support
If you like this project, please give it a ⭐ on GitHub!
