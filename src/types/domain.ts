import type { ImageSourcePropType } from 'react-native';

export type PlaceCategory = 'LANDMARK' | 'FOOD' | 'STAY' | 'CAFE' | 'WELLNESS';

export interface Region {
  id: string;
  name: string;
  country: string;
  tagline: string;
}

export interface SpotlogPlace {
  id: string;
  regionId: string;
  category: PlaceCategory;
  name: string;
  area: string;
  introduction: string;
  moodTags: string[];
  bestTime: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  image: ImageSourcePropType;
}

export interface SpotClip {
  id: string;
  placeId: string;
  creator: string;
  hook: string;
  caption: string;
  durationLabel: string;
}

export interface TripItem {
  id: string;
  placeId: string;
  day: number;
  time: string;
  source: 'SAVED' | 'RECOMMENDED';
}

export interface TripDraft {
  id: string;
  title: string;
  regionId: string;
  startDate: string;
  endDate: string;
  nights: number;
  days: number;
  items: TripItem[];
  createdAt: string;
  savedAt?: string;
  status: 'DRAFT' | 'SAVED';
}
