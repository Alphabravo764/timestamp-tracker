import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
    latitude: number;
    longitude: number;
    zoom?: number;
    height?: number;
}

export function LeafletMap({ latitude, longitude, zoom = 15, height = 200 }: LeafletMapProps) {
    // Simple HTML template loading Leaflet from CDN
    // Uses OpenStreetMap tiles (free, no key required)
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
        .leaflet-control-attribution { font-size: 8px !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        // Initialize map
        var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${latitude}, ${longitude}], ${zoom});
        
        // Add OSM tile layer
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Add marker
        L.marker([${latitude}, ${longitude}]).addTo(map);

        // Function to update map from React Native
        function updateLocation(lat, lng) {
          map.setView([lat, lng], ${zoom});
          L.marker([lat, lng]).addTo(map);
        }
      </script>
    </body>
    </html>
  `;

    return (
        <View style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb' }}>
            <WebView
                originWhitelist={['*']}
                source={{ html }}
                style={{ flex: 1 }}
                scrollEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={StyleSheet.absoluteFill}>
                        <ActivityIndicator size="small" color="#666" style={{ marginTop: 20 }} />
                    </View>
                )}
            />
        </View>
    );
}
