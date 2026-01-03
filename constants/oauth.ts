import * as Linking from "expo-linking";
import * as ReactNative from "react-native";
import Constants from "expo-constants";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "space.manus.timestamp.tracker.t20251230092536";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // PRODUCTION: Always use Railway URL
  // This ensures the app connects to the permanent production database
  const PRODUCTION_URL = "https://timestamp-tracker-production.up.railway.app";
  console.log("[getApiBaseUrl] Using production Railway URL:", PRODUCTION_URL);
  return PRODUCTION_URL;

  // Development fallback (unreachable in production)
  if (API_BASE_URL) {
    console.log("[getApiBaseUrl] Using EXPO_PUBLIC_API_BASE_URL:", API_BASE_URL);
    return API_BASE_URL.replace(/\/$/, "");
  }

  // Fallback: On web, derive from current hostname by replacing port 8081 with 3000
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // On native (Expo Go), derive from the manifest/debugger host
  if (ReactNative.Platform.OS !== "web") {
    try {
      // Get the debugger host from Expo Constants (e.g., "192.168.1.100:8081" or tunnel URL)
      const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
      if (debuggerHost) {
        // Check if it's a manus.computer tunnel URL
        if (debuggerHost.includes("manus.computer") || debuggerHost.includes("-")) {
          // Replace 8081- prefix with 3000- for the API tunnel
          const apiHost = debuggerHost.replace(/^8081-/, "3000-").replace(/:8081$/, "");
          // Ensure HTTPS for tunnel URLs
          if (apiHost.includes("manus.computer")) {
            return `https://${apiHost}`;
          }
        }
        // Local network - replace port
        const apiHost = debuggerHost.replace(/:8081$/, ":3000").replace(/:19000$/, ":3000");
        return `http://${apiHost}`;
      }
      
      // Try manifest URL as fallback
      const manifestUrl = (Constants as any).manifest?.debuggerHost;
      if (manifestUrl) {
        if (manifestUrl.includes("manus.computer")) {
          const apiHost = manifestUrl.replace(/^8081-/, "3000-").replace(/:8081$/, "");
          return `https://${apiHost}`;
        }
        const apiHost = manifestUrl.replace(/:8081$/, ":3000").replace(/:19000$/, ":3000");
        return `http://${apiHost}`;
      }
    } catch (e) {
      console.log("Could not derive API URL from Expo Constants", e);
    }
  }

  // Fallback to empty (will use relative URL)
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

export const getLoginUrl = () => {
  let redirectUri: string;

  if (ReactNative.Platform.OS === "web") {
    // Web platform: redirect to API server callback (not Metro bundler)
    // The API server will then redirect back to the frontend with the session token
    redirectUri = `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    // Native platform: use deep link scheme for mobile OAuth callback
    // This allows the OS to redirect back to the app after authentication
    redirectUri = Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }

  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
