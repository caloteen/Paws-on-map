/**
 * Paws on Map 🐾 - Main Application Logic (app.js)
 * Part 1: Global Constants, Data Loading, & World Level (Admin-0)
 */

// 1. URLs สำหรับดึงข้อมูล GeoJSON ขอบเขตประเทศ (Admin-0) และ ขอบเขตจังหวัด/รัฐ/มณฑล (Admin-1)
const WORLD_GEOJSON_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson';
const ADMIN1_GEOJSON_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_1_states_provinces_shp.geojson';

// 2. ฐานข้อมูลพิกัดสนามบินหลักรอบโลก ✈️
const AIRPORT_DATABASE = [
    { id: 'AP-BKK', code: 'BKK', name: 'Suvarnabhumi Airport (Thailand)', countryIso: 'THA', lat: 13.69, lng: 100.75 },
    { id: 'AP-DMK', code: 'DMK', name: 'Don Mueang Airport (Thailand)', countryIso: 'THA', lat: 13.91, lng: 100.60 },
    { id: 'AP-CNX', code: 'CNX', name: 'Chiang Mai Airport (Thailand)', countryIso: 'THA', lat: 18.77, lng: 98.96 },
    { id: 'AP-HKT', code: 'HKT', name: 'Phuket Airport (Thailand)', countryIso: 'THA', lat: 8.11, lng: 98.31 },
    { id: 'AP-HND', code: 'HND', name: 'Haneda Airport (Japan)', countryIso: 'JPN', lat: 35.54, lng: 139.77 },
    { id: 'AP-NRT', code: 'NRT', name: 'Narita Airport (Japan)', countryIso: 'JPN', lat: 35.77, lng: 140.39 },
    { id: 'AP-KIX', code: 'KIX', name: 'Kansai Airport (Japan)', countryIso: 'JPN', lat: 34.43, lng: 135.23 },
    { id: 'AP-PEK', code: 'PEK', name: 'Beijing Capital (China)', countryIso: 'CHN', lat: 40.07, lng: 116.60 },
    { id: 'AP-PVG', code: 'PVG', name: 'Shanghai Pudong (China)', countryIso: 'CHN', lat: 31.14, lng: 121.80 },
    { id: 'AP-ICN', code: 'ICN', name: 'Incheon Airport (S. Korea)', countryIso: 'KOR', lat: 37.46, lng: 126.44 },
    { id: 'AP-SIN', code: 'SIN', name: 'Changi Airport (Singapore)', countryIso: 'SGP', lat: 1.36, lng: 103.99 },
    { id: 'AP-LHR', code: 'LHR', name: 'London Heathrow (UK)', countryIso: 'GBR', lat: 51.47, lng: -0.45 },
    { id: 'AP-CDG', code: 'CDG', name: 'Charles de Gaulle (France)', countryIso: 'FRA', lat: 49.00, lng: 2.54 },
    { id: 'AP-JFK', code: 'JFK', name: 'JFK Airport (USA)', countryIso: 'USA', lat: 40.64, lng: -73.77 },
    { id: 'AP-LAX', code: 'LAX', name: 'LAX Airport (USA)', countryIso: 'USA', lat: 33.94, lng: -118.40 },
    { id: 'AP-SYD', code: 'SYD', name: 'Sydney Airport (Australia)', countryIso: 'AUS', lat: -33.94, lng: 151.17 }
];

// App States
let map;
let admin0Data = null;
let admin1Data = null;
let currentLayer = null;
let airportLayerGroup = L.layerGroup();

let currentLevel = 'world'; // 'world' | 'continent' | 'country'
let currentContinent = 'All';
let currentSelectedCountryIso = null;
let currentSelectedCountryName = '';
let activeTargetId = null;

// LocalStorage Persistence
let userVisitedData = JSON.parse(localStorage.getItem('paws_visited_data')) || {};

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadGeoJSONData();
});

// Initialize Leaflet Map
function initMap() {
    map = L.map('map', {
        center: [20, 10],
        zoom: 3,
        minZoom: 2,
        maxZoom: 12
    });

    // Basemap: CartoDB Positron
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    airportLayerGroup.addTo(map);
}

