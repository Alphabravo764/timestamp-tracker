import AsyncStorage from "@react-native-async-storage/async-storage";

const TEMPLATES_KEY = "@timestamp_camera_templates";

export interface ShiftTemplate {
  id: string;
  siteName: string;
  staffName: string;
  createdAt: string;
  usageCount: number;
}

// Get all templates
export const getTemplates = async (): Promise<ShiftTemplate[]> => {
  try {
    const json = await AsyncStorage.getItem(TEMPLATES_KEY);
    if (json) {
      const templates = JSON.parse(json) as ShiftTemplate[];
      // Sort by usage count (most used first)
      return templates.sort((a, b) => b.usageCount - a.usageCount);
    }
    return [];
  } catch (error) {
    console.error("Error loading templates:", error);
    return [];
  }
};

// Save a new template
export const saveTemplate = async (siteName: string, staffName: string): Promise<ShiftTemplate | null> => {
  try {
    const templates = await getTemplates();
    
    // Check if template already exists
    const existing = templates.find(
      t => t.siteName.toLowerCase() === siteName.toLowerCase() && 
           t.staffName.toLowerCase() === staffName.toLowerCase()
    );
    
    if (existing) {
      // Increment usage count
      existing.usageCount++;
      await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
      return existing;
    }
    
    // Create new template
    const newTemplate: ShiftTemplate = {
      id: Date.now().toString(),
      siteName,
      staffName,
      createdAt: new Date().toISOString(),
      usageCount: 1,
    };
    
    templates.push(newTemplate);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    return newTemplate;
  } catch (error) {
    console.error("Error saving template:", error);
    return null;
  }
};

// Delete a template
export const deleteTemplate = async (id: string): Promise<boolean> => {
  try {
    const templates = await getTemplates();
    const filtered = templates.filter(t => t.id !== id);
    await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error("Error deleting template:", error);
    return false;
  }
};

// Increment usage count when template is used
export const useTemplate = async (id: string): Promise<void> => {
  try {
    const templates = await getTemplates();
    const template = templates.find(t => t.id === id);
    if (template) {
      template.usageCount++;
      await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    }
  } catch (error) {
    console.error("Error updating template usage:", error);
  }
};
