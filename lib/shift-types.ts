export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  address?: string;
}

export interface ShiftPhoto {
  id: string;
  uri: string;
  timestamp: string;
  location: LocationPoint | null;
  address?: string;
  note?: string;
}

export interface Shift {
  id: string;
  staffName: string;
  siteName: string;
  pairCode: string;
  startTime: string;
  endTime: string | null;
  isActive: boolean;
  locations: LocationPoint[];
  photos: ShiftPhoto[];
}

export interface PairedStaff {
  pairCode: string;
  staffName: string;
  addedAt: string;
  lastLocation?: LocationPoint;
  isActive?: boolean;
}