// Load GeoJSON Data asynchronously
async function loadGeoJSONData() {
    try {
        const [res0, res1] = await Promise.all([
            fetch(WORLD_GEOJSON_URL).then(r => r.json()),
            fetch(ADMIN1_GEOJSON_URL).then(r => r.json())
        ]);
        
        admin0Data = res0;
        admin1Data = res1;

        renderWorldLevel();
        updateStatsAndBadges();
    } catch (err) {
        console.error('Failed to load GeoJSON map data:', err);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูลแผนที่ กรุณารีเฟรชหน้าเว็บอีกครั้งค่ะ');
    }
}

// LEVEL 1: Render World / Country Boundaries
function renderWorldLevel() {
    currentLevel = 'world';
    currentSelectedCountryIso = null;
    currentSelectedCountryName = '';
    updateBackButton();

    if (currentLayer) map.removeLayer(currentLayer);
    airportLayerGroup.clearLayers();

    // Filter features by continent
    const filteredFeatures = admin0Data.features.filter(f => {
        if (currentContinent === 'All') return true;
        return f.properties.continent === currentContinent;
    });

    currentLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
        style: countryStyle,
        onEachFeature: (feature, layer) => {
            const countryName = feature.properties.name || feature.properties.admin;
            layer.bindTooltip(`🐾 ${countryName} (คลิกเพื่อดูระดับจังหวัด/รัฐ/มณฑล/นคร)`, { sticky: true });

            layer.on({
                mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7, weight: 2 }),
                mouseout: (e) => currentLayer.resetStyle(e.target),
                click: (e) => {
                    drillDownToCountry(feature, e.target);
                }
            });
        }
    }).addTo(map);

    if (currentContinent === 'All') {
        map.setView([20, 10], 3);
    } else if (currentLayer.getBounds().isValid()) {
        map.fitBounds(currentLayer.getBounds(), { padding: [20, 20] });
    }
}

function countryStyle(feature) {
    const iso = feature.properties.adm0_a3 || feature.properties.iso_a3;
    const isVisited = hasVisitedChildOrCountry(iso, feature.properties.name);

    return {
        fillColor: isVisited ? '#ff8e9e' : '#d5cecf',
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: isVisited ? 0.75 : 0.5
    };
}

// Helper: Check if country or any of its provinces have been visited
function hasVisitedChildOrCountry(countryIso, countryName) {
    return Object.keys(userVisitedData).some(key => {
        const item = userVisitedData[key];
        return item.countryIso === countryIso || item.countryName === countryName;
    });
}

function getCountryNameByIso(iso) {
    if (!iso) return '';
    if (admin0Data && admin0Data.features) {
        const found = admin0Data.features.find(f => {
            const p = f.properties;
            return (p.adm0_a3 || p.iso_a3) === iso;
        });
        if (found) return found.properties.name || found.properties.admin;
    }
    return '';
}
/**
 * Part 2: Level 2 Drill-Down (Provinces / States / Prefectures / Municipalities) & Navigation Controls
 */

// LEVEL 2: Drill Down to Country Subdivisions (Admin-1: จังหวัด / รัฐ / มณฑล / นคร)
function drillDownToCountry(countryFeature, layer) {
    const props = countryFeature.properties;
    currentSelectedCountryIso = props.adm0_a3 || props.iso_a3 || props.ISO_A3;
    currentSelectedCountryName = props.name || props.admin;
    currentLevel = 'country';
    
    updateBackButton();

    // Filter Admin-1 (Provinces/States/Municipalities) for this country using strict & fallback matching
    const provinces = admin1Data.features.filter(f => {
        const pProps = f.properties;
        const pIso = pProps.adm0_a3 || pProps.iso_a3 || pProps.sov_a3 || pProps.gu_a3;
        const pAdmin = pProps.admin || pProps.sovereignt;

        if (currentSelectedCountryIso && pIso && currentSelectedCountryIso.toUpperCase() === pIso.toUpperCase()) return true;
        if (currentSelectedCountryName && pAdmin && currentSelectedCountryName.toLowerCase() === pAdmin.toLowerCase()) return true;
        return false;
    });

    if (currentLayer) map.removeLayer(currentLayer);

    // If province/state/municipality boundaries exist for this country
    if (provinces.length > 0) {
        currentLayer = L.geoJSON({ type: 'FeatureCollection', features: provinces }, {
            style: provinceStyle,
            onEachFeature: (feature, provinceLayer) => {
                const provProps = feature.properties;
                const provName = provProps.name || provProps.name_en || 'เขตการปกครอง';
                const subTypeLabel = getSubdivisionTypeName(provProps, currentSelectedCountryIso);

                provinceLayer.bindTooltip(`📍 เมือง ${provName} (คลิกเพื่อบันทึกความทรงจำ)`, { sticky: true });

                provinceLayer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.85, weight: 2 }),
                    mouseout: (e) => currentLayer.resetStyle(e.target),
                    click: () => {
                        const provId = `PROV-${currentSelectedCountryIso}-${provName}`;
                        openDiaryModal(provId, `${provName}`, subTypeLabel);
                    }
                });
            }
        }).addTo(map);
    } else {
        // Fallback: If no sub-provinces found, scratch the entire country
        const countryId = `CTRY-${currentSelectedCountryIso}`;
        openDiaryModal(countryId, currentSelectedCountryName, 'ประเทศ');
        renderWorldLevel();
        return;
    }

    // Render Airports for this country
    renderCountryAirports(currentSelectedCountryIso);

    // Zoom map to fit country boundary
    if (layer && layer.getBounds) {
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }
}

