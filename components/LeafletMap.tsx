import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface LeafletMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: number;
}

export function LeafletMap({ latitude, longitude, zoom = 15, height = 200 }: LeafletMapProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        try {
          // Initialize map
          var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([${latitude}, ${longitude}], ${zoom});
          
          // Add OSM tile layer
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap'
          }).addTo(map);

          // Add marker
          L.marker([${latitude}, ${longitude}]).addTo(map);
        } catch (e) {
          console.error('Map init error:', e);
        }
      </script>
    </body>
    </html>
  `;

  // Show error state with retry option
  if (hasError) {
    return (
      <View style={[styles.container, { height, backgroundColor: '#f3f4f6' }]}>
        <Ionicons name="map-outline" size={32} color="#9ca3af" />
        <Text style={styles.errorText}>Map unavailable</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setHasError(false)}
        >
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        // Android-specific: Use software layer to prevent WebView freeze
        androidLayerType="software"
        // Handle WebView render process death (prevents blank screen)
        onRenderProcessGone={(e) => {
          console.log('[WebView] Render process gone:', e?.nativeEvent);
          setHasError(true);
        }}
        onError={(e) => {
          console.log('[WebView] Error:', e?.nativeEvent?.description);
          setHasError(true);
        }}
        onHttpError={(e) => {
          console.log('[WebView] HTTP Error:', e?.nativeEvent?.statusCode);
        }}
        onLoad={() => {
          setIsLoading(false);
        }}
        renderLoading={() => (
          <View style={StyleSheet.absoluteFill}>
            <ActivityIndicator size="small" color="#666" style={{ marginTop: 20 }} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
});
