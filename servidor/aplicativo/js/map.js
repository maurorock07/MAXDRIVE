/**
 * MAX DRIVE - Motor de Mapas Interativo de Alta Precisão (Leaflet.js + OpenStreetMap)
 * 100% Gratuito, Sem Chaves de API, com Suporte a Roteamento Real OSRM, GPS e Animações em Tempo Real
 */

const MaxMap = (function() {
  let containerId = null;
  let container = null;
  let leafletMap = null;
  let currentCity = 'ituiutaba';
  let onRouteCalculated = null;

  // Leaflet Layers & Markers
  let tileLayer = null;
  let originMarker = null;
  let destinationMarker = null;
  let vehicleMarker = null;
  let routeHaloPolyline = null;
  let routeMainPolyline = null;

  // Real OSRM Road Coordinates [ [lat, lng], ... ]
  let currentRouteLatLngs = [];
  let rawGeoJsonCoordinates = [];
  let originPoint = null;
  let destinationPoint = null;

  // Animation & Tracking
  let isTracking = false;
  let trackingProgress = 0;
  let trackingAnimationId = null;

  // City Center Coordinates (Todas as 17 Cidades da Região Mapeadas)
  const cityCoordinates = {
    araguari:      { lat: -18.6475, lng: -48.1872, zoom: 14, name: 'Araguari - MG' },
    araxa:         { lat: -19.5931, lng: -46.9406, zoom: 14, name: 'Araxá - MG' },
    canapolis:     { lat: -18.7233, lng: -49.5039, zoom: 14, name: 'Canápolis - MG' },
    capinopolis:   { lat: -18.6822, lng: -49.5694, zoom: 14, name: 'Capinópolis - MG' },
    centralina:    { lat: -18.5819, lng: -49.5392, zoom: 14, name: 'Centralina - MG' },
    frutal:        { lat: -20.0242, lng: -48.9406, zoom: 14, name: 'Frutal - MG' },
    ituiutaba:     { lat: -18.9688, lng: -49.4642, zoom: 14, name: 'Ituiutaba - MG' },
    itumbiara:     { lat: -18.4194, lng: -49.2158, zoom: 14, name: 'Itumbiara - GO' },
    iturama:       { lat: -19.7289, lng: -50.1964, zoom: 14, name: 'Iturama - MG' },
    monte_carmelo: { lat: -18.7258, lng: -47.4989, zoom: 14, name: 'Monte Carmelo - MG' },
    patos_de_minas:{ lat: -18.5789, lng: -46.5181, zoom: 14, name: 'Patos de Minas - MG' },
    patrocinio:    { lat: -18.9439, lng: -46.9928, zoom: 14, name: 'Patrocínio - MG' },
    prata:         { lat: -19.3072, lng: -48.9242, zoom: 14, name: 'Prata - MG' },
    santa_vitoria: { lat: -18.8436, lng: -50.1219, zoom: 14, name: 'Santa Vitória - MG' },
    tupaciguara:   { lat: -18.5922, lng: -48.7050, zoom: 14, name: 'Tupaciguara - MG' },
    uberaba:       { lat: -19.7483, lng: -47.9319, zoom: 14, name: 'Uberaba - MG' },
    uberlandia:    { lat: -18.9186, lng: -48.2772, zoom: 14, name: 'Uberlândia - MG' }
  };

  // Create Custom HTML Pin Icons
  function createOriginIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: 'leaflet-custom-marker',
      html: `
        <div class="map-marker-pin pin-origin">
          <div class="pin-ring"></div>
          <span class="pin-label">A</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 30]
    });
  }

  function createDestinationIcon() {
    if (!window.L) return null;
    return L.divIcon({
      className: 'leaflet-custom-marker',
      html: `
        <div class="map-marker-pin pin-dest">
          <span class="pin-label">B</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 30]
    });
  }

  function createVehicleIcon(heading = 0) {
    if (!window.L) return null;
    return L.divIcon({
      className: 'leaflet-vehicle-marker',
      html: `
        <div class="map-vehicle-box" style="transform: rotate(${heading}deg);">
          <div class="vehicle-beacon"></div>
          <img src="assets/icons/car-front.svg" alt="Veículo" class="vehicle-icon-svg">
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  }

  function init(targetContainerId, callback) {
    containerId = targetContainerId;
    onRouteCalculated = callback;
    container = document.getElementById(targetContainerId);
    if (!container) return;

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.warn('[MaxMap] Leaflet.js ainda não carregado, aguardando...');
      setTimeout(() => init(targetContainerId, callback), 200);
      return;
    }

    // Clean any prior instance
    if (leafletMap) {
      try { leafletMap.remove(); } catch (e) {}
      leafletMap = null;
    }

    container.innerHTML = '';

    const cityKey = (currentCity || 'ituiutaba').toLowerCase().replace(/[\-\_\s]+(mg|go|sp|df|ba|rj|pr|rs|sc|pe|ce|pa|ma|am|es|pb|rn|al|se|pi|mt|ms|ro|to|ac|ap|rr)$/i, '').replace(/[^a-z0-9\_]/g, '_').replace(/\_+/g, '_').replace(/^\_|\_$/g, '');
    const city = cityCoordinates[cityKey] || cityCoordinates[currentCity] || cityCoordinates.ituiutaba;

    let lat = Number(city && city.lat);
    let lng = Number(city && city.lng);
    if (isNaN(lat) || isNaN(lng)) {
      lat = -18.9688;
      lng = -49.4642;
    }

    // Initialize Leaflet Map
    leafletMap = L.map(container, {
      center: [lat, lng],
      zoom: (city && city.zoom) || 14,
      zoomControl: false,
      attributionControl: false
    });

    // Add Standard OpenStreetMap Tiles
    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
      timeout: 6000
    }).addTo(leafletMap);

    // Add Compact Zoom Control top-right
    L.control.zoom({ position: 'topright' }).addTo(leafletMap);

    // Map Click Listener to pick Origin / Destination
    leafletMap.on('click', handleMapClick);

    // Trigger resize to fix tile clipping
    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 150);
  }

  async function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    // Resolve address via reverse geocoding
    let placeName = `Coordenada (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    let bairroName = '';
    try {
      const curCity = currentCity || 'ituiutaba';
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}&city=${encodeURIComponent(curCity)}`);
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && d.address) {
          placeName = d.address;
          bairroName = d.bairro || '';
        }
      }
    } catch (err) {
      console.warn('Erro no reverse geocode do clique no mapa:', err);
    }

    if (!originPoint || (originPoint && destinationPoint)) {
      // Set Origin
      originPoint = { lat, lng, name: placeName, bairro: bairroName };
      destinationPoint = null;
      clearRoutePolylines();
      if (destinationMarker) {
        leafletMap.removeLayer(destinationMarker);
        destinationMarker = null;
      }
      setMarker('origin', originPoint);
      if (onRouteCalculated) {
        onRouteCalculated({
          source: 'map_origin_click',
          origin: originPoint.name,
          originBairro: originPoint.bairro,
          originLat: originPoint.lat,
          originLng: originPoint.lng
        });
      }
    } else {
      // Set Destination
      destinationPoint = { lat, lng, name: placeName, bairro: bairroName };
      setMarker('destination', destinationPoint);
      if (onRouteCalculated) {
        onRouteCalculated({
          source: 'map_dest_click',
          origin: originPoint.name,
          originBairro: originPoint.bairro,
          originLat: originPoint.lat,
          originLng: originPoint.lng,
          destination: destinationPoint.name,
          destBairro: destinationPoint.bairro,
          destLat: destinationPoint.lat,
          destLng: destinationPoint.lng
        });
      }
    }
  }

  function setMarker(type, point) {
    if (!leafletMap || !window.L || !point) return;

    if (type === 'origin') {
      if (originMarker) leafletMap.removeLayer(originMarker);
      originMarker = L.marker([point.lat, point.lng], {
        icon: createOriginIcon(),
        title: point.name || 'Origem'
      }).addTo(leafletMap);
      originMarker.bindPopup(`<b>Ponto de Partida:</b><br>${point.name || 'Origem'}`);
    } else if (type === 'destination') {
      if (destinationMarker) leafletMap.removeLayer(destinationMarker);
      destinationMarker = L.marker([point.lat, point.lng], {
        icon: createDestinationIcon(),
        title: point.name || 'Destino'
      }).addTo(leafletMap);
      destinationMarker.bindPopup(`<b>Local de Chegada:</b><br>${point.name || 'Destino'}`);
    }
  }

  function updateDriverMarker(lat, lng, heading = 0) {
    if (!leafletMap || !window.L || !lat || !lng) return;
    if (!vehicleMarker) {
      vehicleMarker = L.marker([lat, lng], {
        icon: createVehicleIcon(heading),
        zIndexOffset: 1000
      }).addTo(leafletMap);
    } else {
      vehicleMarker.setLatLng([lat, lng]);
      vehicleMarker.setIcon(createVehicleIcon(heading));
    }
  }

  function clearRoutePolylines() {
    if (routeHaloPolyline && leafletMap) {
      leafletMap.removeLayer(routeHaloPolyline);
      routeHaloPolyline = null;
    }
    if (routeMainPolyline && leafletMap) {
      leafletMap.removeLayer(routeMainPolyline);
      routeMainPolyline = null;
    }
    currentRouteLatLngs = [];
  }

  function setCity(cityId) {
    if (!cityId) return;
    const cleanId = cityId.toLowerCase().replace(/[\-\_\s]+(mg|go|sp|df|ba|rj|pr|rs|sc|pe|ce|pa|ma|am|es|pb|rn|al|se|pi|mt|ms|ro|to|ac|ap|rr)$/i, '').replace(/[^a-z0-9\_]/g, '_').replace(/\_+/g, '_').replace(/^\_|\_$/g, '');
    currentCity = cleanId;

    const city = cityCoordinates[cleanId] || cityCoordinates[cityId] || cityCoordinates.ituiutaba;
    let lat = Number(city && city.lat);
    let lng = Number(city && city.lng);
    if (isNaN(lat) || isNaN(lng)) {
      lat = -18.9688;
      lng = -49.4642;
    }

    if (leafletMap) {
      try {
        leafletMap.flyTo([lat, lng], (city && city.zoom) || 14, { duration: 1.2 });
        setTimeout(() => {
          if (leafletMap) leafletMap.invalidateSize();
        }, 200);
      } catch (e) {
        console.warn('Erro flyTo no setCity:', e);
      }
    }
    clearRoute();
  }

  function clearRoute() {
    clearRoutePolylines();
    if (originMarker && leafletMap) {
      leafletMap.removeLayer(originMarker);
      originMarker = null;
    }
    if (destinationMarker && leafletMap) {
      leafletMap.removeLayer(destinationMarker);
      destinationMarker = null;
    }
    if (vehicleMarker && leafletMap) {
      leafletMap.removeLayer(vehicleMarker);
      vehicleMarker = null;
    }
    originPoint = null;
    destinationPoint = null;
    currentRouteLatLngs = [];
    rawGeoJsonCoordinates = [];
    stopTracking();
  }

  function drawRoutePolylines(latLngs) {
    if (!leafletMap || !window.L || !latLngs || latLngs.length < 2) return;

    clearRoutePolylines();
    currentRouteLatLngs = latLngs;

    // 1. Cyan ambient halo glow (#00E5FF, weight 9px, opacity 0.45)
    routeHaloPolyline = L.polyline(latLngs, {
      color: '#00E5FF',
      weight: 9,
      opacity: 0.45,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(leafletMap);

    // 2. High-visibility sharp yellow route (#FEE500, weight 5px, opacity 1.0)
    routeMainPolyline = L.polyline(latLngs, {
      color: '#FEE500',
      weight: 5,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(leafletMap);

    // Fit map view to encompass the entire route nicely
    try {
      const bounds = L.latLngBounds(latLngs);
      leafletMap.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 16
      });
    } catch (e) {}

    render();
  }

  function setGeoJsonRoute(coords, origLabel, destLabel) {
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
      return;
    }

    rawGeoJsonCoordinates = coords;

    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const latLngs = coords.map(pt => [pt[1], pt[0]]);

    if (!leafletMap || !window.L) return;

    const startLatLng = latLngs[0];
    const endLatLng = latLngs[latLngs.length - 1];

    if (!originPoint) {
      originPoint = { lat: startLatLng[0], lng: startLatLng[1], name: origLabel || 'Partida' };
    }
    if (!destinationPoint) {
      destinationPoint = { lat: endLatLng[0], lng: endLatLng[1], name: destLabel || 'Destino' };
    }

    setMarker('origin', originPoint);
    setMarker('destination', destinationPoint);

    drawRoutePolylines(latLngs);
  }

  async function setRouteWithCoords(origName, origCoords, destName, destCoords) {
    const oClean = (origName || '').trim();
    const dClean = (destName || '').trim();

    const curCity = currentCity || 'ituiutaba';

    // 1. Resolve Origin Point (Pin A)
    let pA = null;
    if (origCoords && !isNaN(origCoords.lat) && !isNaN(origCoords.lng)) {
      pA = { lat: Number(origCoords.lat), lng: Number(origCoords.lng), name: oClean || 'Origem' };
    } else if (oClean.length >= 3) {
      try {
        const resA = await fetch(`/api/geocode?city=${encodeURIComponent(curCity)}&q=${encodeURIComponent(oClean)}`);
        if (resA.ok) {
          const dA = await resA.json();
          if (dA && dA.success && dA.lat && dA.lng) {
            pA = { lat: dA.lat, lng: dA.lng, name: oClean };
          }
        }
      } catch (e) {}
    }

    // 2. Resolve Destination Point (Pin B)
    let pB = null;
    if (destCoords && !isNaN(destCoords.lat) && !isNaN(destCoords.lng)) {
      pB = { lat: Number(destCoords.lat), lng: Number(destCoords.lng), name: dClean || 'Destino' };
    } else if (dClean.length >= 3) {
      try {
        const resB = await fetch(`/api/geocode?city=${encodeURIComponent(curCity)}&q=${encodeURIComponent(dClean)}`);
        if (resB.ok) {
          const dB = await resB.json();
          if (dB && dB.success && dB.lat && dB.lng) {
            pB = { lat: dB.lat, lng: dB.lng, name: dClean };
          }
        }
      } catch (e) {}
    }

    // Update Pin A (Do NOT remove Pin B!)
    if (pA) {
      originPoint = pA;
      setMarker('origin', pA);
    } else if (!oClean) {
      if (originMarker && leafletMap) { leafletMap.removeLayer(originMarker); originMarker = null; }
      originPoint = null;
    }

    // Update Pin B (Do NOT remove Pin A!)
    if (pB) {
      destinationPoint = pB;
      setMarker('destination', pB);
    } else if (!dClean) {
      if (destinationMarker && leafletMap) { leafletMap.removeLayer(destinationMarker); destinationMarker = null; }
      destinationPoint = null;
    }

    // Scenario 1: Only Pin A exists -> Center camera on A
    if (pA && !pB) {
      clearRoutePolylines();
      if (leafletMap) leafletMap.flyTo([pA.lat, pA.lng], 15, { duration: 1.0 });
      return;
    }

    // Scenario 2: Only Pin B exists -> Center camera on B
    if (!pA && pB) {
      clearRoutePolylines();
      if (leafletMap) leafletMap.flyTo([pB.lat, pB.lng], 15, { duration: 1.0 });
      return;
    }

    // Scenario 3: Neither exists -> Clear polylines
    if (!pA && !pB) {
      clearRoutePolylines();
      return;
    }

    // Scenario 4: BOTH Pin A and Pin B exist -> Query OSRM and draw route!
    try {
      const params = new URLSearchParams({
        city: curCity,
        orig: oClean,
        dest: dClean,
        origLat: pA.lat,
        origLng: pA.lng,
        destLat: pB.lat,
        destLng: pB.lng
      });

      const res = await fetch(`/api/route?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.coordinates) && data.coordinates.length >= 2) {
          setGeoJsonRoute(data.coordinates, oClean, dClean);
        } else {
          // Fallback straight line polyline if OSRM endpoint fails
          const straightCoords = [[pA.lat, pA.lng], [pB.lat, pB.lng]];
          drawRoutePolylines(straightCoords);
        }
      }
    } catch (err) {
      console.warn('Erro ao calcular rota:', err);
      const straightCoords = [[pA.lat, pA.lng], [pB.lat, pB.lng]];
      drawRoutePolylines(straightCoords);
    }
  }

  function setRoute(origName, destName) {
    return setRouteWithCoords(origName, null, destName, null);
  }

  // Smooth Vehicle Animation along the real road polyline
  function startTracking() {
    if (!currentRouteLatLngs || currentRouteLatLngs.length < 2 || !leafletMap) return;

    isTracking = true;
    trackingProgress = 0;

    // Place initial vehicle marker at origin
    const startPoint = currentRouteLatLngs[0];
    if (vehicleMarker) leafletMap.removeLayer(vehicleMarker);
    vehicleMarker = L.marker(startPoint, {
      icon: createVehicleIcon(0),
      zIndexOffset: 1000
    }).addTo(leafletMap);

    const totalPoints = currentRouteLatLngs.length;

    function step() {
      if (!isTracking || !leafletMap) return;

      trackingProgress += 0.003;
      if (trackingProgress >= 1) {
        trackingProgress = 1;
        isTracking = false;
      }

      // Calculate position along polyline index
      const exactIndex = trackingProgress * (totalPoints - 1);
      const idxLow = Math.floor(exactIndex);
      const idxHigh = Math.min(totalPoints - 1, idxLow + 1);
      const frac = exactIndex - idxLow;

      const p1 = currentRouteLatLngs[idxLow];
      const p2 = currentRouteLatLngs[idxHigh];

      const curLat = p1[0] + (p2[0] - p1[0]) * frac;
      const curLng = p1[1] + (p2[1] - p1[1]) * frac;

      // Calculate bearing angle for vehicle rotation
      const dLat = p2[0] - p1[0];
      const dLng = p2[1] - p1[1];
      const heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

      if (vehicleMarker) {
        vehicleMarker.setLatLng([curLat, curLng]);
        vehicleMarker.setIcon(createVehicleIcon(heading));
      }

      if (isTracking) {
        trackingAnimationId = requestAnimationFrame(step);
      }
    }

    if (trackingAnimationId) cancelAnimationFrame(trackingAnimationId);
    trackingAnimationId = requestAnimationFrame(step);
  }

  function stopTracking() {
    isTracking = false;
    if (trackingAnimationId) {
      cancelAnimationFrame(trackingAnimationId);
      trackingAnimationId = null;
    }
  }

  function render() {
    if (leafletMap) {
      leafletMap.invalidateSize();
    }
  }

  window.addEventListener('resize', () => {
    if (leafletMap) {
      leafletMap.invalidateSize();
    }
  });

  return {
    init,
    setCity,
    setRoute,
    setRouteWithCoords,
    setGeoJsonRoute,
    setMarker,
    updateDriverMarker,
    startTracking,
    stopTracking,
    render,
    clearRoute,
    getMap: () => leafletMap,
    addCity: function(cityObj) {
      if (cityObj && cityObj.id) {
        cityCoordinates[cityObj.id] = {
          lat: cityObj.lat || -18.9688,
          lng: cityObj.lng || -49.4642,
          name: cityObj.name || cityObj.id
        };
      }
    }
  };
})();

// Attach to window
window.MaxMap = MaxMap;
