// src/services/mock_data.js
// Expanded Mock Data Layer for StadiumFlow AI
// Replace setInterval callbacks with real Firestore / Maps API calls via contextEngine.updateFromRealAPI()

export const stadiumData = {
    gates: {
        "gateA": { id: "gateA", name: "Gate A", direction: "North", crowdLevel: 85, status: "open",  avgWait: 25, capacity: 500, predictedIn10: 95 },
        "gateB": { id: "gateB", name: "Gate B", direction: "South", crowdLevel: 30, status: "open",  avgWait: 5,  capacity: 500, predictedIn10: 40 },
        "gateC": { id: "gateC", name: "Gate C", direction: "VIP",   crowdLevel: 10, status: "open",  avgWait: 2,  capacity: 200, predictedIn10: 15 },
        "gateD": { id: "gateD", name: "Gate D", direction: "East",  crowdLevel: 60, status: "open",  avgWait: 18, capacity: 500, predictedIn10: 75 },
        "gateE": { id: "gateE", name: "Gate E", direction: "West",  crowdLevel: 20, status: "open",  avgWait: 4,  capacity: 400, predictedIn10: 28 },
    },
    food: {
        "stall1": { id: "stall1", name: "Burger Stand",    section: "Sec 102", queueTime: 22, distance: "2 min walk", cuisine: "American",   dietary: ["none"],       popularity: 90, price: "$$" },
        "stall2": { id: "stall2", name: "Pizza Corner",    section: "Sec 104", queueTime: 6,  distance: "4 min walk", cuisine: "Italian",    dietary: ["vegetarian"], popularity: 75, price: "$$" },
        "stall3": { id: "stall3", name: "Drinks Bar",      section: "Sec 101", queueTime: 3,  distance: "1 min walk", cuisine: "Beverages",  dietary: ["vegan"],      popularity: 85, price: "$"  },
        "stall4": { id: "stall4", name: "FIFA Grill",      section: "Sec 106", queueTime: 12, distance: "5 min walk", cuisine: "BBQ",        dietary: ["halal"],      popularity: 95, price: "$$$"},
        "stall5": { id: "stall5", name: "Vegan Garden",    section: "Sec 108", queueTime: 4,  distance: "6 min walk", cuisine: "Vegan",      dietary: ["vegan","gluten-free"], popularity: 60, price: "$$" },
        "stall6": { id: "stall6", name: "Nachos Express",  section: "Sec 103", queueTime: 8,  distance: "3 min walk", cuisine: "Mexican",    dietary: ["vegetarian"], popularity: 70, price: "$"  },
    },
    zones: {
        "zone1": { name: "North Concourse",   density: 75, trend: "rising"  },
        "zone2": { name: "South Concourse",   density: 40, trend: "stable"  },
        "zone3": { name: "Merch Area",         density: 90, trend: "rising"  },
        "zone4": { name: "Fan Zone East",      density: 55, trend: "stable"  },
        "zone5": { name: "VIP Lounge",         density: 25, trend: "falling" },
        "zone6": { name: "Main Concourse",     density: 82, trend: "rising"  },
    },
    parking: {
        "lot1": { id: "lot1", name: "Lot A (North)", available: 45,  total: 500, distance: "5 min",  ev: true  },
        "lot2": { id: "lot2", name: "Lot B (South)", available: 120, total: 600, distance: "8 min",  ev: false },
        "lot3": { id: "lot3", name: "Lot C (VIP)",   available: 30,  total: 150, distance: "2 min",  ev: true  },
        "lot4": { id: "lot4", name: "Lot D (East)",  available: 280, total: 700, distance: "12 min", ev: false },
    },
    medical: {
        "med1": { id: "med1", name: "Medical Center A", location: "Gate B Entrance",  staff: 4,  available: true  },
        "med2": { id: "med2", name: "Medical Center B", location: "South Concourse",  staff: 2,  available: true  },
        "med3": { id: "med3", name: "First Aid Post",   location: "Section 105",       staff: 1,  available: true  },
    },
    volunteers: {
        "vol1": { id: "vol1", name: "Team Alpha",  zone: "Gate A", count: 8, available: 3, tasks: ["crowd-control", "directions"] },
        "vol2": { id: "vol2", name: "Team Beta",   zone: "South",  count: 6, available: 6, tasks: ["accessibility", "medical-assist"] },
        "vol3": { id: "vol3", name: "Team Gamma",  zone: "VIP",    count: 4, available: 2, tasks: ["vip-escort", "translation"] },
        "vol4": { id: "vol4", name: "Team Delta",  zone: "Merch",  count: 5, available: 5, tasks: ["security", "crowd-control"] },
    },
    weather: {
        temp: 24,
        feels: 22,
        condition: "Partly Cloudy",
        humidity: 65,
        wind: "12 km/h SW",
        uvIndex: 3,
        rainChance: 10,
    },
    transport: {
        "subway1":  { name: "NJ Transit Line 1",  status: "On Time",    nextArrival: "8 min",  crowding: "Moderate" },
        "subway2":  { name: "PATH Train",          status: "Delayed",    nextArrival: "15 min", crowding: "High"     },
        "bus1":     { name: "Express Shuttle #42", status: "On Time",    nextArrival: "5 min",  crowding: "Low"      },
        "rideshare":{ name: "Rideshare Zone",      status: "Busy",       eta: "12-18 min",      dropoffPoint: "Gate E" },
    },
    sustainability: {
        carbonSaved:       1240,   // kg CO2
        publicTransportPct: 68,   // % of fans using transit
        waterRefillCount:   4820, // uses today
        plasticReduced:     890,  // items
        walkingKm:          3200, // total km walked by fans
        ecoScore:           82,   // 0-100
        solarPowerPct:      34,   // % energy from solar
        recyclingRate:      71,   // %
    },
    alerts: [
        { id: "a1", type: "info",    message: "Gate A: High congestion. Use Gate B or E.",      time: "13:55" },
        { id: "a2", type: "info",    message: "PATH Train delayed. Shuttle #42 available.",     time: "13:50" },
        { id: "a3", type: "success", message: "Vegan Garden stall now open in Section 108.",    time: "13:45" },
    ],
    routes: {
        currentRoute: { from: "Gate B", to: "Seat A-214", status: "congested", delay: "8 mins", alternateAvailable: true }
    },
};

