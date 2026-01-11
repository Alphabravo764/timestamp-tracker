/**
 * Safe render helpers to prevent crashes from invalid data
 */

/**
 * Safely get a photo URI from various possible field names
 * Returns null if no valid URI is found
 */
export const getPhotoUri = (photo: any): string | null => {
    if (!photo) return null;

    // Check various possible URI field names
    if (typeof photo.uri === 'string' && photo.uri.length > 0) return photo.uri;
    if (typeof photo.url === 'string' && photo.url.length > 0) return photo.url;
    if (typeof photo.remoteUrl === 'string' && photo.remoteUrl.length > 0) return photo.remoteUrl;
    if (typeof photo.publicUrl === 'string' && photo.publicUrl.length > 0) return photo.publicUrl;
    if (typeof photo.localUri === 'string' && photo.localUri.length > 0) return photo.localUri;
    if (typeof photo.path === 'string' && photo.path.length > 0) return photo.path;

    return null;
};

/**
 * Generate a unique stable key for a photo item
 * Avoids duplicate key crashes during list rendering
 */
export const getPhotoKey = (photo: any, index: number): string => {
    if (!photo) return `photo-fallback-${index}`;

    // Try various ID fields, fall back to timestamp + index
    const id = photo.id ?? photo.photoId ?? photo.localId ?? null;
    if (id) return String(id);

    // Fallback to timestamp-based key + index for uniqueness
    const ts = photo.timestamp ?? photo.createdAt ?? photo.ts ?? Date.now();
    return `photo-${ts}-${index}`;
};

/**
 * Generate a unique stable key for a note item
 */
export const getNoteKey = (note: any, index: number): string => {
    if (!note) return `note-fallback-${index}`;

    const id = note.id ?? note.noteId ?? null;
    if (id) return String(id);

    const ts = note.timestamp ?? note.createdAt ?? note.ts ?? Date.now();
    return `note-${ts}-${index}`;
};

/**
 * Safely get photos array from shift, always returns array
 */
export const getSafePhotos = (shift: any): any[] => {
    if (!shift) {
        console.log('[getSafePhotos] shift is null/undefined');
        return [];
    }
    if (!Array.isArray(shift.photos)) {
        console.log('[getSafePhotos] shift.photos is not an array:', typeof shift.photos, shift.photos);
        return [];
    }
    console.log('[getSafePhotos] Returning', shift.photos.length, 'photos');
    return shift.photos;
};

/**
 * Safely get notes array from shift, always returns array
 */
export const getSafeNotes = (shift: any): any[] => {
    if (!shift) {
        console.log('[getSafeNotes] shift is null/undefined');
        return [];
    }
    if (!Array.isArray(shift.notes)) {
        console.log('[getSafeNotes] shift.notes is not an array:', typeof shift.notes, shift.notes);
        return [];
    }
    console.log('[getSafeNotes] Returning', shift.notes.length, 'notes');
    return shift.notes;
};

/**
 * Safely get locations array from shift, always returns array
 * Filters out invalid coordinate entries
 */
export const getSafeLocations = (shift: any): any[] => {
    if (!shift) return [];
    if (!Array.isArray(shift.locations)) return [];

    // Filter to only valid coordinates
    return shift.locations.filter((loc: any) =>
        loc &&
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number' &&
        Number.isFinite(loc.latitude) &&
        Number.isFinite(loc.longitude) &&
        Math.abs(loc.latitude) <= 90 &&
        Math.abs(loc.longitude) <= 180
    );
};
