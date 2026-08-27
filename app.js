/**
 * Paws on Map 🐾 - Main Application Logic (app.js)
 * Part 1: Global Constants, Data Loading, & World Level (Admin-0)
 */

// 1. URLs สำหรับดึงข้อมูล GeoJSON ขอบเขตประเทศ (Admin-0) และ ขอบเขตระดับเมือง/เขตปกครอง (Admin-1)
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
let userVisitedData = {};
try {
    userVisitedData = JSON.parse(localStorage.getItem('paws_visited_data')) || {};
} catch (e) {
    userVisitedData = {};
}

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadGeoJSONData();

    const formEl = document.getElementById('diaryForm');
    if (formEl) {
        formEl.addEventListener('submit', saveMemory);
    }
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
        return f.properties && f.properties.continent === currentContinent;
    });

    currentLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
        style: countryStyle,
        onEachFeature: (feature, layer) => {
            const countryName = (feature.properties && (feature.properties.name || feature.properties.admin)) || 'ประเทศ';
            // 📍 เปลี่ยนคำแสดงผลจาก "จังหวัด/รัฐ/มณฑล/นคร" เป็น "เมือง"
            layer.bindTooltip(`🐾 ${countryName} (คลิกเพื่อดูระดับเมือง)`, { sticky: true });

            layer.on({
                mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7, weight: 2 }),
                mouseout: (e) => {
                    const st = countryStyle(e.target.feature);
                    e.target.setStyle(st);
                },
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
    if (!feature || !feature.properties) return { fillColor: '#d5cecf', weight: 1, color: '#ffffff', fillOpacity: 0.5 };
    const iso = feature.properties.adm0_a3 || feature.properties.iso_a3;
    const name = feature.properties.name || feature.properties.admin;
    const isVisited = hasVisitedChildOrCountry(iso, name);

    return {
        fillColor: isVisited ? '#ff8e9e' : '#d5cecf',
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: isVisited ? 0.75 : 0.5
    };
}

// Helper: Check if country or any of its cities have been visited
function hasVisitedChildOrCountry(countryIso, countryName) {
    return Object.keys(userVisitedData).some(key => {
        const item = userVisitedData[key];
        if (!item) return false;
        if (countryIso && item.countryIso === countryIso) return true;
        if (countryName && item.countryName === countryName) return true;
        return false;
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
 * Part 2: Level 2 Drill-Down (City Level) & Navigation Controls
 */

// LEVEL 2: Drill Down to Country Subdivisions (Admin-1: เมือง)
function drillDownToCountry(countryFeature, layer) {
    const props = countryFeature.properties || {};
    currentSelectedCountryIso = props.adm0_a3 || props.iso_a3 || props.ISO_A3;
    currentSelectedCountryName = props.name || props.admin || '';
    currentLevel = 'country';
    
    updateBackButton();

    // ค้นหาเมืองแบบยืดหยุ่น (ตรวจสอบทั้ง ISO Code และ ชื่อประเทศ)
    const provinces = admin1Data.features.filter(f => {
        const pProps = f.properties;
        if (!pProps) return false;

        const pIso = (pProps.adm0_a3 || pProps.iso_a3 || pProps.sov_a3 || pProps.gu_a3 || '').toUpperCase();
        const pAdmin = (pProps.admin || pProps.sovereignt || pProps.name_0 || '').toLowerCase();

        const matchIso = currentSelectedCountryIso && pIso && (pIso === currentSelectedCountryIso.toUpperCase());
        const matchName = currentSelectedCountryName && pAdmin && (pAdmin === currentSelectedCountryName.toLowerCase());

        return matchIso || matchName;
    });

    if (currentLayer) map.removeLayer(currentLayer);

    // หากพบเขตการปกครองเมืองของประเทศนี้
    if (provinces.length > 0) {
        currentLayer = L.geoJSON({ type: 'FeatureCollection', features: provinces }, {
            style: provinceStyle,
            onEachFeature: (feature, provinceLayer) => {
                const provProps = feature.properties || {};
                const provName = provProps.name || provProps.name_en || provProps.NAME_1 || 'เมือง';
                const subTypeLabel = getSubdivisionTypeName(provProps, currentSelectedCountryIso);

                // 📍 แสดง Tooltip เป็นระดับ "เมือง"
                provinceLayer.bindTooltip(`📍 ${subTypeLabel} ${provName} (คลิกเพื่อบันทึกความทรงจำ)`, { sticky: true });

                provinceLayer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.85, weight: 2 }),
                    mouseout: (e) => {
                        const st = provinceStyle(e.target.feature);
                        e.target.setStyle(st);
                    },
                    click: () => {
                        const provId = `PROV-${currentSelectedCountryIso}-${provName}`;
                        openDiaryModal(provId, `${provName}`, subTypeLabel);
                    }
                });
            }
        }).addTo(map);
    } else {
        // กรณีประเทศนั้นไม่มีขอบเขตเมืองย่อยใน GeoJSON
        const countryId = `PROV-${currentSelectedCountryIso}-${currentSelectedCountryName}`;
        openDiaryModal(countryId, currentSelectedCountryName, 'เมือง');
    }

    // Render Airports for this country
    renderCountryAirports(currentSelectedCountryIso);

    // Zoom map to fit country boundary
    if (layer && layer.getBounds) {
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }
}

