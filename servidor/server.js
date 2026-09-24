const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
// Carregar configurações de ambiente (CONFIGURACAO_DO_SERVIDOR.env ou .env)
try {
  const envPath = fs.existsSync(path.join(__dirname, 'CONFIGURACAO_DO_SERVIDOR.env'))
    ? path.join(__dirname, 'CONFIGURACAO_DO_SERVIDOR.env')
    : path.join(__dirname, '.env');
  require('dotenv').config({ path: envPath });
} catch (e) {}

const db = require('./db');

const PORT = process.env.PORT || 3000;

// Diretórios da nova arquitetura isolada (Busca resiliente em todos os caminhos possíveis)
const possibleAppDirs = [
  path.join(__dirname, 'aplicativo'),
  path.join(__dirname, '..', 'aplicativo'),
  path.join(process.cwd(), 'aplicativo'),
  path.join(process.cwd(), '..', 'aplicativo'),
  __dirname
];

let APLICATIVO_DIR = __dirname;
for (const dir of possibleAppDirs) {
  if (fs.existsSync(path.join(dir, 'assets', 'icons')) || fs.existsSync(path.join(dir, 'index.html'))) {
    APLICATIVO_DIR = dir;
    break;
  }
}

const DB_DIR = fs.existsSync(path.join(__dirname, 'database'))
  ? path.join(__dirname, 'database')
  : (fs.existsSync(path.join(process.cwd(), 'database')) ? path.join(process.cwd(), 'database') : path.join(__dirname, '..', 'database'));

const ADMIN_DIR = fs.existsSync(path.join(__dirname, 'admin'))
  ? path.join(__dirname, 'admin')
  : (fs.existsSync(path.join(process.cwd(), 'admin')) ? path.join(process.cwd(), 'admin') : __dirname);

const ASSETS_DIR = path.join(APLICATIVO_DIR, 'assets');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Helper: read and write JSON files safely
function readDB(filename) {
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return [];
  }
}

function writeDB(filename, data) {
  const filePath = path.join(DB_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    // Asynchronously synchronize with PostgreSQL if connected
    if (db && typeof db.syncJsonWithPostgres === 'function') {
      db.syncJsonWithPostgres(filename, data).catch(err => {
        console.warn(`[DB Sync Error] ${filename}:`, err.message);
      });
    }
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err.message);
    return false;
  }
}

// Password Hashing with PBKDF2 (Native Node.js crypto, zero external dependencies)
function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  // If stored password is legacy plain text, compare directly
  if (!stored.startsWith('pbkdf2:')) {
    return String(stored) === String(password);
  }
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const verifyHash = crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon'
};

// Parse JSON request body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// Send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-User-Id, X-Session-Token, X-Admin-Request, X-User-Role, X-Requested-With, *'
  });
  res.end(JSON.stringify(data));
}

// Fallback profundo para localizar qualquer asset (ícones, sons, imagens) em múltiplos caminhos
function findAssetFallback(requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') return null;
  const fileName = path.basename(requestedPath);
  const ext = path.extname(requestedPath).toLowerCase();
  const subFolder = (ext === '.svg' || ext === '.png' || ext === '.ico') ? 'icons' : ((ext === '.jpg' || ext === '.jpeg') ? 'images' : ((ext === '.mp3' || ext === '.wav') ? 'sounds' : ''));

  const candidateDirs = [
    path.join(APLICATIVO_DIR, 'assets', subFolder),
    path.join(__dirname, 'assets', subFolder),
    path.join(process.cwd(), 'aplicativo', 'assets', subFolder),
    path.join(process.cwd(), 'assets', subFolder),
    path.join(ADMIN_DIR, 'assets', subFolder),
    path.join(__dirname, '..', 'aplicativo', 'assets', subFolder),
    path.join(APLICATIVO_DIR, 'assets'),
    path.join(__dirname, 'assets'),
    path.join(process.cwd(), 'assets'),
    path.join(APLICATIVO_DIR),
    path.join(ADMIN_DIR),
    path.join(__dirname),
    path.join(process.cwd())
  ];

  for (const d of candidateDirs) {
    const full = path.join(d, fileName);
    try {
      if (fs.existsSync(full) && !fs.statSync(full).isDirectory()) {
        return full;
      }
    } catch (_) {}
  }
  return null;
}

// Serve static file safely
function serveStatic(res, filePath) {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const fallback = findAssetFallback(filePath);
      if (fallback) {
        filePath = fallback;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error(`Stream error on ${filePath}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error(`Error serving static ${filePath}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  }
}

// Check admin role by email
function isAdminEmail(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === 'diretoria@maxdrive.com' || normalized === 'admin@maxdrive.com' || normalized === 'admin' || normalized === 'mauroferreira@live.com') return true;
  const users = readDB('users.json');
  const user = users.find(u => u && u.email && u.email.toLowerCase() === normalized);
  return !!(user && (user.role === 'admin' || user.isAdmin === true));
}

// Calculate current week bounds (Monday 00:00 to Sunday 23:59:59)
function getCurrentWeekCycle(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const pad = n => String(n).padStart(2, '0');
  const formatDateBR = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

  return {
    monday,
    sunday,
    mondayStr: formatDateBR(monday),
    sundayStr: formatDateBR(sunday),
    sundayISO: sunday.toISOString()
  };
}

function isPaymentExpired(paidUntil, status) {
  if (status === 'BLOQUEADO') return true;
  if (status === 'PENDENTE') return true;
  if (!paidUntil) return true;
  const now = new Date();
  const expire = new Date(paidUntil);
  return now.getTime() > expire.getTime();
}

// -------------------------------------------------------------
// RIDE EXPIRATION RULE: 15 MINUTES WITHOUT ACCEPTANCE, 4 HOURS FOR ABANDONED ACTIVE RIDES
// -------------------------------------------------------------
const RIDE_EXPIRATION_TIME_MS = 15 * 60 * 1000; // 15 minutos
const ACTIVE_RIDE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 horas

function checkAndExpireRides(rides) {
  if (!Array.isArray(rides)) return false;
  const now = Date.now();
  let changed = false;

  for (const r of rides) {
    if (r.status === 'requested') {
      const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (createdTime > 0 && (now - createdTime >= RIDE_EXPIRATION_TIME_MS)) {
        r.status = 'expired';
        r.expiredAt = new Date().toISOString();
        r.cancellationReason = 'Tempo limite de 15 minutos atingido sem aceite de motorista';
        r.cancelledBy = 'system';
        changed = true;
      }
    } else if (['accepted', 'arrived', 'in_progress'].includes(r.status)) {
      const startTime = r.acceptedAt ? new Date(r.acceptedAt).getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);
      if (startTime > 0 && (now - startTime >= ACTIVE_RIDE_MAX_AGE_MS)) {
        r.status = 'cancelled';
        r.cancelledAt = new Date().toISOString();
        r.cancellationReason = 'Corrida encerrada automaticamente após tempo limite de inatividade (4h)';
        r.cancelledBy = 'system';
        changed = true;
      }
    }
  }

  if (changed) {
    writeDB('rides.json', rides);
  }
  return changed;
}

// Background cleaner: check and expire rides older than 15 minutes
setInterval(() => {
  try {
    const rides = readDB('rides.json');
    checkAndExpireRides(rides);
  } catch (err) {
    console.warn('[Auto-Expire Rides] Erro:', err.message);
  }
}, 10000);

// -------------------------------------------------------------
// HIGH-PRECISION GEO ENGINE & FREE OSM / OSRM ROUTING
// -------------------------------------------------------------
const routeCache = new Map();
const geocodeCache = new Map();

// 1. Street Coordinates In-Memory Index (~2.700 real streets with exact bounds)
let STREET_COORDINATES_DATA = {};
const streetIndexMap = new Map(); // cityKey -> Map(normalizedKey -> streetObj)