// ─── Live Simulation ──────────────────────────────────────────────────────────
let _simInterval = null;
let _simCallback = null;

export function startSimulation(callback) {
    _simCallback = callback;
    if (_simInterval) return;
    _simInterval = setInterval(() => {
        simulateLiveUpdates();
        if (_simCallback) {
            _simCallback({
                gates: stadiumData.gates,
                food: stadiumData.food,
                zones: stadiumData.zones,
                parking: stadiumData.parking,
                sustainability: stadiumData.sustainability,
            });
        }
    }, 4000);
}

export function simulateLiveUpdates() {
    // Food queue jitter
    for (let key in stadiumData.food) {
        const diff = Math.floor(Math.random() * 5) - 2;
        stadiumData.food[key].queueTime = Math.max(0, stadiumData.food[key].queueTime + diff);
    }
    // Zone density jitter
    for (let key in stadiumData.zones) {
        const diff = Math.floor(Math.random() * 11) - 5;
        stadiumData.zones[key].density = Math.max(0, Math.min(100, stadiumData.zones[key].density + diff));
    }
    // Gate crowd jitter
    for (let key in stadiumData.gates) {
        if (stadiumData.gates[key].status === 'open') {
            const diff = Math.floor(Math.random() * 5) - 2;
            stadiumData.gates[key].crowdLevel = Math.max(0, Math.min(100, stadiumData.gates[key].crowdLevel + diff));
            stadiumData.gates[key].avgWait = Math.max(0, Math.floor(stadiumData.gates[key].crowdLevel * 0.3));
            // Predict 10-min crowd
            const trendDiff = Math.floor(Math.random() * 12) - 3;
            stadiumData.gates[key].predictedIn10 = Math.max(0, Math.min(100, stadiumData.gates[key].crowdLevel + trendDiff));
        }
    }
    // Parking update
    for (let key in stadiumData.parking) {
        const diff = Math.floor(Math.random() * 7) - 3;
        stadiumData.parking[key].available = Math.max(0, Math.min(stadiumData.parking[key].total, stadiumData.parking[key].available + diff));
    }
}

// Expose to window for legacy compatibility
window.stadiumData = stadiumData;
