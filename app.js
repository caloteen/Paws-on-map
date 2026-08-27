/**
 * Paws on Map 🐾 - Main Application Logic (app.js)
 * Part 1: Global Constants, Data Loading, & World Level (Admin-0)
 */

// 1. URLs สำหรับดึงข้อมูล GeoJSON
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

let currentLevel = 'world'; // 'world' | 'country'
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

    // Bind Form Submit Event
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

    const filteredFeatures = admin0Data.features.filter(f => {
        if (currentContinent === 'All') return true;
        return f.properties && f.properties.continent === currentContinent;
    });

    currentLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
        style: countryStyle,
        onEachFeature: (feature, layer) => {
            const countryName = (feature.properties && (feature.properties.name || feature.properties.admin)) || 'ประเทศ';
            layer.bindTooltip(`🐾 ${countryName} (คลิกเพื่อดูระดับเมือง / มณฑล)`, { sticky: true });

            layer.on({
                mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7, weight: 2 }),
                mouseout: (e) => {
                    const style = countryStyle(e.target.feature);
                    e.target.setStyle(style);
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
    const isVisited = hasVisitedChildOrCountry(iso, feature.properties.name);

    return {
        fillColor: isVisited ? '#ff8e9e' : '#d5cecf',
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: isVisited ? 0.75 : 0.5
    };
}

function hasVisitedChildOrCountry(countryIso, countryName) {
    return Object.keys(userVisitedData).some(key => {
        const item = userVisitedData[key];
        return item && (item.countryIso === countryIso || item.countryName === countryName);
    });
}

function getCountryNameByIso(iso) {
    if (!iso) return '';
    if (admin0Data && admin0Data.features) {
        const found = admin0Data.features.find(f => {
            const p = f.properties;
            return p && ((p.adm0_a3 || p.iso_a3) === iso);
        });
        if (found && found.properties) return found.properties.name || found.properties.admin;
    }
    return '';
}
/**
 * Part 2: Level 2 Drill-Down (City / Province Level & Subdivisions)
 */

function getProvinceName(feature) {
    if (!feature || !feature.properties) return 'เมือง';
    const p = feature.properties;
    return p.name || p.name_en || p.NAME_1 || p.NAME_0 || p.admin || 'เมือง';
}

function getProvinceId(feature, countryIso) {
    const name = getProvinceName(feature);
    const safeIso = countryIso || (feature && feature.properties ? (feature.properties.adm0_a3 || feature.properties.iso_a3) : 'GLOBAL');
    return `PROV-${safeIso}-${name}`;
}

function getSubdivisionTypeName(props, countryIso) {
    if (!props) return 'เมือง';
    if (countryIso === 'CHN' || countryIso === 'HKG' || countryIso === 'MAC') {
        const rawType = (props.type || props.type_en || '').toLowerCase();
        const provName = (props.name || props.name_en || '').toLowerCase();

        if (rawType.includes('special') || provName.includes('hong kong') || provName.includes('macau')) {
            return 'เขตการปกครองพิเศษ';
        }
        if (rawType.includes('municipality') || rawType.includes('city')) {
            return 'นคร';
        }
        return 'มณฑล';
    }
    return 'เมือง';
}

function drillDownToCountry(countryFeature, layer) {
    const props = countryFeature.properties || {};
    currentSelectedCountryIso = props.adm0_a3 || props.iso_a3 || props.ISO_A3;
    currentSelectedCountryName = props.name || props.admin || '';
    currentLevel = 'country';
    
    updateBackButton();

    const provinces = admin1Data.features.filter(f => {
        const pProps = f.properties;
        if (!pProps) return false;
        const pIso = pProps.adm0_a3 || pProps.iso_a3 || pProps.sov_a3 || pProps.gu_a3;
        const pAdmin = pProps.admin || pProps.sovereignt;

        if (currentSelectedCountryIso && pIso && currentSelectedCountryIso.toUpperCase() === pIso.toUpperCase()) return true;
        if (currentSelectedCountryName && pAdmin && currentSelectedCountryName.toLowerCase() === pAdmin.toLowerCase()) return true;
        return false;
    });

    if (currentLayer) map.removeLayer(currentLayer);

    if (provinces.length > 0) {
        currentLayer = L.geoJSON({ type: 'FeatureCollection', features: provinces }, {
            style: provinceStyle,
            onEachFeature: (feature, provinceLayer) => {
                const provName = getProvinceName(feature);
                const provId = getProvinceId(feature, currentSelectedCountryIso);
                const subTypeLabel = getSubdivisionTypeName(feature.properties, currentSelectedCountryIso);

                provinceLayer.bindTooltip(`📍 ${subTypeLabel} ${provName} (คลิกเพื่อบันทึกความทรงจำ)`, { sticky: true });

                provinceLayer.on({
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.85, weight: 2 }),
                    mouseout: (e) => {
                        // ป้องกัน Leaflet คืนสีเทาดั้งเดิม
                        const style = provinceStyle(e.target.feature);
                        e.target.setStyle(style);
                    },
                    click: () => {
                        openDiaryModal(provId, provName, subTypeLabel);
                    }
                });
            }
        }).addTo(map);
    } else {
        const countryId = `CTRY-${currentSelectedCountryIso}`;
        openDiaryModal(countryId, currentSelectedCountryName, 'ประเทศ');
        renderWorldLevel();
        return;
    }

    renderCountryAirports(currentSelectedCountryIso);

    if (layer && layer.getBounds) {
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }
}

