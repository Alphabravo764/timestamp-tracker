// MapBox GL JS initialization for viewer
// This replaces the Leaflet-based map with MapBox

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

function initMapBox(locations, mapDivId, staticMapDivId) {
  if (!locations || locations.length === 0) return;
  
  const mapDiv = document.getElementById(mapDivId);
  if (!mapDiv) return;
  
  // Get latest location
  const latest = locations[locations.length - 1];
  const startLoc = locations[0];
  
  // Check if MapBox GL is available
  if (typeof mapboxgl === 'undefined') {
    mapDiv.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;"><p>MapBox not loaded</p></div>';
    return;
  }
  
  // Set MapBox access token
  mapboxgl.accessToken = MAPBOX_TOKEN;
  
  // Create map
  const map = new mapboxgl.Map({
    container: mapDivId,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [latest.longitude, latest.latitude],
    zoom: 15
  });
  
  // Add navigation controls
  map.addControl(new mapboxgl.NavigationControl());
  
  map.on('load', () => {
    // Add route polyline
    const coordinates = locations.map(loc => [loc.longitude, loc.latitude]);
    
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });
    
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#f59e0b',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });
    
    // Add start marker (green)
    new mapboxgl.Marker({ color: '#10b981' })
      .setLngLat([startLoc.longitude, startLoc.latitude])
      .setPopup(new mapboxgl.Popup().setHTML('<strong>🟢 Start</strong>'))
      .addTo(map);
    
    // Add end marker (red)
    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([latest.longitude, latest.latitude])
      .setPopup(new mapboxgl.Popup().setHTML('<strong>🔴 Current</strong>'))
      .addTo(map);
    
    // Fit bounds to show entire route
    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
    
    map.fitBounds(bounds, { padding: 50 });
  });
  
  // Generate static map for print
  if (staticMapDivId) {
    generateStaticMap(locations, staticMapDivId);
  }
  
  return map;
}

function generateStaticMap(locations, divId) {
  const staticDiv = document.getElementById(divId);
  if (!staticDiv || !MAPBOX_TOKEN) return;
  
  // Get center point
  const latest = locations[locations.length - 1];
  const center = `${latest.longitude},${latest.latitude}`;
  
  // Build polyline path for static map
  // MapBox static API uses: path-strokeWidth+strokeColor(lng1,lat1;lng2,lat2;...)
  const pathCoords = locations
    .filter((_, i) => i % Math.max(1, Math.floor(locations.length / 100)) === 0) // Sample max 100 points
    .map(loc => `${loc.longitude.toFixed(5)},${loc.latitude.toFixed(5)}`)
    .join(';');
  
  const pathOverlay = `path-4+f59e0b-0.8(${encodeURIComponent(pathCoords)})`;
  
  // Add start marker (green)
  const startLoc = locations[0];
  const startMarker = `pin-s-a+10b981(${startLoc.longitude},${startLoc.latitude})`;
  
  // Add end marker (red)
  const endMarker = `pin-s-b+ef4444(${latest.longitude},${latest.latitude})`;
  
  const width = 600;
  const height = 400;
  const zoom = 14;
  
  const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pathOverlay},${startMarker},${endMarker}/auto/${width}x${height}?access_token=${MAPBOX_TOKEN}`;
  
  staticDiv.innerHTML = `<img src="${staticUrl}" alt="Route Map" style="width: 100%; height: 100%; object-fit: cover;" />`;
}