// Helper: Determine subdivision type (จังหวัด / รัฐ / มณฑล / นคร / เขตการปกครอง)
function getSubdivisionTypeName(props, countryIso) {
    const rawType = (props.type || props.type_en || '').toLowerCase();
    
    if (countryIso === 'CHN' || countryIso === 'TWN') {
        if (rawType.includes('municipality') || rawType.includes('city') || rawType.includes('special')) {
            return 'นคร / เขตปกครองพิเศษ';
        }
        return 'มณฑล';
    }
    if (rawType.includes('state') || rawType.includes('canton') || rawType.includes('land')) {
        return 'รัฐ';
    }
    if (rawType.includes('province') || rawType.includes('prefecture') || rawType.includes('governorate') || rawType.includes('department') || rawType.includes('oblast') || rawType.includes('region')) {
        return countryIso === 'THA' ? 'จังหวัด' : 'จังหวัด / มณฑล';
    }
    if (rawType.includes('city') || rawType.includes('municipality') || rawType.includes('capital') || rawType.includes('federal district') || rawType.includes('metropolitan')) {
        return 'นคร / เขตการปกครองพิเศษ';
    }
    
    return 'จังหวัด / รัฐ / มณฑล';
}

function provinceStyle(feature) {
    const provName = feature.properties.name || feature.properties.name_en;
    const provId = `PROV-${currentSelectedCountryIso}-${provName}`;
    const isVisited = !!userVisitedData[provId];

    return {
        fillColor: isVisited ? '#ff5e7e' : '#e2d9cc',
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: isVisited ? 0.8 : 0.45
    };
}

// Render Airport Markers
function renderCountryAirports(countryIso) {
    airportLayerGroup.clearLayers();
    const airports = AIRPORT_DATABASE.filter(ap => ap.countryIso === countryIso);

    airports.forEach(ap => {
        const isVisited = !!userVisitedData[ap.id];
        const iconHtml = `<div class="paw-airport-icon" style="border-color:${isVisited ? '#ff5e7e':'#e6a15c'}">✈️</div>`;
        const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-paw-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const marker = L.marker([ap.lat, ap.lng], { icon: customIcon });
        marker.bindTooltip(`✈️ ${ap.name} (${ap.code})`, { sticky: true });
        marker.on('click', () => {
            openDiaryModal(ap.id, `${ap.name} (${ap.code})`, 'สนามบิน / Airport');
        });
        airportLayerGroup.addLayer(marker);
    });
}

// Filter & Navigation Controls
function filterByContinent(continent) {
    currentContinent = continent;
    renderWorldLevel();
}

function goBackLevel() {
    if (currentLevel === 'country') {
        renderWorldLevel();
    }
}

function updateBackButton() {
    const backBtn = document.getElementById('btn-back');
    const backText = document.getElementById('back-text');
    if (currentLevel === 'country') {
        backBtn.classList.remove('hidden');
        backText.textContent = `กลับสู่แผนที่โลก (จาก ${currentSelectedCountryName})`;
    } else {
        backBtn.classList.add('hidden');
    }
}
/**
 * Part 3: Diary / Memory Modal Operations & Statistics Evaluator
 */

let currentBase64Image = '';