// 📍 Helper: คืนค่าคำว่า "เมือง" สำหรับทุกระดับพื้นที่
function getSubdivisionTypeName(props, countryIso) {
    return 'เมือง';
}

function provinceStyle(feature) {
    if (!feature || !feature.properties) {
        return { fillColor: '#e2d9cc', weight: 1.5, color: '#ffffff', fillOpacity: 0.45 };
    }

    const provName = feature.properties.name || feature.properties.name_en || feature.properties.NAME_1 || 'เมือง';
    const provId = `PROV-${currentSelectedCountryIso}-${provName}`;
    const isVisited = !!userVisitedData[provId];

    return {
        fillColor: isVisited ? '#ff5e7e' : '#e2d9cc',
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: isVisited ? 0.85 : 0.45
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
            openDiaryModal(ap.id, `${ap.name} (${ap.code})`, 'สนามบิน');
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
    if (backBtn && backText) {
        if (currentLevel === 'country') {
            backBtn.classList.remove('hidden');
            backText.textContent = `กลับสู่แผนที่โลก (จาก ${currentSelectedCountryName})`;
        } else {
            backBtn.classList.add('hidden');
        }
    }
}

/**
 * Part 3: Diary / Memory Modal Operations & Statistics Evaluator
 */

let currentBase64Image = '';

function openDiaryModal(id, title, typeLabel) {
    activeTargetId = id;
    const titleEl = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('modal-subtitle');
    
    if (titleEl) titleEl.textContent = title;
    
    // 📍 กำหนดค่าเริ่มต้นข้อความย่อยให้เป็น "เมือง"
    let subtitleText = 'เมือง';
    if (typeLabel) {
        subtitleText = typeLabel;
    }
    if (subtitleEl) subtitleEl.textContent = subtitleText;

    const dateEl = document.getElementById('travel-date');
    const noteEl = document.getElementById('travel-note');
    const imgPreviewEl = document.getElementById('img-preview');
    const imgContainerEl = document.getElementById('img-preview-container');
    const btnDeleteEl = document.getElementById('btn-delete-memory');
    const formEl = document.getElementById('diaryForm');

    const existing = userVisitedData[id];

    if (existing) {
        if (dateEl) dateEl.value = existing.date || '';
        if (noteEl) noteEl.value = existing.note || '';
        if (existing.img && imgPreviewEl && imgContainerEl) {
            currentBase64Image = existing.img;
            imgPreviewEl.src = existing.img;
            imgContainerEl.classList.remove('hidden');
        } else {
            resetImagePreview();
        }
        if (btnDeleteEl) btnDeleteEl.classList.remove('hidden');
    } else {
        if (formEl) formEl.reset();
        resetImagePreview();
        if (dateEl) {
            const today = new Date().toISOString().split('T')[0];
            dateEl.value = today;
        }
        if (btnDeleteEl) btnDeleteEl.classList.add('hidden');
    }

    const modalEl = document.getElementById('diaryModal');
    if (modalEl) modalEl.classList.remove('hidden');
}

function closeDiaryModal() {
    const modalEl = document.getElementById('diaryModal');
    if (modalEl) modalEl.classList.add('hidden');
    activeTargetId = null;
}

function resetImagePreview() {
    currentBase64Image = '';
    const imgPreviewEl = document.getElementById('img-preview');
    const imgContainerEl = document.getElementById('img-preview-container');
    if (imgPreviewEl) imgPreviewEl.src = '';
    if (imgContainerEl) imgContainerEl.classList.add('hidden');
}

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

            const imgPreviewEl = document.getElementById('img-preview');
            const imgContainerEl = document.getElementById('img-preview-container');
            if (imgPreviewEl && imgContainerEl) {
                imgPreviewEl.src = currentBase64Image;
                imgContainerEl.classList.remove('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Save memory & apply Scratch color
function saveMemory(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!activeTargetId) return;

    const cName = currentSelectedCountryName || getCountryNameByIso(currentSelectedCountryIso);
    const dateEl = document.getElementById('travel-date');
    const noteEl = document.getElementById('travel-note');

    userVisitedData[activeTargetId] = {
        date: dateEl ? dateEl.value : '',
        note: noteEl ? noteEl.value : '',
        img: currentBase64Image || '',
        countryIso: currentSelectedCountryIso,
        countryName: cName,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem('paws_visited_data', JSON.stringify(userVisitedData));
    } catch (err) {
        console.warn('LocalStorage error:', err);
    }

    // Refresh Map view styles & Statistics
    refreshMapStyles();
    updateStatsAndBadges();
    closeDiaryModal();
}

// Delete memory & remove Scratch color
function deleteMemory() {
    if (!activeTargetId) return;
    delete userVisitedData[activeTargetId];

    try {
        localStorage.setItem('paws_visited_data', JSON.stringify(userVisitedData));
    } catch (err) {
        console.warn('LocalStorage error:', err);
    }

    refreshMapStyles();
    updateStatsAndBadges();
    closeDiaryModal();
}

// วนลูปอัปเดตสีแผนที่ ณ ปัจจุบัน
function refreshMapStyles() {
    if (currentLevel === 'country' && currentLayer) {
        currentLayer.eachLayer(layer => {
            if (layer.feature) {
                const newStyle = provinceStyle(layer.feature);
                layer.setStyle(newStyle);
            }
        });
        renderCountryAirports(currentSelectedCountryIso);
    } else if (currentLayer) {
        currentLayer.eachLayer(layer => {
            if (layer.feature) {
                const newStyle = countryStyle(layer.feature);
                layer.setStyle(newStyle);
            }
        });
    }
}

// Statistics & Badges Evaluator
function updateStatsAndBadges() {
    const keys = Object.keys(userVisitedData);

    const citiesVisited = keys.filter(k => k.startsWith('PROV-')).length;
    const airportsVisited = keys.filter(k => k.startsWith('AP-')).length;

    const countriesVisitedSet = new Set();
    keys.forEach(k => {
        const item = userVisitedData[k];
        if (item && item.countryName && item.countryName !== '') {
            countriesVisitedSet.add(item.countryName);
        }
    });

    // Update Counters UI
    const statProv = document.getElementById('stat-provinces');
    const statCtry = document.getElementById('stat-countries');
    const statAp = document.getElementById('stat-airports');

    if (statProv) statProv.textContent = citiesVisited;
    if (statCtry) statCtry.textContent = countriesVisitedSet.size;
    if (statAp) statAp.textContent = airportsVisited;

    // Evaluate Badges
    const badgeAsian = document.getElementById('badge-asian');
    const badgeEuro = document.getElementById('badge-euro');
    const badgeFlyer = document.getElementById('badge-flyer');
    const badgeMaster = document.getElementById('badge-master');

    const hasAsia = Array.from(countriesVisitedSet).some(c => ['Thailand', 'Japan', 'China', 'South Korea', 'Singapore'].includes(c));
    const hasEuro = Array.from(countriesVisitedSet).some(c => ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'].includes(c));

    if (badgeAsian) badgeAsian.classList.toggle('unlocked', hasAsia);
    if (badgeEuro) badgeEuro.classList.toggle('unlocked', hasEuro);
    if (badgeFlyer) badgeFlyer.classList.toggle('unlocked', airportsVisited >= 3);
    if (badgeMaster) badgeMaster.classList.toggle('unlocked', citiesVisited >= 10);
}