function normalizeStreetKey(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(rua|r\.|r|avenida|av\.|av|alameda|al\.|travessa|tr\.|praca|pc\.|rodovia|rod\.)\b/g, ' ')
    .replace(/[,\.\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTextRoute(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[,\.\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHouseNumber(str) {
  if (!str) return null;
  // Match patterns like "Rua 20, 1200", "nº 450", "n 300", "num 12"
  const m = str.match(/(?:(?:n[ºo°]?|n[uú]mero|num)\s*[:.]?\s*|[,\s]+)(\d{1,5})(?:\s*|$)/i);
  if (m) {
    const val = parseInt(m[1], 10);
    // Disregard if it looks like a street identifier like "Rua 24" with no other number
    const isNamedStreetNumber = /\b(?:rua|r|avenida|av)\s+(\d+)\b/i.test(str) && !str.includes(',') && !str.toLowerCase().includes('nº') && !str.toLowerCase().includes('n ');
    if (isNamedStreetNumber) return null;
    return val;
  }
  return null;
}

async function loadStreetCoordinates() {
  try {
    let raw = readDB('street_coordinates.json');
    if (!raw || Object.keys(raw).length === 0) {
      raw = await db.getStreetCoordinates();
    }
    STREET_COORDINATES_DATA = raw || {};
    streetIndexMap.clear();
    for (const [cityKey, streets] of Object.entries(STREET_COORDINATES_DATA)) {
      const cityMap = new Map();
      for (const [sName, sData] of Object.entries(streets)) {
        const norm = normalizeStreetKey(sName);
        cityMap.set(norm, { name: sName, ...sData });
      }
      streetIndexMap.set(cityKey.toLowerCase(), cityMap);
    }
    const counts = Object.keys(STREET_COORDINATES_DATA).map(c => `${c} (${Object.keys(STREET_COORDINATES_DATA[c]).length})`).join(', ');
    console.log(`[Geo Engine] Coordenadas de ruas carregadas com sucesso: ${counts}`);
  } catch (e) {
    console.warn('[Geo Engine] Falha ao carregar street_coordinates:', e.message);
  }
}
loadStreetCoordinates().catch(() => {});

function interpolateStreetCoords(streetData, houseNum) {
  if (!streetData) return null;
  const baseLat = streetData.lat;
  const baseLng = streetData.lng;
  if (!houseNum || !streetData.minLat || !streetData.maxLat || (streetData.minLat === streetData.maxLat && streetData.minLng === streetData.maxLng)) {
    return { lat: baseLat, lng: baseLng, name: streetData.name };
  }
  // Approximate progression along street length based on house number
  // In Brazilian cities, typical block numbering reaches 1000 - 2000
  const t = Math.min(0.92, Math.max(0.08, houseNum / 1800));
  const lat = streetData.minLat + (streetData.maxLat - streetData.minLat) * t;
  const lng = streetData.minLng + (streetData.maxLng - streetData.minLng) * t;
  return { lat, lng, name: streetData.name, interpolated: true };
}

function haversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const KNOWN_BAIRROS_SERVER = {
  ituiutaba: {
    'centro': { lat: -18.9688, lng: -49.4642 },
    'platina': { lat: -18.9750, lng: -49.4520 },
    'universitario': { lat: -18.9850, lng: -49.4700 },
    'novo tempo': { lat: -18.9550, lng: -49.4800 },
    'rodoviaria': { lat: -18.9710, lng: -49.4600 },
    'alvorada': { lat: -18.9820, lng: -49.4850 },
    'progresso': { lat: -18.9790, lng: -49.4480 },
    'ipiranga': { lat: -18.9620, lng: -49.4550 },
    'natal': { lat: -18.9640, lng: -49.4750 },
    'pirapitinga': { lat: -18.9580, lng: -49.4620 },
    'guimaraes': { lat: -18.9740, lng: -49.4680 },
    'marta helena': { lat: -18.9650, lng: -49.4820 },
    'setor sul': { lat: -18.9800, lng: -49.4650 },
    'setor norte': { lat: -18.9560, lng: -49.4650 }
  },
  araguari: {
    'centro': { lat: -18.6475, lng: -48.1872 },
    'bosque': { lat: -18.6390, lng: -48.1950 },
    'sibipiruna': { lat: -18.6520, lng: -48.1750 },
    'goias': { lat: -18.6600, lng: -48.1900 }
  },
  santa_vitoria: {
    'centro': { lat: -18.8436, lng: -50.1219 },
    'brasil': { lat: -18.8500, lng: -50.1150 },
    'chacaras': { lat: -18.8350, lng: -50.1300 }
  },
  capinopolis: {
    'centro': { lat: -18.6822, lng: -49.5694 },
    'semiramis': { lat: -18.6750, lng: -49.5750 },
    'sao joao': { lat: -18.6900, lng: -49.5620 }
  }
};

const CITY_DEFAULT_CENTERS = {
  araguari:      { lat: -18.6475, lng: -48.1872, name: 'Araguari', state: 'MG' },
  araxa:         { lat: -19.5931, lng: -46.9406, name: 'Araxá', state: 'MG' },
  canapolis:     { lat: -18.7233, lng: -49.5039, name: 'Canápolis', state: 'MG' },
  capinopolis:   { lat: -18.6822, lng: -49.5694, name: 'Capinópolis', state: 'MG' },
  centralina:    { lat: -18.5819, lng: -49.5392, name: 'Centralina', state: 'MG' },
  frutal:        { lat: -20.0242, lng: -48.9406, name: 'Frutal', state: 'MG' },
  ituiutaba:     { lat: -18.9688, lng: -49.4642, name: 'Ituiutaba', state: 'MG' },
  itumbiara:     { lat: -18.4194, lng: -49.2158, name: 'Itumbiara', state: 'GO' },
  iturama:       { lat: -19.7289, lng: -50.1964, name: 'Iturama', state: 'MG' },
  monte_carmelo: { lat: -18.7258, lng: -47.4989, name: 'Monte Carmelo', state: 'MG' },
  patos_de_minas:{ lat: -18.5789, lng: -46.5181, name: 'Patos de Minas', state: 'MG' },
  patrocinio:    { lat: -18.9439, lng: -46.9928, name: 'Patrocínio', state: 'MG' },
  prata:         { lat: -19.3072, lng: -48.9242, name: 'Prata', state: 'MG' },
  santa_vitoria: { lat: -18.8436, lng: -50.1219, name: 'Santa Vitória', state: 'MG' },
  tupaciguara:   { lat: -18.5922, lng: -48.7050, name: 'Tupaciguara', state: 'MG' },
  uberaba:       { lat: -19.7483, lng: -47.9319, name: 'Uberaba', state: 'MG' },
  uberlandia:    { lat: -18.9186, lng: -48.2772, name: 'Uberlândia', state: 'MG' }
};

// 2. Online Free Geocoding (Photon by Komoot / OpenStreetMap) with caching
function geocodeWithPhoton(query, cityKey) {
  return new Promise((resolve) => {
    const cleanQ = (query || '').trim();
    if (!cleanQ || cleanQ.length < 3) return resolve(null);

    const cacheKey = `${cityKey}:${cleanQ.toLowerCase()}`;
    if (geocodeCache.has(cacheKey)) {
      return resolve(geocodeCache.get(cacheKey));
    }

    const cInfo = CITY_DEFAULT_CENTERS[cityKey] || CITY_DEFAULT_CENTERS.ituiutaba;
    const stateCode = cInfo.state || (cityKey === 'itumbiara' ? 'GO' : 'MG');
    const fullQuery = `${cleanQ}, ${cInfo.name}, ${stateCode}, Brasil`;
    const urlStr = `https://photon.komoot.io/api/?q=${encodeURIComponent(fullQuery)}&lat=${cInfo.lat}&lon=${cInfo.lng}&limit=1`;

    const req = https.get(urlStr, { headers: { 'User-Agent': 'MaxDriveApp/1.0 (contact@maxdrive.local)' }, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.features && json.features.length > 0) {
            const feat = json.features[0];
            const coords = feat.geometry.coordinates; // [lng, lat]
            const result = {
              lat: coords[1],
              lng: coords[0],
              displayName: feat.properties.name || cleanQ,
              source: 'photon_osm'
            };
            geocodeCache.set(cacheKey, result);
            return resolve(result);
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// 3. Resolve Coordinates for City with Local Indexed DB + Number Interpolation + Online Fallback
async function resolveCoordsForCityServer(street, bairro, city) {
  const cityKey = (city || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
  const normS = normalizeTextRoute(street);
  const normB = normalizeTextRoute(bairro);
  const houseNum = extractHouseNumber(street);

  // A. Check in local street_coordinates.json indexed database (ONLY for the specific city!)
  const cityIndex = streetIndexMap.get(cityKey);
  if (cityIndex && street) {
    const cleanKey = normalizeStreetKey(street.replace(/(?:(?:n[ºo°]?|n[uú]mero|num)\s*[:.]?\s*|[,\s]+)\d{1,5}(?:\s*|$)/i, ' '));
    
    // Exact match
    if (cityIndex.has(cleanKey)) {
      return interpolateStreetCoords(cityIndex.get(cleanKey), houseNum);
    }
    
    // Prefix match
    for (const [key, sData] of cityIndex.entries()) {
      if (cleanKey.length >= 3 && (key === cleanKey || key.startsWith(cleanKey) || cleanKey.startsWith(key))) {
        return interpolateStreetCoords(sData, houseNum);
      }
    }

    // Inclusion match
    if (cleanKey.length >= 4) {
      for (const [key, sData] of cityIndex.entries()) {
        if (key.includes(cleanKey) || cleanKey.includes(key)) {
          return interpolateStreetCoords(sData, houseNum);
        }
      }
    }
  }

  // B. Online Photon Geocoding (high precision address / POI search in the actual target city)
  if (street && street.trim().length >= 3) {
    const onlineGeo = await geocodeWithPhoton(street + (bairro ? ' ' + bairro : ''), cityKey);
    if (onlineGeo) return onlineGeo;
  }

  // C. Known Bairros server list
  const bairros = KNOWN_BAIRROS_SERVER[cityKey];
  if (bairros) {
    for (const [bName, coord] of Object.entries(bairros)) {
      if ((normB && normB.includes(bName)) || normS.includes(bName)) {
        return { ...coord };
      }
    }
  }

  // D. Cities.json locations
  const cities = readDB('cities.json');
  const cityData = Array.isArray(cities) ? cities.find(c => (c.id && c.id.toLowerCase() === cityKey) || (c.name && c.name.toLowerCase() === cityKey)) : null;
  if (cityData && Array.isArray(cityData.locations)) {
    for (const loc of cityData.locations) {
      const locNorm = normalizeTextRoute(loc.name);
      if ((normB && locNorm.includes(normB)) || normS.includes(locNorm) || locNorm.includes(normS)) {
        return { lat: loc.lat, lng: loc.lng };
      }
    }
  }

  // E. Fallback to default city center of requested city (never fall back to Ituiutaba if another city was chosen)
  return CITY_DEFAULT_CENTERS[cityKey] || CITY_DEFAULT_CENTERS.ituiutaba;
}

// 4. Multi-Endpoint OSRM Route Requester with Redundancy & Smart Urban Mesh Fallback
function fetchFromOsrmEndpoint(urlStr, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = https.get(urlStr, { headers: { 'User-Agent': 'MaxDriveApp/1.0 (contact@maxdrive.local)' }, timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
            const r = json.routes[0];
            const distKm = Math.max(0.4, Math.round((r.distance / 1000) * 10) / 10);
            const durationMin = Math.max(2, Math.round(r.duration / 60));
            return resolve({
              success: true,
              distanceKm: distKm,
              durationMin: durationMin,
              coordinates: r.geometry.coordinates,
              source: 'osrm'
            });
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function fetchOsrmRouteServer(c1, c2, timeoutMs = 3500) {
  const lng1 = Number(c1.lng).toFixed(5);
  const lat1 = Number(c1.lat).toFixed(5);
  const lng2 = Number(c2.lng).toFixed(5);
  const lat2 = Number(c2.lat).toFixed(5);

  // If both coordinates are virtually identical (same spot)
  if (Math.abs(c1.lat - c2.lat) < 0.00015 && Math.abs(c1.lng - c2.lng) < 0.00015) {
    return {
      success: true,
      distanceKm: 0.5,
      durationMin: 2,
      coordinates: [[Number(lng1), Number(lat1)], [Number(lng2), Number(lat2)]],
      source: 'local_mesh'
    };
  }

  // 1. Primary: router.project-osrm.org
  const primaryUrl = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
  let result = await fetchFromOsrmEndpoint(primaryUrl, timeoutMs);
  if (result) return result;

  // 2. Fallback: routing.openstreetmap.de (Routed Car)
  const secondaryUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
  result = await fetchFromOsrmEndpoint(secondaryUrl, timeoutMs);
  if (result) return result;

  // 3. Fallback: High-precision Urban Grid Mesh with Manhattan Factor
  const airDist = haversineDistKm(c1.lat, c1.lng, c2.lat, c2.lng);
  const roadDist = Math.max(0.6, Math.round(airDist * 1.30 * 10) / 10);
  
  // Interpolate intermediate waypoints so Leaflet renders a multi-segment road route
  const midLng = (Number(lng1) + Number(lng2)) / 2;
  const midLat = (Number(lat1) + Number(lat2)) / 2;
  const cornerLng = Number(lng1);
  const cornerLat = Number(lat2);

  return {
    success: true,
    distanceKm: roadDist,
    durationMin: Math.max(2, Math.round(roadDist * 2.2)),
    coordinates: [
      [Number(lng1), Number(lat1)],
      [cornerLng, (Number(lat1) + cornerLat) / 2],
      [cornerLng, cornerLat],
      [(cornerLng + Number(lng2)) / 2, cornerLat],
      [Number(lng2), Number(lat2)]
    ],
    source: 'local_mesh'
  };
}

// -------------------------------------------------------------
// WEBSOCKET & PUSH NOTIFICATION DISPATCH ENGINE
// -------------------------------------------------------------
const { WebSocketServer, WebSocket } = require('ws');
let wss = null;

// Broadcast Helper Functions (Thread-safe, non-blocking)
function broadcastToAll(event, payload, excludeWs = null) {
  if (!wss || !wss.clients) return;
  const msg = JSON.stringify({ type: event, data: payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      try { client.send(msg); } catch (_) {}
    }
  });
}

function broadcastToDrivers(city, event, payload, excludeWs = null, vehicleTypeFilter = null) {
  if (!wss || !wss.clients) return;
  const normCity = (city || '').toLowerCase();
  const msg = JSON.stringify({ type: event, data: payload, timestamp: Date.now() });

  // Infer ride vehicle type filter from payload if available
  let reqVehType = vehicleTypeFilter;
  if (!reqVehType && payload && payload.ride && payload.ride.vehicleType) {
    reqVehType = payload.ride.vehicleType;
  }

  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      if (client.role === 'driver' && (!normCity || !client.city || client.city === normCity)) {
        if (reqVehType) {
          const clientVehType = client.vehicleType || 'car';
          const isMotoClient = (clientVehType === 'moto');
          const isMotoTarget = (reqVehType === 'moto');
          if (isMotoClient !== isMotoTarget) {
            return; // Skip sending to wrong driver category!
          }
        }
        try { client.send(msg); } catch (_) {}
      }
    }
  });
}

function broadcastToUser(userId, event, payload, excludeWs = null) {
  if (!userId || !wss || !wss.clients) return;
  const msg = JSON.stringify({ type: event, data: payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      if (client.userId === userId) {
        try { client.send(msg); } catch (_) {}
      }
    }
  });
}

function broadcastToRide(rideId, event, payload, excludeWs = null) {
  if (!rideId || !wss || !wss.clients) return;
  const rides = readDB('rides.json') || [];
  const ride = rides.find(r => r.id === rideId);
  const targetUserIds = new Set();
  if (ride) {
    if (ride.passengerId) targetUserIds.add(ride.passengerId);
    if (ride.driverId) targetUserIds.add(ride.driverId);
  }
  const msg = JSON.stringify({ type: event, data: payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      if (targetUserIds.has(client.userId) || client.role === 'admin') {
        try { client.send(msg); } catch (_) {}
      }
    }
  });
}

async function sendPushNotification({ userIds, role, city, vehicleType, title, body, data = {} }) {
  try {
    const targetVehType = vehicleType || (data && data.vehicleType);
    const tokens = await db.getPushTokens({ userIds, role, city });
    const tokenList = (tokens || []).map(t => t.token).filter(Boolean);

    // Também emite via WebSocket para qualquer usuário online receber aviso imediato
    if (userIds && Array.isArray(userIds)) {
      userIds.forEach(uid => {
        broadcastToUser(uid, 'notification', { title, body, data });
      });
    } else if (role === 'driver') {
      broadcastToDrivers(city, 'notification', { title, body, data }, null, targetVehType);
    }

    if (tokenList.length === 0) {
      return { sent: 0, reason: 'Nenhum token registrado para os destinatários informados' };
    }

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      console.log(`📡 [Push Service] Notificação enfileirada para ${tokenList.length} dispositivo(s): "${title}" - "${body}" (FCM_SERVER_KEY pendente no .env)`);
      return { sent: tokenList.length, mode: 'local_simulation' };
    }

    const fcmPayload = {
      registration_ids: tokenList,
      notification: {
        title,
        body,
        sound: 'default',
        icon: 'ic_launcher'
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const postData = JSON.stringify(fcmPayload);
    const fcmReq = https.request({
      hostname: 'fcm.googleapis.com',
      path: '/fcm/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        console.log(`✅ [Push FCM] Resposta Firebase (${res.statusCode}):`, respData.substring(0, 150));
      });
    });

    fcmReq.on('error', (err) => {
      console.warn('⚠️ [Push FCM Error]:', err.message);
    });

    fcmReq.write(postData);
    fcmReq.end();

    return { sent: tokenList.length, mode: 'fcm_dispatched' };
  } catch (err) {
    console.warn('⚠️ [Push Service Error]:', err.message);
    return { sent: 0, error: err.message };
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${PORT}`;
    const parsedUrl = new URL(req.url, `http://${host}`);
    parsedUrl.query = Object.fromEntries(parsedUrl.searchParams.entries());
    const pathname = parsedUrl.pathname;
    const method = req.method;
    if (pathname.startsWith('/api/')) {
      console.log(`[API ${method}] ${pathname}`);
    }

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    const origin = req.headers.origin || '*';
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email, X-User-Id, X-Session-Token, X-Admin-Request, X-User-Role, X-Requested-With, *',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // API Routes
  if (pathname.startsWith('/api/')) {

    // Health check
    if (pathname === '/api/health') {
      const dbStatus = db && typeof db.getDBStatus === 'function' ? await db.getDBStatus() : { engine: 'JSON_Local_Fallback', isPostgres: false };
      return sendJSON(res, 200, {
        status: 'online',
        name: 'MAX DRIVE Server',
        version: '1.0.0',
        uptime: process.uptime(),
        database: dbStatus.engine,
        isPostgres: dbStatus.isPostgres,
        timestamp: new Date().toISOString()
      });
    }

    // Push Notification Token Registration & Management
    if (pathname === '/api/push/register-token' && method === 'POST') {
      const body = await parseBody(req);
      const { token, userId, role, city, platform } = body;
      if (!token) {
        return sendJSON(res, 400, { success: false, message: 'Token é obrigatório' });
      }
      const saved = await db.savePushToken({ token, userId, role, city, platform });
      return sendJSON(res, 200, { success: true, token: saved });
    }

    if (pathname === '/api/push/tokens' && method === 'GET') {
      const tokens = await db.getPushTokens();
      return sendJSON(res, 200, { success: true, count: tokens.length, tokens });
    }

    if (pathname === '/api/push/send-test' && method === 'POST') {
      const body = await parseBody(req);
      const { title, body: msgBody, role, city, userId } = body;
      const result = await sendPushNotification({
        userIds: userId ? [userId] : undefined,
        role,
        city,
        title: title || 'Teste MAX DRIVE',
        body: msgBody || 'Notificação de teste do sistema',
        data: { test: true, timestamp: Date.now() }
      });
      return sendJSON(res, 200, { success: true, result });
    }

    // 1. Auth: Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password } = await parseBody(req);
      if (!email || !password) {
        return sendJSON(res, 400, { success: false, message: 'Informe e-mail e senha' });
      }

      const cleanInput = (email || '').trim().toLowerCase();
      const cleanDigits = (email || '').replace(/\D/g, '');
      const users = readDB('users.json');

      const user = users.find(u => {
        if (!u) return false;
        if (u.email && u.email.toLowerCase() === cleanInput) return true;
        if (cleanDigits && u.phone && u.phone.replace(/\D/g, '').includes(cleanDigits) && cleanDigits.length >= 8) return true;
        if (cleanDigits && u.cpf && u.cpf.replace(/\D/g, '') === cleanDigits) return true;
        return false;
      });

      const passOk = user && (
        verifyPassword(password, user.password) ||
        (user.securityCode && String(password).trim() === String(user.securityCode).trim()) ||
        (cleanInput === 'motorista@maxdrive.com' && String(password).trim() === '123')
      );

      if (!user || !passOk) {
        console.warn(`[LOGIN REJECTED] Input: "${email}", User found: ${!!user}, Pass ok: ${passOk}`);
        return sendJSON(res, 401, { success: false, message: 'E-mail ou senha incorretos' });
      }

      console.log(`[LOGIN SUCCESS] ${user.name} (${user.email}) - role: ${user.role}`);

      // Seamless upgrade: If stored password was legacy plain text, upgrade to PBKDF2 hash
      if (user.password && !user.password.startsWith('pbkdf2:')) {
        user.password = hashPassword(password);
        writeDB('users.json', users);
      }

      if (user.status === 'banned') {
        return sendJSON(res, 403, {
          success: false,
          banned: true,
          message: 'Sua conta foi suspensa / banida',
          banReason: user.banReason || 'Violação dos termos de uso da MAX DRIVE'
        });
      }

      // Generate single active session token (invalidates previous sessions on other devices)
      const sessionToken = 'sess_' + Date.now() + '_' + crypto.randomBytes(16).toString('hex');
      user.sessionToken = sessionToken;
      user.lastLoginAt = new Date().toISOString();
      writeDB('users.json', users);

      // Check both PostgreSQL and users.json
      let pgUser = null;
      if (db && typeof db.getUserByEmail === 'function') {
        try {
          pgUser = await db.getUserByEmail(user.email);
        } catch (_) {}
      }
      const isPgAdmin = !!(pgUser && (pgUser.role === 'admin' || pgUser.isAdmin === true));
      const isJsonAdmin = !!(user.role === 'admin' || user.isAdmin === true);
      const isAdmin = isPgAdmin || isJsonAdmin;
      if (isAdmin) {
        user.isAdmin = true;
        user.role = 'admin';
      }
      const { password: _p, ...safeUser } = user;

      return sendJSON(res, 200, {
        success: true,
        user: { ...safeUser, isAdmin, sessionToken },
        sessionToken,
        message: 'Login realizado com sucesso'
      });
    }

    // 2. Auth: Register
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const { name, email, phone, securityCode, password, role, vehicle } = body;

      if (!name || !email || !password || !securityCode) {
        return sendJSON(res, 400, { success: false, message: 'Preencha todos os campos obrigatórios' });
      }

      if (String(securityCode).length !== 6) {
        return sendJSON(res, 400, { success: false, message: 'O código de segurança deve conter exatamente 6 dígitos' });
      }

      const users = readDB('users.json');
      const existing = users.find(u => u.email && u.email.toLowerCase() === email.trim().toLowerCase());
      if (existing) {
        return sendJSON(res, 409, { success: false, message: 'Este e-mail já está cadastrado no MAX DRIVE' });
      }

      const userRole = role === 'driver' ? 'driver' : 'passenger';
      const isDriver = userRole === 'driver';

      const newUser = {
        id: 'usr-' + Date.now(),
        name: name.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone || '',
        cpf: body.cpf || '',
        cnh: body.cnh || null,
        birthDate: body.birthDate || '',
        securityCode: String(securityCode),
        password: hashPassword(password),
        role: userRole,
        isAdmin: false,
        status: 'active',
        banReason: '',
        approved: !isDriver, // Driver requires admin approval!
        driverApproved: !isDriver,
        rating: null,
        ratingCount: 0,
        totalRides: 0,
        registeredYears: 0,
        city: body.city || 'Ituiutaba',
        avatar: body.avatar || null,
        vehicle: isDriver ? (vehicle || null) : null,
        weeklyPaymentStatus: isDriver ? 'PENDENTE' : null,
        paidUntil: null,
        paymentBlocked: false,
        createdAt: new Date().toISOString()
      };

      await db.saveUser(newUser);

      const { password: _regPw, ...safeNewUser } = newUser;
      return sendJSON(res, 201, {
        success: true,
        user: safeNewUser,
        message: 'Cadastro realizado com sucesso!'
      });
    }

    // Auth: Validate Active Session (Enforce single active session)
    if (pathname === '/api/auth/validate-session' && (method === 'GET' || method === 'POST')) {
      const parsedBody = method === 'POST' ? await parseBody(req) : {};
      const userId = req.headers['x-user-id'] || parsedUrl.query.userId || (parsedUrl.searchParams && parsedUrl.searchParams.get('userId')) || parsedBody.userId;
      const token = req.headers['x-session-token'] || parsedUrl.query.sessionToken || parsedUrl.query.token || (parsedUrl.searchParams && (parsedUrl.searchParams.get('sessionToken') || parsedUrl.searchParams.get('token'))) || parsedBody.sessionToken;

      if (!userId || !token) {
        return sendJSON(res, 400, { success: false, valid: false, message: 'Identificadores de sessão ausentes' });
      }

      const users = readDB('users.json');
      const user = users.find(u => u && u.id === userId);

      if (!user) {
        return sendJSON(res, 404, { success: false, valid: false, sessionTerminated: true, message: 'Usuário não encontrado' });
      }

      if (user.status === 'banned') {
        return sendJSON(res, 403, {
          success: false,
          valid: false,
          sessionTerminated: true,
          banned: true,
          message: 'Sua conta foi suspensa / banida',
          banReason: user.banReason || 'Violação dos termos de uso da MAX DRIVE'
        });
      }

      // Check if sessionToken is valid and matches active session
      if (!user.sessionToken || user.sessionToken !== token) {
        const isConcurrent = Boolean(user.sessionToken && user.sessionToken !== token);
        return sendJSON(res, 401, {
          success: false,
          valid: false,
          sessionTerminated: true,
          reason: isConcurrent ? 'concurrent_login' : 'session_ended',
          message: isConcurrent
            ? 'Sua conta foi conectada em outro dispositivo ou local. Esta sessão anterior foi encerrada por segurança.'
            : 'Sua sessão foi encerrada. Conecte-se novamente para continuar.'
        });
      }

      // Bidirectional sync: Check PostgreSQL user status if connected
      let pgUser = null;
      if (db && typeof db.getUserById === 'function') {
        try {
          pgUser = await db.getUserById(userId);
        } catch (_) {}
      }

      const isPgAdmin = !!(pgUser && (pgUser.role === 'admin' || pgUser.isAdmin === true));
      const isJsonAdmin = !!(user.role === 'admin' || user.isAdmin === true);
      const isAdmin = isPgAdmin || isJsonAdmin;

      if (isAdmin) {
        if (!user.isAdmin || user.role !== 'admin') {
          user.isAdmin = true;
          user.role = 'admin';
          writeDB('users.json', users);
        }
        if (pgUser && (!pgUser.isAdmin || pgUser.role !== 'admin') && db && typeof db.saveUser === 'function') {
          pgUser.isAdmin = true;
          pgUser.role = 'admin';
          db.saveUser(pgUser).catch(() => {});
        }
      }

      return sendJSON(res, 200, {
        success: true,
        valid: true,
        role: user.role,
        isAdmin
      });
    }

    // Auth: Reset / Recover Password
    if (pathname === '/api/auth/reset-password' && method === 'POST') {
      const body = await parseBody(req);
      const email = body.email || body.identifier;
      const { securityCode, newPassword } = body;

      if (!email || !securityCode || !newPassword) {
        return sendJSON(res, 400, { success: false, message: 'Preencha todos os campos obrigatórios' });
      }

      if (String(newPassword).length < 4) {
        return sendJSON(res, 400, { success: false, message: 'A nova senha deve ter no mínimo 4 caracteres' });
      }

      const cleanInput = (email || '').trim().toLowerCase();
      const cleanDigits = (email || '').replace(/\D/g, '');
      const users = readDB('users.json');

      const user = users.find(u => {
        if (!u) return false;
        if (u.email && u.email.toLowerCase() === cleanInput) return true;
        if (cleanDigits && u.phone && u.phone.replace(/\D/g, '').includes(cleanDigits) && cleanDigits.length >= 8) return true;
        if (cleanDigits && u.cpf && u.cpf.replace(/\D/g, '') === cleanDigits) return true;
        return false;
      });

      if (!user) {
        return sendJSON(res, 404, { success: false, message: 'Nenhuma conta encontrada com este e-mail ou telefone' });
      }

      if (!user.securityCode || String(user.securityCode).trim() !== String(securityCode).trim()) {
        return sendJSON(res, 400, { success: false, message: 'Código de segurança de 6 dígitos incorreto' });
      }

      user.password = hashPassword(newPassword);
      user.sessionToken = null; // Enforce re-login
      writeDB('users.json', users);

      // Sync to PostgreSQL if connected
      if (db && typeof db.saveUser === 'function') {
        db.saveUser(user).catch(err => console.warn('Could not sync password reset to PG:', err.message));
      }

      console.log(`[PASSWORD RESET] Senha redefinida para ${user.name} (${user.email})`);
      return sendJSON(res, 200, {
        success: true,
        message: 'Senha redefinida com sucesso! Você já pode entrar com sua nova senha.'
      });
    }

    // Auth: Logout (Invalidate active session)
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const body = await parseBody(req);
      const userId = req.headers['x-user-id'] || body.userId;

      if (userId) {
        const users = readDB('users.json');
        const user = users.find(u => u && u.id === userId);
        if (user) {
          user.sessionToken = null;
          writeDB('users.json', users);
          if (db && typeof db.saveUser === 'function') {
            db.saveUser(user).catch(() => {});
          }
          console.log(`[LOGOUT] Sessão finalizada para ${user.name} (${user.email})`);
        }
      }

      return sendJSON(res, 200, { success: true, message: 'Sessão encerrada com sucesso' });
    }

    // 3. Auth: Current User / Profile Update
    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const body = await parseBody(req);
      const userId = req.headers['x-user-id'] || body.id;
      const users = readDB('users.json');
      const idx = users.findIndex(u => u.id === userId || (body.email && u.email.toLowerCase() === body.email.toLowerCase()));

      if (idx === -1) {
        return sendJSON(res, 404, { success: false, message: 'Usuário não encontrado' });
      }

      // If updating password, verify security code if provided
      if (body.newPassword) {
        if (body.securityCode && String(body.securityCode) !== String(users[idx].securityCode)) {
          return sendJSON(res, 400, { success: false, message: 'Código de segurança de 6 dígitos inválido' });
        }
        users[idx].password = hashPassword(body.newPassword);
      }

      if (body.name) users[idx].name = body.name.toUpperCase();
      if (body.birthDate !== undefined) users[idx].birthDate = body.birthDate;
      if (body.cpf !== undefined) users[idx].cpf = body.cpf;
      if (body.phone !== undefined) users[idx].phone = body.phone;
      if (body.cnh !== undefined) users[idx].cnh = body.cnh;
      if (body.cnhMessage !== undefined) users[idx].cnhMessage = body.cnhMessage;
      if (body.docMessage !== undefined) users[idx].docMessage = body.docMessage;
      if (body.avatar !== undefined) users[idx].avatar = body.avatar;
      if (body.vehicle && users[idx].role === 'driver') {
        const currentPhotos = (users[idx].vehicle && users[idx].vehicle.photos) || {};
        const newPhotos = (body.vehicle && body.vehicle.photos) || {};
        users[idx].vehicle = {
          ...users[idx].vehicle,
          ...body.vehicle,
          photos: {
            ...currentPhotos,
            ...newPhotos
          }
        };
      }
      if (body.city !== undefined) users[idx].city = body.city;

      writeDB('users.json', users);
      return sendJSON(res, 200, { success: true, user: users[idx], message: 'Dados atualizados com sucesso!' });
    }

    // 4. Auth: Status Toggle (active/inactive)
    if (pathname === '/api/auth/status' && method === 'PUT') {
      const body = await parseBody(req);
      const userId = req.headers['x-user-id'] || body.userId;
      const users = readDB('users.json');
      const user = users.find(u => u.id === userId);
      if (!user) return sendJSON(res, 404, { success: false, message: 'Usuário não encontrado' });

      if (user.role === 'driver' && body.status === 'active') {
        const isBlocked = user.paymentBlocked === true || isPaymentExpired(user.paidUntil, user.weeklyPaymentStatus);
        if (isBlocked) {
          user.weeklyPaymentStatus = user.paymentBlocked ? 'BLOQUEADO' : 'PENDENTE';
          writeDB('users.json', users);
          return sendJSON(res, 403, {
            success: false,
            message: 'Acesso bloqueado por falta de pagamento semanal. Efetue o pagamento via Pix para ficar online.',
            paymentBlocked: true,
            weeklyPaymentStatus: user.weeklyPaymentStatus
          });
        }
      }

      if (user.status !== 'banned') {
        user.status = body.status === 'inactive' ? 'inactive' : 'active';
        writeDB('users.json', users);
      }

      return sendJSON(res, 200, { success: true, status: user.status, banReason: user.banReason });
    }

    // 4b. Get user profile / details by ID
    const singleUserMatch = pathname.match(/^\/api\/users\/([^\/]+)$/);
    if (singleUserMatch && method === 'GET') {
      const userId = singleUserMatch[1];
      const users = readDB('users.json');
      const user = users.find(u => u.id === userId);
      if (!user) return sendJSON(res, 404, { success: false, message: 'Usuário não encontrado' });
      const { password, ...safeUser } = user;
      return sendJSON(res, 200, { success: true, user: safeUser });
    }

    // 5. Cities: List, Add, Update and Delete
    if (pathname === '/api/cities' && method === 'GET') {
      const cities = readDB('cities.json');
      return sendJSON(res, 200, { success: true, cities });
    }

    if (pathname === '/api/cities' && method === 'POST') {
      const userEmail = req.headers['x-user-email'];
      if (!isAdminEmail(userEmail)) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores podem adicionar cidades' });
      }

      const body = await parseBody(req);
      if (!body.name) return sendJSON(res, 400, { success: false, message: 'Nome da cidade é obrigatório' });

      const cities = readDB('cities.json');
      const targetId = body.id || body.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '_');
      
      const existingIdx = cities.findIndex(c => c.id.toLowerCase() === targetId.toLowerCase() || c.name.toLowerCase() === body.name.toLowerCase().trim());
      if (existingIdx !== -1) {
        // Update existing city instead of duplicating
        const existing = cities[existingIdx];
        cities[existingIdx] = {
          ...existing,
          name: body.name || existing.name,
          state: body.state || existing.state || 'MG',
          active: body.active !== undefined ? Boolean(body.active) : existing.active,
          baseFareCar: body.baseFareCar !== undefined ? Number(body.baseFareCar) : existing.baseFareCar,
          kmRateCar: body.kmRateCar !== undefined ? Number(body.kmRateCar) : (existing.kmRateCar || 1.00),
          baseFareMoto: body.baseFareMoto !== undefined ? Number(body.baseFareMoto) : existing.baseFareMoto,
          kmRateMoto: body.kmRateMoto !== undefined ? Number(body.kmRateMoto) : (existing.kmRateMoto || 0.85),
          locations: (Array.isArray(body.locations) && body.locations.length > 0) ? body.locations : (existing.locations || [])
        };
        writeDB('cities.json', cities);
        return sendJSON(res, 200, { success: true, message: 'Cidade já cadastrada; tarifas e dados atualizados com sucesso!', city: cities[existingIdx] });
      }

      const newCity = {
        id: targetId,
        name: body.name.trim(),
        state: (body.state || 'MG').trim().toUpperCase(),
        active: body.active !== undefined ? Boolean(body.active) : true,
        baseFareCar: Number(body.baseFareCar) || 6.00,
        kmRateCar: Number(body.kmRateCar) || 1.00,
        baseFareMoto: Number(body.baseFareMoto) || 4.50,
        kmRateMoto: Number(body.kmRateMoto) || 0.85,
        locations: Array.isArray(body.locations) ? body.locations : []
      };

      cities.push(newCity);
      writeDB('cities.json', cities);
      return sendJSON(res, 201, { success: true, message: 'Cidade adicionada com sucesso!', city: newCity });
    }

    const singleCityMatch = pathname.match(/^\/api\/cities\/([^\/]+)$/);
    if (singleCityMatch && method === 'PUT') {
      const userEmail = req.headers['x-user-email'];
      if (!isAdminEmail(userEmail)) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores podem editar cidades' });
      }

      const cityId = decodeURIComponent(singleCityMatch[1]).toLowerCase();
      const body = await parseBody(req);
      const cities = readDB('cities.json');
      const idx = cities.findIndex(c => c.id.toLowerCase() === cityId || c.name.toLowerCase() === cityId);

      if (idx === -1) {
        return sendJSON(res, 404, { success: false, message: 'Cidade não encontrada' });
      }

      const existing = cities[idx];
      cities[idx] = {
        ...existing,
        name: body.name ? body.name.trim() : existing.name,
        state: body.state ? body.state.trim().toUpperCase() : (existing.state || 'MG'),
        active: body.active !== undefined ? Boolean(body.active) : existing.active,
        baseFareCar: body.baseFareCar !== undefined ? Number(body.baseFareCar) : existing.baseFareCar,
        kmRateCar: body.kmRateCar !== undefined ? Number(body.kmRateCar) : (existing.kmRateCar || 1.00),
        baseFareMoto: body.baseFareMoto !== undefined ? Number(body.baseFareMoto) : existing.baseFareMoto,
        kmRateMoto: body.kmRateMoto !== undefined ? Number(body.kmRateMoto) : (existing.kmRateMoto || 0.85),
        locations: (Array.isArray(body.locations) && body.locations.length > 0) ? body.locations : (existing.locations || [])
      };

      writeDB('cities.json', cities);
      return sendJSON(res, 200, { success: true, message: 'Tarifas e dados da cidade atualizados com sucesso!', city: cities[idx] });
    }

    if (singleCityMatch && method === 'DELETE') {
      const userEmail = req.headers['x-user-email'];
      if (!isAdminEmail(userEmail)) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores podem remover cidades' });
      }

      const cityId = decodeURIComponent(singleCityMatch[1]).toLowerCase();
      let cities = readDB('cities.json');
      const initialLength = cities.length;
      cities = cities.filter(c => c.id.toLowerCase() !== cityId && c.name.toLowerCase() !== cityId);

      if (cities.length === initialLength) {
        return sendJSON(res, 404, { success: false, message: 'Cidade não encontrada' });
      }

      writeDB('cities.json', cities);
      return sendJSON(res, 200, { success: true, message: 'Cidade removida com sucesso!' });
    }

    // 5b. Streets Suggestions (from OpenStreetMap database with instant coordinates)
    if (pathname === '/api/streets' && method === 'GET') {
      const cityParam = (parsedUrl.query.city || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
      const q = (parsedUrl.query.q || '').trim().toLowerCase();
      const limit = parseInt(parsedUrl.query.limit) || 15;

      const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const qNorm = normalize(q);

      let items = [];
      try {
        const sql = `
          SELECT DISTINCT street_name, bairro, lat, lng
          FROM street_coordinates
          WHERE city_key = $1
            AND ($2 = '' OR LOWER(street_name) LIKE $3 OR LOWER(bairro) LIKE $3)
          ORDER BY street_name ASC
          LIMIT $4
        `;
        const searchPattern = `%${qNorm}%`;
        const dbRes = await db.query(sql, [cityParam, qNorm, searchPattern, limit]);
        if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
          items = dbRes.rows.map(r => ({
            name: r.street_name,
            bairro: r.bairro || 'Centro',
            lat: r.lat,
            lng: r.lng
          }));
        }
      } catch (err) {
        console.warn('[API Streets] SQL Error:', err.message);
      }

      // Fallback to in-memory streetIndexMap/JSON if SQL returned empty
      if (items.length === 0) {
        const cityIndex = streetIndexMap.get(cityParam);
        if (cityIndex) {
          for (const [key, sData] of cityIndex.entries()) {
            const sNorm = normalize(sData.name);
            const bNorm = sData.bairro ? normalize(sData.bairro) : '';
            if (!qNorm || sNorm.includes(qNorm) || bNorm.includes(qNorm) || key.includes(qNorm)) {
              items.push({
                name: sData.name,
                bairro: sData.bairro || 'Centro',
                lat: Number(sData.lat),
                lng: Number(sData.lng)
              });
              if (items.length >= limit) break;
            }
          }
        }

        if (items.length === 0) {
          const cityStreetsData = readDB('city_streets.json');
          const list = cityStreetsData[cityParam] || [];
          const center = CITY_DEFAULT_CENTERS[cityParam] || CITY_DEFAULT_CENTERS.ituiutaba;
          for (const street of list) {
            const sNorm = normalize(street);
            if (!qNorm || sNorm.includes(qNorm)) {
              items.push({
                name: street,
                bairro: 'Centro',
                lat: center.lat,
                lng: center.lng
              });
              if (items.length >= limit) break;
            }
          }
        }
      }

      const matchedNames = items.map(it => it.name);

      return sendJSON(res, 200, {
        success: true,
        city: cityParam,
        query: q,
        totalFound: items.length,
        streets: matchedNames,
        items
      });
    }

    // 5c. Geocoding API: Forward & Reverse Geocoding
    if (pathname === '/api/geocode' && method === 'GET') {
      const cityParam = (parsedUrl.query.city || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
      const q = parsedUrl.query.q || '';
      const bairro = parsedUrl.query.bairro || '';
      const coords = await resolveCoordsForCityServer(q, bairro, cityParam);
      return sendJSON(res, 200, {
        success: true,
        city: cityParam,
        query: q,
        lat: coords.lat,
        lng: coords.lng,
        name: coords.name || q,
        source: coords.source || 'local_indexed'
      });
    }

    if (pathname === '/api/reverse-geocode' && method === 'GET') {
      const cityParam = (parsedUrl.query.city || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
      const lat = parseFloat(parsedUrl.query.lat);
      const lng = parseFloat(parsedUrl.query.lng);
      if (isNaN(lat) || isNaN(lng)) {
        return sendJSON(res, 400, { success: false, message: 'Parâmetros lat e lng são obrigatórios' });
      }

      const cityIndex = streetIndexMap.get(cityParam);
      let closest = null;
      let minDist = Infinity;
      if (cityIndex) {
        for (const s of cityIndex.values()) {
          const d = haversineDistKm(lat, lng, s.lat, s.lng);
          if (d < minDist) {
            minDist = d;
            closest = s;
          }
        }
      }

      if (closest && minDist <= 0.4) {
        return sendJSON(res, 200, {
          success: true,
          address: closest.name,
          bairro: closest.bairro || '',
          distanceKm: minDist,
          lat,
          lng
        });
      }

      return sendJSON(res, 200, {
        success: true,
        address: 'Minha Localização Atual',
        bairro: 'GPS',
        distanceKm: minDist,
        lat,
        lng
      });
    }

    // 5d. Real Route & Distance (OSRM / OpenStreetMap with Local Intelligent Fallback)
    if (pathname === '/api/route' && method === 'GET') {
      const cityParam = (parsedUrl.query.city || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
      const orig = parsedUrl.query.orig || '';
      const origBairro = parsedUrl.query.origBairro || '';
      const dest = parsedUrl.query.dest || '';
      const destBairro = parsedUrl.query.destBairro || '';
      let origLat = parseFloat(parsedUrl.query.origLat);
      let origLng = parseFloat(parsedUrl.query.origLng);
      let destLat = parseFloat(parsedUrl.query.destLat);
      let destLng = parseFloat(parsedUrl.query.destLng);

      const cacheKey = `${cityParam}:${orig}:${origBairro}:${origLat},${origLng}->${dest}:${destBairro}:${destLat},${destLng}`;
      if (routeCache.has(cacheKey)) {
        return sendJSON(res, 200, routeCache.get(cacheKey));
      }

      let c1 = (!isNaN(origLat) && !isNaN(origLng)) ? { lat: origLat, lng: origLng } : await resolveCoordsForCityServer(orig, origBairro, cityParam);
      let c2 = (!isNaN(destLat) && !isNaN(destLng)) ? { lat: destLat, lng: destLng } : await resolveCoordsForCityServer(dest, destBairro, cityParam);

      let routeResult = await fetchOsrmRouteServer(c1, c2);
      if (!routeResult) {
        // Local intelligent fallback
        const airDist = haversineDistKm(c1.lat, c1.lng, c2.lat, c2.lng);
        const roadDist = Math.max(0.6, Math.round(airDist * 1.30 * 10) / 10);
        routeResult = {
          success: true,
          distanceKm: roadDist,
          durationMin: Math.max(2, Math.round(roadDist * 2.2)),
          coordinates: [[c1.lng, c1.lat], [c2.lng, c2.lat]],
          source: 'local_mesh'
        };
      }

      routeResult.c1 = c1;
      routeResult.c2 = c2;

      routeCache.set(cacheKey, routeResult);
      return sendJSON(res, 200, routeResult);
    }

    // 5.5. Finances: Aggregate earnings for driver or passenger
    if (pathname === '/api/finances' && method === 'GET') {
      const userId = parsedUrl.query.userId;
      const userRole = parsedUrl.query.role || 'driver';
      const rides = await db.getRides();
      const users = await db.getUsers();
      const user = users.find(u => u.id === userId);

      const isDriver = (userRole === 'driver') || (user && user.role === 'driver');

      let completedRides = rides.filter(r => r.status === 'completed');
      if (userId) {
        if (isDriver) {
          completedRides = completedRides.filter(r =>
            (r.driverId && r.driverId === userId) ||
            (user && user.email && r.driverEmail && r.driverEmail.toLowerCase() === user.email.toLowerCase()) ||
            (user && user.name && r.driverName && r.driverName.toLowerCase() === user.name.toLowerCase())
          );
        } else {
          completedRides = completedRides.filter(r =>
            (r.passengerId && r.passengerId === userId) ||
            (user && user.email && r.passengerEmail && r.passengerEmail.toLowerCase() === user.email.toLowerCase()) ||
            (user && user.name && r.passengerName && r.passengerName.toLowerCase() === user.name.toLowerCase())
          );
        }
      }

      completedRides.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

      let dailyTotal = 0, dailyRides = 0;
      let weeklyTotal = 0, weeklyRides = 0;
      let monthlyTotal = 0, monthlyRides = 0;
      let totalEarnings = 0, totalRides = 0;

      completedRides.forEach(r => {
        const fare = Number(r.finalFare || r.price || 0);
        const rDate = new Date(r.completedAt || r.createdAt);

        totalEarnings += fare;
        totalRides++;

        // Same day
        if (rDate.getFullYear() === now.getFullYear() && rDate.getMonth() === now.getMonth() && rDate.getDate() === now.getDate()) {
          dailyTotal += fare;
          dailyRides++;
        }

        // Same week (Segunda a Domingo)
        if (rDate >= monday && rDate <= sunday) {
          weeklyTotal += fare;
          weeklyRides++;
        }

        // Same month
        if (rDate.getFullYear() === now.getFullYear() && rDate.getMonth() === now.getMonth()) {
          monthlyTotal += fare;
          monthlyRides++;
        }
      });

      const ticketMedio = totalRides > 0 ? (totalEarnings / totalRides) : 0;

      return sendJSON(res, 200, {
        success: true,
        isDriver,
        dailyTotal: Number(dailyTotal.toFixed(2)),
        dailyRides,
        weeklyTotal: Number(weeklyTotal.toFixed(2)),
        weeklyRides,
        monthlyTotal: Number(monthlyTotal.toFixed(2)),
        monthlyRides,
        totalEarnings: Number(totalEarnings.toFixed(2)),
        totalRides,
        ticketMedio: Number(ticketMedio.toFixed(2)),
        completedRides: completedRides.slice(0, 30)
      });
    }

    // 6. Rides: List, Request, Accept, Status Update, Rating
    if (pathname === '/api/rides' && method === 'GET') {
      const rides = await db.getRides();
      checkAndExpireRides(rides);
      const statusFilter = parsedUrl.query.status;
      const cityFilter = parsedUrl.query.city;
      const passengerId = parsedUrl.query.passengerId;
      const driverId = parsedUrl.query.driverId;
      const userId = parsedUrl.query.userId;
      const userRole = parsedUrl.query.role;
      const isAdminRequest = req.headers['x-admin-request'] === 'true';

      let filtered = rides;
      if (statusFilter) {
        if (statusFilter === 'radar') {
          filtered = filtered.filter(r => r.status === 'requested');

          // Strict vehicle type filter for drivers (Car drivers see Car rides; Moto drivers see Moto rides)
          let targetVehicleType = parsedUrl.query.vehicleType;
          const reqUserId = req.headers['x-user-id'] || driverId || userId;
          if (!targetVehicleType && reqUserId) {
            const reqDrv = await db.getUserById(reqUserId);
            if (reqDrv && reqDrv.vehicle && reqDrv.vehicle.type) {
              targetVehicleType = reqDrv.vehicle.type;
            }
          }

          if (targetVehicleType) {
            const isMotoDrv = targetVehicleType === 'moto';
            filtered = filtered.filter(r => {
              const isMotoRide = r.vehicleType === 'moto';
              return isMotoDrv ? isMotoRide : !isMotoRide;
            });
          }
        } else {
          filtered = filtered.filter(r => r.status === statusFilter);
        }
      }
      if (cityFilter) {
        filtered = filtered.filter(r => r.city && r.city.toLowerCase() === cityFilter.toLowerCase());
      }

      // DO NOT apply user ownership filtering when searching the RADAR!
      if (statusFilter !== 'radar') {
        const usersList = await db.getUsers();

        if (passengerId) {
          const pTarget = String(passengerId).toLowerCase();
          const pUser = usersList.find(u =>
            (u.id && String(u.id).toLowerCase() === pTarget) ||
            (u.email && u.email.toLowerCase() === pTarget) ||
            (u.name && u.name.toLowerCase() === pTarget)
          );

          const targetIds = new Set([pTarget]);
          const targetNames = new Set([pTarget]);

          if (pUser) {
            if (pUser.id) targetIds.add(String(pUser.id).toLowerCase());
            if (pUser.email) targetIds.add(String(pUser.email).toLowerCase());
            if (pUser.name) targetNames.add(String(pUser.name).toLowerCase());
          }

          filtered = filtered.filter(r => {
            if (!r) return false;
            const rPassId = r.passengerId ? String(r.passengerId).toLowerCase() : '';
            const rPassName = r.passengerName ? String(r.passengerName).toLowerCase() : '';
            const rPassEmail = r.passengerEmail ? String(r.passengerEmail).toLowerCase() : '';

            return targetIds.has(rPassId) ||
                   targetIds.has(rPassEmail) ||
                   targetNames.has(rPassName) ||
                   (rPassName && pTarget && rPassName.includes(pTarget));
          });
        }

        if (driverId) {
          const dTarget = String(driverId).toLowerCase();
          const dUser = usersList.find(u =>
            (u.id && String(u.id).toLowerCase() === dTarget) ||
            (u.email && u.email.toLowerCase() === dTarget) ||
            (u.name && u.name.toLowerCase() === dTarget)
          );

          const targetDriverIds = new Set([dTarget]);
          const targetDriverNames = new Set([dTarget]);

          if (dUser) {
            if (dUser.id) targetDriverIds.add(String(dUser.id).toLowerCase());
            if (dUser.email) targetDriverIds.add(String(dUser.email).toLowerCase());
            if (dUser.name) targetDriverNames.add(String(dUser.name).toLowerCase());
          }

          filtered = filtered.filter(r => {
            if (!r) return false;
            const rDrvId = r.driverId ? String(r.driverId).toLowerCase() : '';
            const rDrvName = r.driverName ? String(r.driverName).toLowerCase() : '';
            const rDrvEmail = r.driverEmail ? String(r.driverEmail).toLowerCase() : '';

            return targetDriverIds.has(rDrvId) ||
                   targetDriverIds.has(rDrvEmail) ||
                   targetDriverNames.has(rDrvName) ||
                   (rDrvName && dTarget && rDrvName.includes(dTarget));
          });
        }

        if (userId && !passengerId && !driverId && !isAdminRequest) {
          const uTarget = String(userId).toLowerCase();
          const uUser = usersList.find(u =>
            (u.id && String(u.id).toLowerCase() === uTarget) ||
            (u.email && u.email.toLowerCase() === uTarget) ||
            (u.name && u.name.toLowerCase() === uTarget)
          );

          const targetUserIds = new Set([uTarget]);
          const targetUserNames = new Set([uTarget]);

          if (uUser) {
            if (uUser.id) targetUserIds.add(String(uUser.id).toLowerCase());
            if (uUser.email) targetUserIds.add(String(uUser.email).toLowerCase());
            if (uUser.name) targetUserNames.add(String(uUser.name).toLowerCase());
          }

          if (userRole === 'driver') {
            filtered = filtered.filter(r => {
              if (!r) return false;
              const rDrvId = r.driverId ? String(r.driverId).toLowerCase() : '';
              const rDrvName = r.driverName ? String(r.driverName).toLowerCase() : '';
              const rDrvEmail = r.driverEmail ? String(r.driverEmail).toLowerCase() : '';
              return targetUserIds.has(rDrvId) || targetUserIds.has(rDrvEmail) || targetUserNames.has(rDrvName);
            });
          } else if (userRole === 'passenger') {
            filtered = filtered.filter(r => {
              if (!r) return false;
              const rPassId = r.passengerId ? String(r.passengerId).toLowerCase() : '';
              const rPassName = r.passengerName ? String(r.passengerName).toLowerCase() : '';
              const rPassEmail = r.passengerEmail ? String(r.passengerEmail).toLowerCase() : '';
              return targetUserIds.has(rPassId) || targetUserIds.has(rPassEmail) || targetUserNames.has(rPassName);
            });
          }
        }
      }

      // Enrich rides with avatars if missing
      const usersList = await db.getUsers();
      const enriched = filtered.map(r => {
        const enrichedRide = { ...r };
        if (!enrichedRide.passengerAvatar) {
          const u = usersList.find(usr => usr.id === enrichedRide.passengerId || (enrichedRide.passengerName && usr.name === enrichedRide.passengerName));
          enrichedRide.passengerAvatar = (u && u.avatar) || null;
        }
        if (enrichedRide.driverId && !enrichedRide.driverAvatar) {
          const d = usersList.find(usr => usr.id === enrichedRide.driverId || (enrichedRide.driverName && usr.name === enrichedRide.driverName));
          enrichedRide.driverAvatar = (d && d.avatar) || null;
        }
        return enrichedRide;
      });

      return sendJSON(res, 200, { success: true, rides: enriched });
    }

    if (pathname === '/api/rides' && method === 'POST') {
      const body = await parseBody(req);
      const {
        passengerId,
        passengerName,
        origin,
        destination,
        reference,
        city,
        vehicleType,
        distance,
        duration,
        price,
        paymentMethod
      } = body;

      if (!origin || !destination) {
        return sendJSON(res, 400, { success: false, message: 'Origem e destino são obrigatórios' });
      }

      // Server-side Fair Calculation & Validation against official city rates
      const targetCityNorm = (city || 'ituiutaba').toLowerCase().replace(/\s+/g, '_');
      const cities = await db.getCities();
      const cityCfg = cities.find(c => c.id.toLowerCase() === targetCityNorm || c.name.toLowerCase() === (city || '').toLowerCase().trim());

      const kmMatch = (distance || '').match(/([\d\.,]+)/);
      const kmNum = kmMatch ? parseFloat(kmMatch[1].replace(',', '.')) : 4.0;
      const isMoto = (vehicleType === 'moto');

      const baseFare = cityCfg ? (isMoto ? cityCfg.baseFareMoto : cityCfg.baseFareCar) : (isMoto ? 5.50 : 7.00);
      const kmRate = cityCfg ? (isMoto ? cityCfg.kmRateMoto : cityCfg.kmRateCar) : (isMoto ? 0.85 : 1.00);
      const calculatedPrice = Number((Number(baseFare) + kmNum * Number(kmRate)).toFixed(2));

      // Validate or enforce server-calculated fare
      const clientPriceNum = Number(price);
      const finalPrice = (!isNaN(clientPriceNum) && Math.abs(clientPriceNum - calculatedPrice) <= 1.00)
        ? Number(clientPriceNum.toFixed(2))
        : calculatedPrice;

      const users = await db.getUsers();
      const passUser = users.find(u => (passengerId && u.id === passengerId) || (passengerName && u.name === passengerName));
      const finalPassengerAvatar = body.passengerAvatar || (passUser && passUser.avatar) || null;

      const newRide = {
        id: 'ride-' + Date.now(),
        passengerId: passengerId || (passUser && passUser.id) || null,
        passengerName: passengerName || (passUser && passUser.name) || 'PASSAGEIRO MAX DRIVE',
        passengerEmail: body.passengerEmail || (passUser && passUser.email) || null,
        passengerPhone: body.passengerPhone || (passUser && passUser.phone) || null,
        passengerAvatar: finalPassengerAvatar,
        passengerRating: 5.0,
        driverId: null,
        driverName: null,
        driverAvatar: null,
        driverRating: null,
        driverRatingCount: null,
        vehicle: null,
        origin: origin,
        destination: destination,
        originCoords: body.originCoords || null,
        destinationCoords: body.destinationCoords || null,
        reference: reference || '',
        city: city || 'Ituiutaba',
        distance: distance || `${kmNum} KM`,
        duration: duration || (vehicleType === 'moto' ? '7 MIN' : '10 MIN'),
        price: finalPrice,
        paymentMethod: paymentMethod || 'Pix',
        vehicleType: vehicleType || 'car',
        status: 'requested', // requested -> accepted -> arrived -> in_progress -> completed | cancelled
        rated: false,
        createdAt: new Date().toISOString()
      };

      await db.saveRide(newRide);

      // WebSockets & Push Notifications instant dispatch
      broadcastToDrivers(newRide.city, 'ride:created', { ride: newRide });
      sendPushNotification({
        role: 'driver',
        city: newRide.city,
        title: '🚗 Nova corrida disponível!',
        body: `${newRide.origin} ➔ ${newRide.destination} • R$ ${Number(newRide.price).toFixed(2).replace('.', ',')}`,
        data: { type: 'new_ride', rideId: newRide.id, city: newRide.city }
      }).catch(() => {});

      return sendJSON(res, 201, { success: true, ride: newRide });
    }

    // Get single ride details
    const singleRideMatch = pathname.match(/^\/api\/rides\/([^\/]+)$/);
    if (singleRideMatch && method === 'GET') {
      const rideId = singleRideMatch[1];
      const rides = readDB('rides.json');
      checkAndExpireRides(rides);
      const ride = rides.find(r => r.id === rideId);
      if (!ride) return sendJSON(res, 404, { success: false, message: 'Corrida não encontrada' });

      const enrichedRide = { ...ride };
      const usersList = readDB('users.json');
      if (!enrichedRide.passengerAvatar) {
        const u = usersList.find(usr => usr.id === enrichedRide.passengerId || (enrichedRide.passengerName && usr.name === enrichedRide.passengerName));
        enrichedRide.passengerAvatar = (u && u.avatar) || null;
      }
      if (enrichedRide.driverId && !enrichedRide.driverAvatar) {
        const d = usersList.find(usr => usr.id === enrichedRide.driverId || (enrichedRide.driverName && usr.name === enrichedRide.driverName));
        enrichedRide.driverAvatar = (d && d.avatar) || null;
      }

      return sendJSON(res, 200, { success: true, ride: enrichedRide });
    }

    // Accept Ride (Driver)
    const acceptMatch = pathname.match(/^\/api\/rides\/([^\/]+)\/accept$/);
    if (acceptMatch && method === 'PUT') {
      const rideId = acceptMatch[1];
      const body = await parseBody(req);
      const { driverId, driverName, vehicle, driverRating } = body;

      const rides = await db.getRides();
      checkAndExpireRides(rides);
      const ride = rides.find(r => r.id === rideId);
      if (!ride) return sendJSON(res, 404, { success: false, message: 'Corrida não encontrada' });

      if (ride.status === 'expired') {
        return sendJSON(res, 400, {
          success: false,
          message: 'Esta corrida expirou após 15 minutos sem aceite. O passageiro precisa solicitar uma nova corrida.'
        });
      }

      if (ride.status !== 'requested') {
        return sendJSON(res, 400, { success: false, message: 'Esta corrida já foi aceita por outro motorista' });
      }

      const targetDriverId = driverId || 'usr-drv-1';
      const targetDriverName = driverName || 'MARCOS MARQUES';

      if (ride.passengerId && ride.passengerId === targetDriverId) {
        return sendJSON(res, 400, {
          success: false,
          message: 'Você não pode aceitar a sua própria corrida!'
        });
      }

      // Ensure driver is approved by admin
      const users = await db.getUsers();
      const driverUser = users.find(u => u.id === targetDriverId);

      // Enforce strict vehicle category match (Car driver cannot accept Moto ride & vice-versa)
      const driverVehicleType = (driverUser && driverUser.vehicle && driverUser.vehicle.type) || (vehicle && vehicle.type) || 'car';
      const isMotoDriver = driverVehicleType === 'moto';
      const isMotoRide = ride.vehicleType === 'moto';

      if (isMotoRide && !isMotoDriver) {
        return sendJSON(res, 403, {
          success: false,
          message: 'Seu cadastro é para CARRO COMUM. Você não pode aceitar corridas de MOTO TÁXI.'
        });
      }
      if (!isMotoRide && isMotoDriver) {
        return sendJSON(res, 403, {
          success: false,
          message: 'Seu cadastro é para MOTO TÁXI. Você não pode aceitar corridas de CARRO COMUM.'
        });
      }
      if (driverUser && !driverUser.isAdmin && driverUser.role !== 'admin') {
        const isApproved = driverUser.driverApproved === true || driverUser.approved === true || driverUser.role === 'driver';
        if (!isApproved) {
          return sendJSON(res, 403, {
            success: false,
            message: 'Sua conta de motorista está pendente de aprovação pela administração. Complete seu cadastro no Perfil.'
          });
        }
      }

      if (driverUser) {
        const isBlocked = driverUser.paymentBlocked === true || isPaymentExpired(driverUser.paidUntil, driverUser.weeklyPaymentStatus);
        if (isBlocked) {
          driverUser.weeklyPaymentStatus = driverUser.paymentBlocked ? 'BLOQUEADO' : 'PENDENTE';
          writeDB('users.json', users);
          const feeStr = driverUser.vehicle?.type === 'moto' ? '50,00' : '100,00';
          return sendJSON(res, 403, {
            success: false,
            message: `Acesso bloqueado por falta de pagamento semanal (R$ ${feeStr}). Toda semana inicia na segunda-feira e expira no domingo. Efetue o pagamento via Pix para aceitar corridas.`,
            paymentBlocked: true
          });
        }
      }

      // Ensure driver or motoboy can only take 1 ride at a time
      const driverActiveRide = rides.find(r =>
        r.id !== rideId &&
        r.driverId &&
        (r.driverId === targetDriverId || (driverName && r.driverName === driverName)) &&
        (r.status === 'accepted' || r.status === 'arrived' || r.status === 'in_progress')
      );

      if (driverActiveRide) {
        return sendJSON(res, 400, {
          success: false,
          message: 'Você já possui uma corrida em andamento! Finalize a corrida atual antes de pegar outra.'
        });
      }

      const driverAvatar = body.driverAvatar || (driverUser && driverUser.avatar) || null;

      ride.driverId = targetDriverId;
      ride.driverName = targetDriverName;
      ride.driverAvatar = driverAvatar;
      ride.driverRating = driverRating || 4.9;
      ride.driverRatingCount = 1200;
      ride.vehicle = vehicle || {
        type: ride.vehicleType || 'car',
        model: 'ONIX PRETO',
        plate: 'ABC-1234',
        color: 'Preto',
        year: '2022'
      };
      ride.status = 'accepted';
      ride.acceptedAt = new Date().toISOString();

      writeDB('rides.json', rides);

      // WebSockets & Push Notifications instant dispatch
      broadcastToUser(ride.passengerId, 'ride:accepted', { ride });
      broadcastToDrivers(ride.city, 'ride:updated', { ride });
      sendPushNotification({
        userIds: [ride.passengerId],
        title: '✅ Motorista a caminho!',
        body: `${ride.driverName} aceitou sua corrida e está se deslocando!`,
        data: { type: 'ride_accepted', rideId: ride.id }
      }).catch(() => {});

      return sendJSON(res, 200, { success: true, ride });
    }

    // Status update (Driver arrived, in progress, finished, cancelled)
    const statusMatch = pathname.match(/^\/api\/rides\/([^\/]+)\/status$/);
    if (statusMatch && method === 'PUT') {
      const rideId = statusMatch[1];
      const body = await parseBody(req);
      const { status } = body;

      const rides = readDB('rides.json');
      const ride = rides.find(r => r.id === rideId);
      if (!ride) return sendJSON(res, 404, { success: false, message: 'Corrida não encontrada' });

      ride.status = status;
      if (status === 'completed') {
        ride.completedAt = new Date().toISOString();

        // Increment driver total rides
        if (ride.driverId) {
          const users = readDB('users.json');
          const drv = users.find(u => u.id === ride.driverId);
          if (drv) {
            drv.totalRides = (drv.totalRides || 0) + 1;
            writeDB('users.json', users);
          }
        }
      } else if (status === 'cancelled') {
        ride.cancelledAt = new Date().toISOString();
        if (body.cancellationReason) {
          ride.cancellationReason = body.cancellationReason;
        }
        if (body.cancelledBy) {
          ride.cancelledBy = body.cancelledBy;
        }
      } else if (status === 'expired') {
        ride.expiredAt = new Date().toISOString();
        ride.cancellationReason = body.cancellationReason || 'Tempo limite de 15 minutos atingido sem aceite de motorista';
        ride.cancelledBy = body.cancelledBy || 'system';
      }

      writeDB('rides.json', rides);

      // WebSockets & Push Notifications instant dispatch
      broadcastToRide(ride.id, 'ride:status_changed', { ride });
      if (status === 'arrived') {
        sendPushNotification({
          userIds: [ride.passengerId],
          title: '📍 Motorista chegou!',
          body: 'Seu motorista chegou ao local de embarque.',
          data: { type: 'driver_arrived', rideId: ride.id }
        }).catch(() => {});
      }

      return sendJSON(res, 200, { success: true, ride });
    }

    // Direct Cancel Ride endpoint
    const cancelMatch = pathname.match(/^\/api\/rides\/([^\/]+)\/cancel$/);
    if (cancelMatch && (method === 'POST' || method === 'PUT')) {
      const rideId = cancelMatch[1];
      const body = await parseBody(req);
      const rides = readDB('rides.json');
      const ride = rides.find(r => r.id === rideId);
      if (!ride) return sendJSON(res, 404, { success: false, message: 'Corrida não encontrada' });

      ride.status = 'cancelled';
      ride.cancelledAt = new Date().toISOString();
      ride.cancellationReason = body.cancellationReason || body.reason || 'Cancelado';
      ride.cancelledBy = body.cancelledBy || 'system';

      writeDB('rides.json', rides);

      // WebSockets & Push Notifications instant dispatch
      broadcastToRide(ride.id, 'ride:cancelled', { ride, reason: ride.cancellationReason, cancelledBy: ride.cancelledBy });
      broadcastToDrivers(ride.city, 'ride:updated', { ride });
      const cancelTargetId = (ride.cancelledBy === 'driver') ? ride.passengerId : ride.driverId;
      if (cancelTargetId) {
        sendPushNotification({
          userIds: [cancelTargetId],
          title: '⚠️ Corrida cancelada',
          body: `A corrida foi cancelada (${ride.cancellationReason})`,
          data: { type: 'ride_cancelled', rideId: ride.id }
        }).catch(() => {});
      }

      return sendJSON(res, 200, { success: true, ride });
    }

    // Finish Ride endpoint (Driver finishes ride)
    const finishMatch = pathname.match(/^\/api\/rides\/([^\/]+)\/finish$/);
    if (finishMatch && method === 'PUT') {
      const rideId = finishMatch[1];
      const body = await parseBody(req);

      const ride = await db.getRideById(rideId);
      if (!ride) return sendJSON(res, 404, { success: false, message: 'Corrida não encontrada' });

      ride.status = 'completed';
      ride.completedAt = new Date().toISOString();

      if (body.fare) {
        ride.finalFare = Number(body.fare);
      }

      if (ride.driverId) {
        const drv = await db.getUserById(ride.driverId);
        if (drv) {
          drv.totalRides = (drv.totalRides || 0) + 1;
          await db.saveUser(drv);
        }
      }

      await db.saveRide(ride);

      // WebSockets & Push Notifications instant dispatch
      broadcastToRide(ride.id, 'ride:finished', { ride });
      sendPushNotification({
        userIds: [ride.passengerId],
        title: '🏁 Corrida finalizada!',
        body: 'Obrigado por viajar com a MAX DRIVE. Avalie sua viagem no aplicativo!',
        data: { type: 'ride_finished', rideId: ride.id }
      }).catch(() => {});

      return sendJSON(res, 200, { success: true, ride, message: 'Corrida finalizada com sucesso!' });
    }

    // Rating (Passenger or Driver rates)
    const rateMatch = pathname.match(/^\/api\/rides\/([^\/]+)\/rating$/);
    if (rateMatch && method === 'POST') {
      const rideId = rateMatch[1];
      const body = await parseBody(req);
      const { stars, feedback, ratedBy } = body;

      const ride = await db.getRideById(rideId);
      if (!ride) return sendJSON(res, 404, { success: false, message: 'Corrida não encontrada' });

      const numStars = Math.max(1, Math.min(5, Number(stars) || 5));

      if (ratedBy === 'driver') {
        ride.ratedByDriver = true;
        ride.driverRatingGiven = numStars;
        ride.driverFeedback = feedback || '';

        if (ride.passengerId) {
          const pass = await db.getUserById(ride.passengerId);
          if (pass) {
            const count = Number(pass.ratingCount) || 0;
            if (count === 0 || !pass.rating) {
              pass.rating = numStars;
              pass.ratingCount = 1;
            } else {
              const currentAvg = Number(pass.rating);
              const newAvg = ((currentAvg * count) + numStars) / (count + 1);
              pass.rating = parseFloat(newAvg.toFixed(1));
              pass.ratingCount = count + 1;
            }
            await db.saveUser(pass);
            ride.passengerRating = pass.rating;
          }
        }
      } else {
        ride.ratedByPassenger = true;
        ride.passengerRatingGiven = numStars;
        ride.passengerFeedback = feedback || '';

        const targetDrvId = ride.driverId;
        if (targetDrvId) {
          const drv = await db.getUserById(targetDrvId);
          if (drv) {
            const count = Number(drv.ratingCount) || 0;
            if (count === 0 || !drv.rating) {
              drv.rating = numStars;
              drv.ratingCount = 1;
            } else {
              const currentAvg = Number(drv.rating);
              const newAvg = ((currentAvg * count) + numStars) / (count + 1);
              drv.rating = parseFloat(newAvg.toFixed(1));
              drv.ratingCount = count + 1;
            }
            await db.saveUser(drv);
            ride.driverRating = drv.rating;
          }
        }
      }

      ride.rated = true;
      ride.rating = numStars;
      ride.feedback = feedback || '';

      await db.saveRide(ride);
      return sendJSON(res, 200, { success: true, ride, message: 'Avaliação enviada com sucesso!' });
    }

    // 7. Chat messages
    const chatMatch = pathname.match(/^\/api\/rides\/([^\/]+)\/chat$/);
    if (chatMatch && method === 'GET') {
      const rideId = chatMatch[1];
      const allMsgs = readDB('messages.json');
      const rideMsgs = allMsgs.filter(m => m.rideId === rideId);
      return sendJSON(res, 200, { success: true, messages: rideMsgs });
    }

    if (chatMatch && method === 'POST') {
      const rideId = chatMatch[1];
      const body = await parseBody(req);
      const { senderId, senderRole, senderName, text } = body;

      if (!text || !text.trim()) {
        return sendJSON(res, 400, { success: false, message: 'Mensagem vazia' });
      }

      const allMsgs = readDB('messages.json');
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newMsg = {
        id: 'msg-' + Date.now(),
        rideId: rideId,
        senderId: senderId || 'usr-anon',
        senderRole: senderRole || 'passenger',
        senderName: senderName || 'Usuário',
        text: text.trim(),
        timestamp: timeStr
      };

      allMsgs.push(newMsg);
      writeDB('messages.json', allMsgs);

      // WebSockets & Push Notifications instant dispatch
      broadcastToRide(rideId, 'chat:message', { message: newMsg, rideId });
      const targetRide = (readDB('rides.json') || []).find(r => r.id === rideId);
      if (targetRide) {
        const recipientUserId = (newMsg.senderRole === 'driver') ? targetRide.passengerId : targetRide.driverId;
        if (recipientUserId) {
          sendPushNotification({
            userIds: [recipientUserId],
            title: `💬 Mensagem de ${newMsg.senderName}`,
            body: newMsg.text,
            data: { type: 'chat_message', rideId: targetRide.id }
          }).catch(() => {});
        }
      }

      return sendJSON(res, 201, { success: true, message: newMsg });
    }

    // 7b. Admin Direct Messages & Support (Admin <-> Driver / Passenger)
    if (pathname === '/api/admin-messages' && method === 'GET') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      const queryUserId = parsedUrl.query && parsedUrl.query.userId;
      const targetUserId = queryUserId || req.headers['x-user-id'];

      if (isAdminReq) {
        if (queryUserId) {
          // Messages for a specific user
          const conv = await db.getAdminMessages(queryUserId);
          return sendJSON(res, 200, { success: true, messages: conv });
        }
        // Return all messages plus grouped conversation summaries
        const allMsgs = await db.getAllAdminMessages();
        const convMap = new Map();
        allMsgs.forEach(m => {
          const otherId = m.senderRole === 'admin' ? m.recipientId : m.senderId;
          const otherName = m.senderRole === 'admin' ? m.recipientName : m.senderName;
          const otherRole = m.senderRole === 'admin' ? m.recipientRole : m.senderRole;
          if (!convMap.has(otherId)) {
            convMap.set(otherId, {
              userId: otherId,
              userName: otherName,
              userRole: otherRole,
              lastMessage: m.text,
              lastTimestamp: m.timestamp,
              lastCreatedAt: m.createdAt,
              unreadCount: (m.recipientRole === 'admin' && !m.read) ? 1 : 0
            });
          } else {
            const entry = convMap.get(otherId);
            entry.lastMessage = m.text;
            entry.lastTimestamp = m.timestamp;
            entry.lastCreatedAt = m.createdAt;
            if (m.recipientRole === 'admin' && !m.read) entry.unreadCount++;
          }
        });
        const conversations = Array.from(convMap.values()).sort((a, b) => new Date(b.lastCreatedAt || 0) - new Date(a.lastCreatedAt || 0));
        return sendJSON(res, 200, { success: true, messages: allMsgs, conversations });
      }

      // Normal user (Driver or Passenger)
      if (!targetUserId) {
        return sendJSON(res, 400, { success: false, message: 'userId é obrigatório' });
      }
      const userMsgs = await db.getAdminMessages(targetUserId);
      return sendJSON(res, 200, { success: true, messages: userMsgs });
    }

    // Delete Admin Messages
    const deleteUserMsgsMatch = pathname.match(/^\/api\/admin-messages\/user\/([^\/]+)$/);
    if (deleteUserMsgsMatch && method === 'DELETE') {
      const targetId = deleteUserMsgsMatch[1];
      await db.deleteAdminMessagesForUser(targetId);
      return sendJSON(res, 200, { success: true, message: 'Conversa removida do banco de dados!' });
    }

    const deleteMsgMatch = pathname.match(/^\/api\/admin-messages\/([^\/]+)$/);
    if (deleteMsgMatch && method === 'DELETE') {
      const msgId = deleteMsgMatch[1];
      await db.deleteAdminMessage(msgId);
      return sendJSON(res, 200, { success: true, message: 'Mensagem removida do banco de dados!' });
    }

    if (pathname === '/api/admin-messages' && method === 'POST') {
      const body = await parseBody(req);
      const { senderId, senderRole, senderName, recipientId, recipientRole, recipientName, text } = body;

      if (!text || !text.trim()) {
        return sendJSON(res, 400, { success: false, message: 'Texto da mensagem é obrigatório' });
      }

      const allMsgs = readDB('admin_messages.json') || [];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newMsg = {
        id: 'admsg-' + Date.now(),
        senderId: senderId || 'usr-anon',
        senderRole: senderRole || 'passenger',
        senderName: senderName || 'Usuário',
        recipientId: recipientId || 'admin-master',
        recipientRole: recipientRole || 'admin',
        recipientName: recipientName || 'Diretoria MAX DRIVE',
        text: text.trim(),
        read: false,
        timestamp: timeStr,
        createdAt: now.toISOString()
      };

      allMsgs.push(newMsg);
      writeDB('admin_messages.json', allMsgs);

      // WebSockets & Push Notifications instant dispatch
      broadcastToUser(newMsg.recipientId, 'admin:message', { message: newMsg });
      sendPushNotification({
        userIds: [newMsg.recipientId],
        title: '💬 Suporte MAX DRIVE',
        body: newMsg.text,
        data: { type: 'admin_message' }
      }).catch(() => {});

      return sendJSON(res, 201, { success: true, message: newMsg });
    }

    if (pathname === '/api/admin-messages/read' && method === 'PUT') {
      const body = await parseBody(req);
      const { userId, readerRole } = body;

      if (!userId) {
        return sendJSON(res, 400, { success: false, message: 'userId é obrigatório' });
      }

      let allMsgs = readDB('admin_messages.json') || [];
      let updatedCount = 0;

      allMsgs = allMsgs.map(m => {
        if (readerRole === 'admin') {
          // Admin reading messages sent from user
          if (m.senderId === userId && m.recipientRole === 'admin' && !m.read) {
            updatedCount++;
            return { ...m, read: true };
          }
        } else {
          // User reading messages sent by admin
          if (m.recipientId === userId && m.senderRole === 'admin' && !m.read) {
            updatedCount++;
            return { ...m, read: true };
          }
        }
        return m;
      });

      if (updatedCount > 0) {
        writeDB('admin_messages.json', allMsgs);
      }

      return sendJSON(res, 200, { success: true, updatedCount });
    }

    if (pathname === '/api/admin-messages/unread-count' && method === 'GET') {
      const allMsgs = readDB('admin_messages.json') || [];
      const role = parsedUrl.query && parsedUrl.query.role;
      const userId = parsedUrl.query && parsedUrl.query.userId;

      if (role === 'admin') {
        const unread = allMsgs.filter(m => m.recipientRole === 'admin' && !m.read);
        const latestMsg = unread.length > 0 ? unread[unread.length - 1] : (allMsgs.length > 0 ? allMsgs[allMsgs.length - 1] : null);
        return sendJSON(res, 200, {
          success: true,
          unreadCount: unread.length,
          latestMessage: latestMsg,
          latest: latestMsg
        });
      }

      if (userId) {
        const userConv = allMsgs.filter(m => m.recipientId === userId || m.senderId === userId);
        const unread = allMsgs.filter(m => m.recipientId === userId && m.senderRole === 'admin' && !m.read);
        const latestMsg = userConv.length > 0 ? userConv[userConv.length - 1] : null;
        return sendJSON(res, 200, {
          success: true,
          unreadCount: unread.length,
          latestMessage: latestMsg,
          latest: latestMsg
        });
      }

      return sendJSON(res, 200, { success: true, unreadCount: 0, latestMessage: null, latest: null });
    }

    // 8. Reports: List, Submit, Respond, Delete
    if (pathname === '/api/reports' && method === 'GET') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      const reports = await db.getReports();
      if (isAdminReq) {
        return sendJSON(res, 200, { success: true, reports });
      }
      const userId = req.headers['x-user-id'] || (parsedUrl.query && (parsedUrl.query.userId || parsedUrl.query.reporterId));
      const userRole = req.headers['x-user-role'] || (parsedUrl.query && (parsedUrl.query.role || parsedUrl.query.reporterRole));
      const userName = parsedUrl.query && parsedUrl.query.reporterName;

      const filtered = reports.filter(r => {
        if (!r) return false;
        if (userId && r.reporterId && String(r.reporterId) === String(userId)) return true;
        if (userEmail && r.reporterEmail && String(r.reporterEmail).toLowerCase() === String(userEmail).toLowerCase()) return true;
        if (userName && r.reporterName && String(r.reporterName).toLowerCase() === String(userName).toLowerCase()) return true;
        if (userRole && r.reporterRole && String(r.reporterRole).toLowerCase() === String(userRole).toLowerCase() && !userId) return true;
        return false;
      });
      return sendJSON(res, 200, { success: true, reports: filtered });
    }

    if (pathname === '/api/reports' && method === 'POST') {
      const body = await parseBody(req);
      const { reporterId, reporterName, reporterRole, targetName, rideId, category, reason } = body;

      if (!reason || !reason.trim()) {
        return sendJSON(res, 400, { success: false, message: 'Descreva o motivo do reporte' });
      }

      const newReport = {
        id: 'rep-' + Date.now(),
        reporterId: reporterId || 'usr-unknown',
        reporterName: reporterName || 'Usuário',
        reporterRole: reporterRole || 'passenger',
        targetName: targetName || 'Diretoria / Suporte',
        category: category || (rideId ? 'Incidente em Corrida' : 'Mensagem à Diretoria'),
        rideId: rideId || '',
        reason: reason.trim(),
        status: 'Pendente',
        adminResponse: '',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null
      };

      await db.saveReport(newReport);
      return sendJSON(res, 201, { success: true, report: newReport, message: 'Reporte registrado com sucesso!' });
    }

    const reportRespondMatch = pathname.match(/^\/api\/reports\/([^\/]+)\/respond$/);
    if (reportRespondMatch && method === 'PUT') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores' });
      }

      const reportId = reportRespondMatch[1];
      const body = await parseBody(req);
      const reports = await db.getReports();
      const rep = reports.find(r => r.id === reportId);
      if (!rep) return sendJSON(res, 404, { success: false, message: 'Reporte não encontrado' });

      rep.status = body.status || 'Resolvido';
      rep.adminResponse = body.response || 'Reporte analisado e resolvido pela equipe MAX DRIVE.';
      rep.resolvedAt = new Date().toISOString();
      rep.resolvedBy = userEmail || 'admin@maxdrive.com';

      await db.saveReport(rep);
      return sendJSON(res, 200, { success: true, report: rep, message: 'Resposta registrada com sucesso!' });
    }

    const deleteReportMatch = pathname.match(/^\/api\/(?:admin\/)?reports\/([^\/]+)$/);
    if (deleteReportMatch && method === 'DELETE') {
      const reportId = deleteReportMatch[1];
      await db.deleteReport(reportId);
      return sendJSON(res, 200, { success: true, message: 'Reporte removido do banco de dados!' });
    }

    // 9. Driver Payment Status (Frontend Driver App)
    if (pathname === '/api/payments/my-status' && method === 'GET') {
      const userId = req.headers['x-user-id'] || parsedUrl.query.driverId || 'usr-drv-1';
      const users = readDB('users.json');
      const drv = users.find(u => u.id === userId || (u.role === 'driver' && !userId)) || users.find(u => u.role === 'driver');
      const cycle = getCurrentWeekCycle();

      if (!drv) {
        return sendJSON(res, 200, {
          success: true,
          status: 'REGULAR',
          statusText: 'REGULAR - ATÉ DIA - ' + cycle.sundayStr,
          weeklyAmount: 100.00,
          vehicleType: 'car',
          cycle
        });
      }

      const isMoto = drv.vehicle && drv.vehicle.type === 'moto';
      const weeklyAmount = isMoto ? 50.00 : 100.00;
      const isExpired = drv.paymentBlocked === true || isPaymentExpired(drv.paidUntil, drv.weeklyPaymentStatus);
      const status = drv.paymentBlocked ? 'BLOQUEADO' : (isExpired ? 'PENDENTE' : (drv.weeklyPaymentStatus || 'REGULAR'));

      let statusText = '';
      if (status === 'REGULAR' || status === 'PASSE_GRATIS') {
        const untilDate = drv.paidUntil ? new Date(drv.paidUntil) : cycle.sunday;
        const pad = n => String(n).padStart(2, '0');
        const formattedUntil = `${pad(untilDate.getDate())}/${pad(untilDate.getMonth() + 1)}/${untilDate.getFullYear()}`;
        statusText = (status === 'PASSE_GRATIS' ? '1 SEMANA GRÁTIS' : 'REGULAR') + ' - ATÉ DIA - ' + formattedUntil;
      } else if (status === 'BLOQUEADO') {
        statusText = 'BLOQUEADO - FALTA DE PAGAMENTO';
      } else {
        statusText = 'PENDENTE - VENCEU DIA ' + cycle.sundayStr;
      }

      return sendJSON(res, 200, {
        success: true,
        driverId: drv.id,
        driverName: drv.name,
        vehicleType: isMoto ? 'moto' : 'car',
        weeklyAmount,
        status,
        statusText,
        isBlocked: drv.paymentBlocked === true || isExpired,
        paidUntil: drv.paidUntil,
        cycle
      });
    }

    // 9b. Financial Management (Admin Panel)
    if (pathname === '/api/payments' && method === 'GET') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores' });
      }

      const users = readDB('users.json');
      const payments = readDB('payments.json');
      const drivers = users.filter(u => u.role === 'driver');
      const cycle = getCurrentWeekCycle();

      // Ensure drivers have synced weekly payment status
      drivers.forEach(drv => {
        if (!drv.paidUntil && !drv.paymentBlocked) {
          drv.paidUntil = cycle.sundayISO;
          drv.weeklyPaymentStatus = 'REGULAR';
        } else {
          const isExpired = isPaymentExpired(drv.paidUntil, drv.weeklyPaymentStatus);
          if (drv.paymentBlocked) {
            drv.weeklyPaymentStatus = 'BLOQUEADO';
          } else if (isExpired && drv.weeklyPaymentStatus !== 'PENDENTE') {
            drv.weeklyPaymentStatus = 'PENDENTE';
          }
        }
      });
      writeDB('users.json', users);

      // Financial stats calculation
      let totalRevenue = 0;
      let totalPaidDrivers = 0;
      let totalMotoPaid = 0;
      let totalCarPaid = 0;
      let totalFreePass = 0;
      let totalPending = 0;

      drivers.forEach(drv => {
        const isMoto = drv.vehicle && drv.vehicle.type === 'moto';
        const st = drv.weeklyPaymentStatus || 'REGULAR';
        if (st === 'REGULAR') {
          totalPaidDrivers++;
          if (isMoto) {
            totalMotoPaid++;
            totalRevenue += 50.00;
          } else {
            totalCarPaid++;
            totalRevenue += 100.00;
          }
        } else if (st === 'PASSE_GRATIS') {
          totalPaidDrivers++;
          totalFreePass++;
        } else {
          totalPending++;
        }
      });

      return sendJSON(res, 200, {
        success: true,
        payments,
        drivers,
        stats: {
          totalRevenue,
          totalPaidDrivers,
          totalMotoPaid,
          totalCarPaid,
          totalFreePass,
          totalPending
        },
        currentCycle: cycle
      });
    }

    // 9c. Confirm Weekly Payment (Debita/Arrecada no Financeiro)
    if (pathname === '/api/payments/confirm' && method === 'POST') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores' });
      }

      const body = await parseBody(req);
      const { driverId, receiptUrl, notes } = body;
      const users = readDB('users.json');
      const drv = users.find(u => u.id === driverId);
      if (!drv) return sendJSON(res, 404, { success: false, message: 'Motorista não encontrado' });

      const isMoto = drv.vehicle && drv.vehicle.type === 'moto';
      const amount = Number(body.amount) || (isMoto ? 50.00 : 100.00);
      const cycle = getCurrentWeekCycle();

      // If current paidUntil is already in the future (this week), extend to next Sunday
      let targetSunday = cycle.sunday;
      if (drv.paidUntil && new Date(drv.paidUntil) > new Date()) {
        const existingSunday = new Date(drv.paidUntil);
        const nextSunday = new Date(existingSunday);
        nextSunday.setDate(existingSunday.getDate() + 7);
        nextSunday.setHours(23, 59, 59, 999);
        targetSunday = nextSunday;
      }

      const pad = n => String(n).padStart(2, '0');
      const targetSundayStr = `${pad(targetSunday.getDate())}/${pad(targetSunday.getMonth() + 1)}/${targetSunday.getFullYear()}`;
      const adminWhoApproved = userEmail || 'admin@maxdrive.com';
      const approvedAt = new Date().toISOString();

      drv.weeklyPaymentStatus = 'REGULAR';
      drv.paidUntil = targetSunday.toISOString();
      drv.paymentBlocked = false;
      drv.lastApprovedBy = adminWhoApproved;
      drv.lastApprovedAt = approvedAt;
      if (receiptUrl) drv.latestReceiptUrl = receiptUrl;
      writeDB('users.json', users);

      const payments = readDB('payments.json');
      const newPayRecord = {
        id: 'pay-' + Date.now(),
        driverId: drv.id,
        driverName: drv.name,
        driverPhone: drv.phone,
        vehicleType: isMoto ? 'moto' : 'car',
        amount: amount,
        weekStartDate: cycle.mondayStr,
        weekEndDate: targetSundayStr,
        paidUntil: targetSunday.toISOString(),
        status: 'REGULAR',
        paymentMethod: 'PIX',
        receiptUrl: receiptUrl || drv.latestReceiptUrl || null,
        notes: notes || 'Pagamento semanal aprovado via Pix',
        approvedBy: adminWhoApproved,
        approvedAt: approvedAt
      };
      payments.unshift(newPayRecord);
      writeDB('payments.json', payments);

      return sendJSON(res, 200, {
        success: true,
        message: `Pagamento de R$ ${amount.toFixed(2).replace('.', ',')} aprovado para ${drv.name}! Válido até ${targetSundayStr}.`,
        payment: newPayRecord,
        driver: drv
      });
    }

    // 9d. Grant 1 Week Free Pass (Passe Cortesia)
    if (pathname === '/api/payments/free-pass' && method === 'POST') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores' });
      }

      const body = await parseBody(req);
      const { driverId, notes } = body;
      const users = readDB('users.json');
      const drv = users.find(u => u.id === driverId);
      if (!drv) return sendJSON(res, 404, { success: false, message: 'Motorista não encontrado' });

      const cycle = getCurrentWeekCycle();
      let targetSunday = cycle.sunday;
      if (drv.paidUntil && new Date(drv.paidUntil) > new Date()) {
        const existingSunday = new Date(drv.paidUntil);
        const nextSunday = new Date(existingSunday);
        nextSunday.setDate(existingSunday.getDate() + 7);
        nextSunday.setHours(23, 59, 59, 999);
        targetSunday = nextSunday;
      }

      const pad = n => String(n).padStart(2, '0');
      const targetSundayStr = `${pad(targetSunday.getDate())}/${pad(targetSunday.getMonth() + 1)}/${targetSunday.getFullYear()}`;
      const adminWhoApproved = userEmail || 'admin@maxdrive.com';
      const approvedAt = new Date().toISOString();

      drv.weeklyPaymentStatus = 'PASSE_GRATIS';
      drv.paidUntil = targetSunday.toISOString();
      drv.paymentBlocked = false;
      drv.lastApprovedBy = adminWhoApproved;
      drv.lastApprovedAt = approvedAt;
      writeDB('users.json', users);

      const payments = readDB('payments.json');
      const newPayRecord = {
        id: 'pay-free-' + Date.now(),
        driverId: drv.id,
        driverName: drv.name,
        driverPhone: drv.phone,
        vehicleType: drv.vehicle?.type === 'moto' ? 'moto' : 'car',
        amount: 0.00,
        weekStartDate: cycle.mondayStr,
        weekEndDate: targetSundayStr,
        paidUntil: targetSunday.toISOString(),
        status: 'PASSE_GRATIS',
        paymentMethod: 'CORTESIA_ADMIN',
        receiptUrl: null,
        notes: notes || '1 Semana Grátis concedida pela diretoria',
        approvedBy: adminWhoApproved,
        approvedAt: approvedAt
      };
      payments.unshift(newPayRecord);
      writeDB('payments.json', payments);

      return sendJSON(res, 200, {
        success: true,
        message: `1 Semana de passe livre concedida com sucesso para ${drv.name}! Válido até ${targetSundayStr}.`,
        payment: newPayRecord,
        driver: drv
      });
    }

    // 9e. Block Driver by Payment
    const paymentBlockMatch = pathname.match(/^\/api\/payments\/([^\/]+)\/block$/);
    if (paymentBlockMatch && method === 'PUT') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq) return sendJSON(res, 403, { success: false, message: 'Acesso negado' });

      const driverId = paymentBlockMatch[1];
      const users = readDB('users.json');
      const drv = users.find(u => u.id === driverId);
      if (!drv) return sendJSON(res, 404, { success: false, message: 'Motorista não encontrado' });

      drv.paymentBlocked = true;
      drv.weeklyPaymentStatus = 'BLOQUEADO';
      writeDB('users.json', users);

      return sendJSON(res, 200, { success: true, message: `Motorista ${drv.name} bloqueado por falta de pagamento!` });
    }

    // 9f. Unblock Driver
    const paymentUnblockMatch = pathname.match(/^\/api\/payments\/([^\/]+)\/unblock$/);
    if (paymentUnblockMatch && method === 'PUT') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq) return sendJSON(res, 403, { success: false, message: 'Acesso negado' });

      const driverId = paymentUnblockMatch[1];
      const users = readDB('users.json');
      const drv = users.find(u => u.id === driverId);
      if (!drv) return sendJSON(res, 404, { success: false, message: 'Motorista não encontrado' });

      drv.paymentBlocked = false;
      const isExpired = isPaymentExpired(drv.paidUntil, drv.weeklyPaymentStatus);
      drv.weeklyPaymentStatus = isExpired ? 'PENDENTE' : 'REGULAR';
      writeDB('users.json', users);

      return sendJSON(res, 200, { success: true, message: `Acesso do motorista ${drv.name} liberado!` });
    }

    // 9g. Attach Audit Receipt
    if (pathname === '/api/payments/audit-receipt' && method === 'POST') {
      const body = await parseBody(req);
      const { driverId, paymentId, receiptUrl } = body;
      const users = readDB('users.json');
      const drv = users.find(u => u.id === driverId);
      if (drv) {
        drv.latestReceiptUrl = receiptUrl;
        writeDB('users.json', users);
      }
      if (paymentId) {
        const payments = readDB('payments.json');
        const pay = payments.find(p => p.id === paymentId);
        if (pay) {
          pay.receiptUrl = receiptUrl;
          writeDB('payments.json', payments);
        }
      }
      return sendJSON(res, 200, { success: true, message: 'Comprovante registrado para auditoria!' });
    }

    // 10. Admin Endpoints: Users List, Ban/Unban, Driver Approve, Delete, Make Admin, Payments
    if (pathname === '/api/admin/users' && method === 'GET') {
      const users = await db.getUsers();
      return sendJSON(res, 200, { success: true, users });
    }

    if (pathname === '/api/admin/payments' && method === 'GET') {
      const payments = await db.getPayments();
      return sendJSON(res, 200, { success: true, payments });
    }

    const deleteAdminUserMatch = pathname.match(/^\/api\/admin\/users\/([^\/]+)$/);
    if (deleteAdminUserMatch && method === 'DELETE') {
      const userId = deleteAdminUserMatch[1];
      await db.deleteUser(userId);
      await db.deleteAdminMessagesForUser(userId);
      return sendJSON(res, 200, { success: true, message: 'Conta removida com sucesso do banco de dados!' });
    }

    const makeAdminMatch = pathname.match(/^\/api\/admin\/users\/([^\/]+)\/make-admin$/);
    if (makeAdminMatch && method === 'PUT') {
      const userId = makeAdminMatch[1];
      const users = await db.getUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return sendJSON(res, 404, { success: false, message: 'Usuário não encontrado' });

      user.isAdmin = true;
      user.role = 'admin';
      await db.saveUser(user);
      return sendJSON(res, 200, { success: true, user, message: 'Privilégios de Administrador concedidos com sucesso!' });
    }

    const banMatch = pathname.match(/^\/api\/admin\/users\/([^\/]+)\/ban$/);
    if (banMatch && method === 'PUT') {
      const userId = banMatch[1];
      const body = await parseBody(req);
      const users = await db.getUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return sendJSON(res, 404, { success: false, message: 'Usuário não encontrado' });

      if (body.ban === false || body.action === 'unban' || (body.ban === undefined && body.action === undefined && user.status === 'banned')) {
        user.status = 'active';
        user.banReason = '';
      } else {
        user.status = 'banned';
        user.banReason = body.reason || 'Violação dos termos de uso da plataforma MAX DRIVE';
      }

      await db.saveUser(user);
      return sendJSON(res, 200, { success: true, user, message: user.status === 'banned' ? 'Usuário banido com sucesso' : 'Usuário desbanido com sucesso' });
    }

    const approveMatch = pathname.match(/^\/api\/admin\/(?:drivers|users)\/([^\/]+)\/approve$/);
    if (approveMatch && method === 'PUT') {
      const driverId = approveMatch[1];
      const body = await parseBody(req);
      const users = await db.getUsers();
      const driver = users.find(u => u.id === driverId);
      if (!driver) return sendJSON(res, 404, { success: false, message: 'Motorista não encontrado' });

      driver.approved = body.approved !== false;
      driver.driverApproved = body.approved !== false;
      if (body.notes !== undefined) {
        driver.reviewNotes = body.notes;
      }
      if (driver.approved && driver.status === 'banned') {
        driver.status = 'active';
        driver.banReason = '';
      }
      await db.saveUser(driver);
      return sendJSON(res, 200, { success: true, driver, message: driver.approved ? 'Cadastro de motorista aprovado com sucesso!' : 'Cadastro reprovado' });
    }

    // 11. Admin: Platform Stats & Export
    if (pathname === '/api/admin/stats' && method === 'GET') {
      const userEmail = req.headers['x-user-email'];
      const isAdminReq = req.headers['x-admin-request'] === 'true' || isAdminEmail(userEmail);
      if (!isAdminReq && !isAdminEmail(userEmail)) {
        return sendJSON(res, 403, { success: false, message: 'Acesso negado: apenas administradores' });
      }

      const users = await db.getUsers();
      const rides = await db.getRides();
      checkAndExpireRides(rides);
      const reports = await db.getReports();
      const payments = await db.getPayments();

      const totalPassengers = users.filter(u => u.role === 'passenger').length;
      const totalDrivers = users.filter(u => u.role === 'driver').length;
      const bannedUsers = users.filter(u => u.status === 'banned').length;
      const pendingDrivers = users.filter(u => u.role === 'driver' && (u.approved === false || !u.approved || u.driverApproved === false)).length;
      const pendingReports = reports.filter(r => r.status === 'Pendente').length;
      const activeRides = rides.filter(r => ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)).length;
      const completedRides = rides.filter(r => r.status === 'completed').length;

      // Faturamento e Arrecadação da Plataforma:
      // O faturamento da plataforma é exclusivamente a arrecadação dos valores semanais pagos pelos motoristas (Carro: R$ 100, Moto: R$ 50),
      // e NUNCA o valor/ganho das corridas (que pertence integralmente aos motoristas).
      const drivers = users.filter(u => u.role === 'driver');
      let weeklyCycleRevenue = 0;
      drivers.forEach(drv => {
        const isMoto = drv.vehicle && drv.vehicle.type === 'moto';
        const st = drv.weeklyPaymentStatus || 'REGULAR';
        if (st === 'REGULAR') {
          weeklyCycleRevenue += isMoto ? 50.00 : 100.00;
        }
      });

      // Total acumulado em pagamentos confirmados de taxas semanais
      const totalPaymentsRevenue = payments
        .filter(p => p.status === 'REGULAR' || Number(p.amount) > 0)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      // Faturamento arrecadado pela plataforma (repasses semanais dos motoristas)
      const totalRevenue = totalPaymentsRevenue > 0 ? totalPaymentsRevenue : weeklyCycleRevenue;

      // Volume total transacionado em corridas pelos motoristas (apenas informativo)
      const driverRideVolume = rides
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (Number(r.price) || 0), 0);

      const statsObj = {
        totalUsers: users.length,
        totalPassengers,
        totalDrivers,
        bannedUsers,
        pendingDrivers,
        pendingReports,
        activeRides,
        completedRides,
        totalRides: rides.length,
        totalRevenue: Number(totalRevenue).toFixed(2),
        weeklyCycleRevenue: Number(weeklyCycleRevenue).toFixed(2),
        totalPaymentsRevenue: Number(totalPaymentsRevenue).toFixed(2),
        driverRideVolume: Number(driverRideVolume).toFixed(2),
        pendingPayments: payments.filter(p => p.status === 'PENDENTE').length,
        payments
      };

      return sendJSON(res, 200, {
        success: true,
        stats: statsObj,
        ...statsObj
      });
    }

    if (pathname === '/api/admin/export-csv' && method === 'GET') {
      const rides = await db.getRides();
      let csv = 'ID,Passageiro,Motorista,Origem,Destino,Preço,Status,Data\n';
      rides.forEach(r => {
        csv += `"${r.id}","${r.passengerName || ''}","${r.driverName || ''}","${r.origin || ''}","${r.destination || ''}","${r.price || 0}","${r.status || ''}","${r.createdAt || ''}"\n`;
      });
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=relatorio_maxdrive.csv'
      });
      return res.end(csv);
    }

    // 12. Database Status & Diagnostics (PostgreSQL / JSON Fallback)
    if (pathname === '/api/db-status' && method === 'GET') {
      const status = await db.getDBStatus();
      return sendJSON(res, 200, { success: true, ...status });
    }

    // Unmatched API route
    return sendJSON(res, 404, { success: false, message: 'Endpoint não encontrado' });
  }

  // Static File Serving
  let filePath;

  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(APLICATIVO_DIR, 'index.html');
  } else if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
    filePath = path.join(ADMIN_DIR, 'admin.html');
  } else if (pathname === '/admin/js/admin.js' || pathname === '/js/admin.js') {
    filePath = path.join(ADMIN_DIR, 'js', 'admin.js');
  } else if (pathname === '/manifest.json') {
    filePath = path.join(APLICATIVO_DIR, 'manifest.json');
  } else if (pathname.startsWith('/assets/')) {
    const relAsset = pathname.replace(/^\/assets\//, '');
    const possiblePaths = [
      path.join(APLICATIVO_DIR, 'assets', relAsset),
      path.join(process.cwd(), 'aplicativo', 'assets', relAsset),
      path.join(ADMIN_DIR, 'assets', relAsset),
      path.join(__dirname, 'assets', relAsset),
      path.join(__dirname, '..', 'aplicativo', 'assets', relAsset),
      path.join(process.cwd(), 'assets', relAsset)
    ];

    filePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  } else {
    // Check ADMIN_DIR first if path relates to admin, then APLICATIVO_DIR, then server root
    const cleanAdminPath = pathname.replace(/^\/admin\//, '/');
    const possiblePaths = [
      path.join(ADMIN_DIR, cleanAdminPath),
      path.join(ADMIN_DIR, pathname),
      path.join(APLICATIVO_DIR, pathname),
      path.join(process.cwd(), 'aplicativo', pathname),
      path.join(process.cwd(), pathname),
      path.join(__dirname, pathname)
    ];

    filePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
  }

  serveStatic(res, filePath);
  } catch (err) {
    console.error('SERVER REQUEST ERROR:', err);
    try {
      if (!res.headersSent) {
        sendJSON(res, 500, { success: false, message: 'Erro interno no servidor' });
      } else {
        res.end();
      }
    } catch (_) {}
  }
});

