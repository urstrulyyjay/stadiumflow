/**
 * src/services/maps.js
 * Google Maps Service — MetLife Stadium, East Rutherford, NJ
 *
 * Coordinates corrected to MetLife Stadium (40.8135, -74.0745).
 * Adds real POI markers for gates, medical stations, and parking.
 * Graceful fallback to static SVG map when no API key is configured.
 */

import { CONFIG } from '../config.js';

// MetLife Stadium — correct real-world coordinates
const METLIFE_CENTER = { lat: 40.8135, lng: -74.0745 };

/** Real MetLife Stadium gate locations (approximated ring around stadium) */
const GATE_MARKERS = [
    { lat: 40.8148, lng: -74.0740, label: 'Gate A', icon: '🚪' },
    { lat: 40.8152, lng: -74.0752, label: 'Gate B (Transit)',  icon: '🚆' },
    { lat: 40.8145, lng: -74.0762, label: 'Gate C', icon: '🚪' },
    { lat: 40.8135, lng: -74.0768, label: 'Gate D', icon: '🚪' },
    { lat: 40.8122, lng: -74.0762, label: 'Gate E', icon: '🚐' },
    { lat: 40.8118, lng: -74.0750, label: 'Gate F (Rideshare)', icon: '🚗' },
    { lat: 40.8122, lng: -74.0738, label: 'Gate G', icon: '🚪' },
    { lat: 40.8132, lng: -74.0732, label: 'Gate H', icon: '🚪' },
    { lat: 40.8150, lng: -74.0748, label: 'Gate J (VIP)',   icon: '⭐' },
];

/** Medical and parking POIs */
const POI_MARKERS = [
    { lat: 40.8151, lng: -74.0745, label: 'First Aid — Gate B', icon: '🏥' },
    { lat: 40.8118, lng: -74.0745, label: 'First Aid — Gate F', icon: '🏥' },
    { lat: 40.8165, lng: -74.0748, label: 'Gold Lot 1 — VIP', icon: '🅿️' },
    { lat: 40.8170, lng: -74.0762, label: 'Blue Lot 3', icon: '🅿️' },
    { lat: 40.8100, lng: -74.0735, label: 'Green Lot 6 — EV', icon: '⚡' },
];

let map = null;

const isMapsConfigured = CONFIG.GOOGLE_MAPS_API_KEY &&
    CONFIG.GOOGLE_MAPS_API_KEY !== '' &&
    !CONFIG.GOOGLE_MAPS_API_KEY.toLowerCase().startsWith('your_');

export const initGoogleMap = async (containerId) => {
    if (!isMapsConfigured) {
        console.log('[Maps] Not configured — using static SVG fallback.');
        return;
    }

    try {
        const { Loader } = await import('https://esm.sh/@googlemaps/js-api-loader@1.16.6');

        const loader = new Loader({
            apiKey: CONFIG.GOOGLE_MAPS_API_KEY,
            version: 'weekly',
            libraries: ['visualization', 'marker'],
        });

        const { Map } = await loader.importLibrary('maps');
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        // ✅ Correct MetLife Stadium coordinates
        map = new Map(container, {
            center: METLIFE_CENTER,
            zoom: 16,
            mapId: 'DEMO_MAP_ID',
            disableDefaultUI: true,
            gestureHandling: 'cooperative',
            styles: [{ featureType: 'all', elementType: 'all', stylers: [{ saturation: -60 }, { lightness: -30 }] }],
        });

        // Add gate markers
        const { AdvancedMarkerElement } = await loader.importLibrary('marker');
        [...GATE_MARKERS, ...POI_MARKERS].forEach(poi => {
            const el = document.createElement('div');
            el.title = poi.label;
            el.style.cssText = 'font-size:1.2rem;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
            el.textContent = poi.icon;
            new AdvancedMarkerElement({ map, position: { lat: poi.lat, lng: poi.lng }, content: el, title: poi.label });
        });

        // Crowd density heatmap — points around MetLife footprint
        const { HeatmapLayer } = await loader.importLibrary('visualization');
        const heatmapData = [
            new google.maps.LatLng(40.8150, -74.0752),  // Gate B — high traffic
            new google.maps.LatLng(40.8148, -74.0740),  // Gate A — high traffic
            new google.maps.LatLng(40.8145, -74.0762),  // Gate C
            new google.maps.LatLng(40.8135, -74.0768),  // Gate D
            new google.maps.LatLng(40.8122, -74.0762),  // Gate E
            new google.maps.LatLng(40.8118, -74.0750),  // Gate F — rideshare
            new google.maps.LatLng(40.8140, -74.0745),  // Main concourse
        ];
        new HeatmapLayer({ data: heatmapData, map, radius: 50 });

        console.log('[Maps] MetLife Stadium map initialized.');

    } catch (e) {
        console.error('[Maps] Initialization Error:', e.message);
    }
};
