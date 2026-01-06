import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "@timestamp_camera_settings";

export interface AppSettings {
  darkMode: "system" | "light" | "dark";
  autoSaveTemplates: boolean;
  locationInterval: number; // seconds
  userName: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: "system",
  autoSaveTemplates: true,
  locationInterval: 30,
  userName: "",
};

// Get all settings
export const getSettings = async (): Promise<AppSettings> => {
  try {
    const json = await AsyncStorage.getItem(SETTINGS_KEY);
    if (json) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error loading settings:", error);
    return DEFAULT_SETTINGS;
  }
};

// Save settings
export const saveSettings = async (settings: Partial<AppSettings>): Promise<AppSettings> => {
  try {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error("Error saving settings:", error);
    return { ...DEFAULT_SETTINGS, ...settings };
  }
};

// Get dark mode setting
export const getDarkModeSetting = async (): Promise<"system" | "light" | "dark"> => {
  const settings = await getSettings();
  return settings.darkMode;
};

// Set dark mode
export const setDarkMode = async (mode: "system" | "light" | "dark"): Promise<void> => {
  await saveSettings({ darkMode: mode });
};