// -------------------------------------------------------------
// WEBSOCKET SERVER ATTACHMENT & REAL-TIME EVENT ENGINE
// -------------------------------------------------------------
wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.userId = null;
  ws.role = 'passenger';
  ws.city = 'ituiutaba';

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'auth' || data.type === 'update_context') {
        if (data.userId) ws.userId = data.userId;
        if (data.role) ws.role = data.role;
        if (data.city) ws.city = (data.city || 'ituiutaba').toLowerCase();
        if (data.vehicleType) ws.vehicleType = data.vehicleType.toLowerCase();

        if (ws.userId && ws.role === 'driver' && !ws.vehicleType) {
          try {
            const drv = await db.getUserById(ws.userId);
            if (drv && drv.vehicle) {
              const v = typeof drv.vehicle === 'string' ? JSON.parse(drv.vehicle) : drv.vehicle;
              if (v && v.type) ws.vehicleType = v.type.toLowerCase();
            }
          } catch (_) {}
        }

        if (data.type === 'auth') {
          ws.send(JSON.stringify({
            type: 'authenticated',
            userId: ws.userId,
            role: ws.role,
            city: ws.city,
            vehicleType: ws.vehicleType || 'car'
          }));
        }
      } else if (data.type === 'driver:location') {
        if (data.rideId && data.lat && data.lng) {
          broadcastToRide(data.rideId, 'driver:location', {
            rideId: data.rideId,
            lat: data.lat,
            lng: data.lng,
            bearing: data.bearing || 0
          }, ws);
        }
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
      }
    } catch (e) {
      console.warn('[WebSocket] Erro na mensagem do cliente:', e.message);
    }
  });

  ws.on('error', (err) => {
    console.warn('[WebSocket Client Error]:', err.message);
  });
});

