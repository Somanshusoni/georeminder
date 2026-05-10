
export type ReminderStatus = 'active' | 'triggered' | 'completed';

export type ReminderCategory =
  | 'Shopping' | 'Health' | 'Food' | 'Study'
  | 'Work' | 'Finance' | 'Travel' | 'Fitness' | 'Other';

export type TravelMode = 'driving' | 'walking' | 'cycling';

declare global {
  interface Window {
    google: any;
  }
}

export interface Reminder {
  id: string;
  title: string;
  items: string[];
  originalInput: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: number;
  status: ReminderStatus;
  triggeredAt?: number;
  lastDistance?: number;
  routeDistance?: number; // Distance in meters from TomTom API
  routeETA?: string;      // Formatted ETA string from TomTom API
  routePoints?: [number, number][]; // Points for drawing the polyline
  searchCategory?: string; // If set, this is a dynamic search destination
  travelMode?: TravelMode;
  // Continuous Waypoint Routing fields
  finalLat?: number;
  finalLng?: number;
  finalAddress?: string;
  isWaypointRouting?: boolean;
  waypointName?: string;
  
  // AI auto-categorization fields
  category?: ReminderCategory;
  emoji?: string;
  categoryColor?: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeoStatus {
  active: boolean;
  error: string | null;
  lastUpdate: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

