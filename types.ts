
export type ReminderStatus = 'active' | 'triggered' | 'completed';

export type ReminderCategory =
  | 'Shopping' | 'Health' | 'Food' | 'Study'
  | 'Work' | 'Finance' | 'Travel' | 'Fitness' | 'Other';

declare global {
  interface Window {
    google: any;
  }
}

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  originalInput: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: number;
  status: ReminderStatus;
  triggeredAt?: number;
  lastDistance?: number;
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