function provinceStyle(feature) {
    if (!feature || !feature.properties) {
        return { fillColor: '#e2d9cc', weight: 1.5, color: '#ffffff', fillOpacity: 0.45 };
    }

    const provId = getProvinceId(feature, currentSelectedCountryIso);
    const isVisited = !!userVisitedData[provId];

    return {
        fillColor: isVisited ? '#ff5e7e' : '#e2d9cc',
        weight: 1.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: isVisited ? 0.8 : 0.45
    };
}

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
 * Part 3: Memory Modal Operations & Safe Realtime Map Style Update
 */

let currentBase64Image = '';

function openDiaryModal(id, title, typeLabel) {
    activeTargetId = id;

    const titleEl = document.getElementById('modal-title');
    const subtitleEl = document.getElementById('modal-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = typeLabel || 'เมือง';

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

// Save Memory function
function saveMemory(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!activeTargetId) return;

    const dateEl = document.getElementById('travel-date');
    const noteEl = document.getElementById('travel-note');
    const cName = currentSelectedCountryName || getCountryNameByIso(currentSelectedCountryIso);

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
        console.warn('LocalStorage limit reached:', err);
        alert('รูปภาพมีขนาดใหญ่เกินไป ไม่สามารถบันทึกรูปได้ แต่ข้อมูลเมืองถูกบันทึกเรียบร้อยแล้วค่ะ');
    }

    refreshMapStyles();
    updateStatsAndBadges();
    closeDiaryModal();
}

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

// Re-apply styles on map dynamically
function refreshMapStyles() {
    if (currentLevel === 'country' && currentLayer) {
        currentLayer.eachLayer(layer => {
            if (layer.feature) {
                const newStyle = provinceStyle(layer.feature);
                layer.setStyle(newStyle);
            }
        });
        renderCountryAirports(currentSelectedCountryIso);
    } else {
        renderWorldLevel();
    }
}

// Update Stats UI & Badges
function updateStatsAndBadges() {
    const keys = Object.keys(userVisitedData);

    const citiesVisited = keys.filter(k => k.startsWith('PROV-')).length;
    const airportsVisited = keys.filter(k => k.startsWith('AP-')).length;

    const countriesVisitedSet = new Set();
    keys.forEach(k => {
        const item = userVisitedData[k];
        if (item && item.countryName) {
            countriesVisitedSet.add(item.countryName);
        }
    });

    const statProv = document.getElementById('stat-provinces');
    const statCtry = document.getElementById('stat-countries');
    const statAp = document.getElementById('stat-airports');

    if (statProv) statProv.textContent = citiesVisited;
    if (statCtry) statCtry.textContent = countriesVisitedSet.size;
    if (statAp) statAp.textContent = airportsVisited;

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
