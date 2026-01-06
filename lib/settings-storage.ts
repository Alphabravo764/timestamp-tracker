import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "@timestamp_camera_settings";
const USAGE_KEY = "@timestamp_camera_usage";

export interface AppSettings {
  darkMode: "system" | "light" | "dark";
  autoSaveTemplates: boolean;
  locationInterval: number; // seconds
  userName: string;
}

// Trial usage limits
export interface TrialUsage {
  shiftsUsed: number;
  reportsGenerated: number;
  liveSharesUsed: number;
  firstUseDate: string | null;
}

export const TRIAL_LIMITS = {
  maxShifts: 30,
  maxReports: 5,
  maxLiveShares: 5,
};

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: "system",
  autoSaveTemplates: true,
  locationInterval: 30,
  userName: "",
};

const DEFAULT_USAGE: TrialUsage = {
  shiftsUsed: 0,
  reportsGenerated: 0,
  liveSharesUsed: 0,
  firstUseDate: null,
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

// ============ TRIAL USAGE TRACKING ============

// Get current usage
export const getTrialUsage = async (): Promise<TrialUsage> => {
  try {
    const json = await AsyncStorage.getItem(USAGE_KEY);
    if (json) {
      return { ...DEFAULT_USAGE, ...JSON.parse(json) };
    }
    return DEFAULT_USAGE;
  } catch (error) {
    console.error("Error loading usage:", error);
    return DEFAULT_USAGE;
  }
};

// Save usage
export const saveTrialUsage = async (usage: Partial<TrialUsage>): Promise<TrialUsage> => {
  try {
    const current = await getTrialUsage();
    const updated = {
      ...current,
      ...usage,
      firstUseDate: current.firstUseDate || new Date().toISOString()
    };
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error("Error saving usage:", error);
    return { ...DEFAULT_USAGE, ...usage };
  }
};

// ============ PREMIUM ACCESS ============

const PREMIUM_KEY = "@timestamp_camera_premium";
const DEVICE_ID_KEY = "@timestamp_camera_device_id";

export interface PremiumStatus {
  isPremium: boolean;
  code: string | null;
  activatedAt: string | null;
  limits: {
    maxShifts: number;
    maxReports: number;
    maxLiveShares: number;
  };
}

export const PREMIUM_LIMITS = {
  maxShifts: 60,
  maxReports: 60,
  maxLiveShares: 60,
};

const DEFAULT_PREMIUM: PremiumStatus = {
  isPremium: false,
  code: null,
  activatedAt: null,
  limits: TRIAL_LIMITS,
};

// Get or generate device ID
export const getDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      // Generate a unique device ID
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      deviceId = "DEVICE-";
      for (let i = 0; i < 24; i++) {
        deviceId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error("Error getting device ID:", error);
    return `DEVICE-FALLBACK-${Date.now()}`;
  }
};

// Get premium status
export const getPremiumStatus = async (): Promise<PremiumStatus> => {
  try {
    const json = await AsyncStorage.getItem(PREMIUM_KEY);
    if (json) {
      return { ...DEFAULT_PREMIUM, ...JSON.parse(json) };
    }
    return DEFAULT_PREMIUM;
  } catch (error) {
    console.error("Error loading premium status:", error);
    return DEFAULT_PREMIUM;
  }
};

// Activate premium (called after successful API redemption)
export const activatePremium = async (code: string): Promise<PremiumStatus> => {
  try {
    const premium: PremiumStatus = {
      isPremium: true,
      code,
      activatedAt: new Date().toISOString(),
      limits: PREMIUM_LIMITS,
    };
    await AsyncStorage.setItem(PREMIUM_KEY, JSON.stringify(premium));
    return premium;
  } catch (error) {
    console.error("Error activating premium:", error);
    throw error;
  }
};

// Get current limits (respects premium status)
export const getCurrentLimits = async (): Promise<typeof TRIAL_LIMITS> => {
  const premium = await getPremiumStatus();
  return premium.isPremium ? PREMIUM_LIMITS : TRIAL_LIMITS;
};

// Check if can start shift
export const canStartShift = async (): Promise<{ allowed: boolean; remaining: number }> => {
  const usage = await getTrialUsage();
  const limits = await getCurrentLimits();
  const remaining = limits.maxShifts - usage.shiftsUsed;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
};

// Check if can generate report
export const canGenerateReport = async (): Promise<{ allowed: boolean; remaining: number }> => {
  const usage = await getTrialUsage();
  const limits = await getCurrentLimits();
  const remaining = limits.maxReports - usage.reportsGenerated;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
};

// Check if can share live view
export const canShareLiveView = async (): Promise<{ allowed: boolean; remaining: number }> => {
  const usage = await getTrialUsage();
  const limits = await getCurrentLimits();
  const remaining = limits.maxLiveShares - usage.liveSharesUsed;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
};

// Increment shift count
export const incrementShiftCount = async (): Promise<void> => {
  const usage = await getTrialUsage();
  await saveTrialUsage({ shiftsUsed: usage.shiftsUsed + 1 });
};

// Increment report count
export const incrementReportCount = async (): Promise<void> => {
  const usage = await getTrialUsage();
  await saveTrialUsage({ reportsGenerated: usage.reportsGenerated + 1 });
};

// Increment live share count
export const incrementLiveShareCount = async (): Promise<void> => {
  const usage = await getTrialUsage();
  await saveTrialUsage({ liveSharesUsed: usage.liveSharesUsed + 1 });
};