function openDiaryModal(id, title, typeLabel) {
    activeTargetId = id;
    document.getElementById('modal-title').textContent = title;
    
    let subtitleText = 'เมือง';
    if (typeLabel) {
        subtitleText = typeLabel;
    }
    document.getElementById('modal-subtitle').textContent = subtitleText;

    const existing = userVisitedData[id];
    if (existing) {
        document.getElementById('travel-date').value = existing.date || '';
        document.getElementById('travel-note').value = existing.note || '';
        if (existing.img) {
            currentBase64Image = existing.img;
            document.getElementById('img-preview').src = existing.img;
            document.getElementById('img-preview-container').classList.remove('hidden');
        } else {
            resetImagePreview();
        }
        document.getElementById('btn-delete-memory').classList.remove('hidden');
    } else {
        document.getElementById('diaryForm').reset();
        resetImagePreview();
        document.getElementById('travel-date').valueAsDate = new Date();
        document.getElementById('btn-delete-memory').classList.add('hidden');
    }

    document.getElementById('diaryModal').classList.remove('hidden');
}

function closeDiaryModal() {
    document.getElementById('diaryModal').classList.add('hidden');
    activeTargetId = null;
}

function resetImagePreview() {
    currentBase64Image = '';
    document.getElementById('img-preview').src = '';
    document.getElementById('img-preview-container').classList.add('hidden');
}

// Image compression via Canvas to stay clean in LocalStorage
function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxWidth = 500;
            const scale = maxWidth / img.width;
            
            canvas.width = maxWidth;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentBase64Image = canvas.toDataURL('image/jpeg', 0.6);

            document.getElementById('img-preview').src = currentBase64Image;
            document.getElementById('img-preview-container').classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Save memory & apply Scratch color
function saveMemory(e) {
    e.preventDefault();
    if (!activeTargetId) return;

    const cName = currentSelectedCountryName || getCountryNameByIso(currentSelectedCountryIso);

    userVisitedData[activeTargetId] = {
        date: document.getElementById('travel-date').value,
        note: document.getElementById('travel-note').value,
        img: currentBase64Image,
        countryIso: currentSelectedCountryIso,
        countryName: cName,
        timestamp: Date.now()
    };

    localStorage.setItem('paws_visited_data', JSON.stringify(userVisitedData));

    // Refresh Map view styles & Statistics
    if (currentLevel === 'country') {
        currentLayer.eachLayer(l => currentLayer.resetStyle(l));
        renderCountryAirports(currentSelectedCountryIso);
    } else {
        renderWorldLevel();
    }

    updateStatsAndBadges();
    closeDiaryModal();
}

// Delete memory & remove Scratch color
function deleteMemory() {
    if (!activeTargetId) return;
    delete userVisitedData[activeTargetId];
    localStorage.setItem('paws_visited_data', JSON.stringify(userVisitedData));

    if (currentLevel === 'country') {
        currentLayer.eachLayer(l => currentLayer.resetStyle(l));
        renderCountryAirports(currentSelectedCountryIso);
    } else {
        renderWorldLevel();
    }

    updateStatsAndBadges();
    closeDiaryModal();
}

// Statistics & Badges Evaluator
function updateStatsAndBadges() {
    const keys = Object.keys(userVisitedData);

    const provincesVisited = keys.filter(k => k.startsWith('PROV-')).length;
    const airportsVisited = keys.filter(k => k.startsWith('AP-')).length;

    const countriesVisitedSet = new Set();
    keys.forEach(k => {
        const item = userVisitedData[k];
        if (item && item.countryName) {
            countriesVisitedSet.add(item.countryName);
        }
    });

    // Update Counters UI
    document.getElementById('stat-provinces').textContent = provincesVisited;
    document.getElementById('stat-countries').textContent = countriesVisitedSet.size;
    document.getElementById('stat-airports').textContent = airportsVisited;

    // Evaluate Badges
    const badgeAsian = document.getElementById('badge-asian');
    const badgeEuro = document.getElementById('badge-euro');
    const badgeFlyer = document.getElementById('badge-flyer');
    const badgeMaster = document.getElementById('badge-master');

    // Check Asian countries
    const hasAsia = Array.from(countriesVisitedSet).some(c => ['Thailand', 'Japan', 'China', 'South Korea', 'Singapore'].includes(c));
    badgeAsian.classList.toggle('unlocked', hasAsia);

    // Check European countries
    const hasEuro = Array.from(countriesVisitedSet).some(c => ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'].includes(c));
    badgeEuro.classList.toggle('unlocked', hasEuro);

    // Flyer Badge (≥ 3 Airports)
    badgeFlyer.classList.toggle('unlocked', airportsVisited >= 3);

    // Master Cat Badge (≥ 10 Provinces/States)
    badgeMaster.classList.toggle('unlocked', provincesVisited >= 10);
}