const wsHeartbeatInterval = setInterval(() => {
  if (!wss || !wss.clients) return;
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(wsHeartbeatInterval);
});

server.on('error', (err) => {
  console.error('SERVER LISTEN ERROR:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('PROCESS UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('PROCESS UNHANDLED REJECTION:', reason);
});

const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, () => {
  const localIp = getLocalIpAddress();
  console.log(`=========================================`);
  console.log(`🚀 MAX DRIVE SERVIDOR ATIVO`);
  console.log(`\n🔗 ACESSO LOCAL (Neste computador):`);
  console.log(`   URL Principal: http://localhost:${PORT}`);
  console.log(`   Painel Admin : http://localhost:${PORT}/admin.html`);
  console.log(`\n📱 ACESSO NA REDE WI-FI (Celulares):`);
  console.log(`   IP para o App: http://${localIp}:${PORT}`);
  console.log(`\n⏱️ Iniciado em: ${new Date().toLocaleString()}`);
  console.log(`=========================================`);

  // Hidratar cache local a partir do PostgreSQL se conectado
  if (db && typeof db.hydrateJsonFromPostgres === 'function') {
    db.hydrateJsonFromPostgres().catch(err => {
      console.warn('⚠️ [DB Engine] Erro na hidratação inicial do Postgres:', err.message);
    });
  }
});
