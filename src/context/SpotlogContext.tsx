import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { places } from '../data/mockCatalog';
import type { TripDraft, TripItem } from '../types/domain';

const SAVED_KEY = 'spotlog.saved-place-ids.v1';
const DRAFT_KEY = 'spotlog.trip-draft.v1';

interface SpotlogContextValue {
  ready: boolean;
  activeRegionId: string;
  setActiveRegionId: (id: string) => void;
  savedPlaceIds: string[];
  toggleSavedPlace: (id: string) => void;
  isSaved: (id: string) => boolean;
  draft: TripDraft | null;
  createRecommendedDraft: () => TripDraft;
}

const SpotlogContext = createContext<SpotlogContextValue | null>(null);

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export function SpotlogProvider({ children }: React.PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState('danang');
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<TripDraft | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SAVED_KEY), AsyncStorage.getItem(DRAFT_KEY)])
      .then(([saved, storedDraft]) => {
        if (saved) setSavedPlaceIds(JSON.parse(saved));
        if (storedDraft) setDraft(JSON.parse(storedDraft));
      })
      .finally(() => setReady(true));
  }, []);

  const toggleSavedPlace = useCallback((id: string) => {
    setSavedPlaceIds((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      void AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isSaved = useCallback((id: string) => savedPlaceIds.includes(id), [savedPlaceIds]);

  const createRecommendedDraft = useCallback(() => {
    const selected = savedPlaceIds
      .map((id) => places.find((place) => place.id === id))
      .filter((place): place is NonNullable<typeof place> => Boolean(place));
    const supplemental = places.filter((place) => place.regionId === activeRegionId && !savedPlaceIds.includes(place.id));
    const sources = [...selected, ...supplemental].slice(0, 8);
    const times = ['09:00', '11:30', '15:00', '18:30'];
    const items: TripItem[] = sources.map((place, index) => ({
      id: `trip-item-${place.id}`,
      placeId: place.id,
      day: Math.min(5, Math.floor(index / 2) + 1),
      time: times[index % times.length],
      source: savedPlaceIds.includes(place.id) ? 'SAVED' : 'RECOMMENDED',
    }));
    const start = addDays(new Date(), 30);
    const next: TripDraft = {
      id: `trip-${Date.now()}`,
      title: '천천히 만나는 다낭 4박 5일',
      regionId: activeRegionId,
      startDate: dateOnly(start),
      endDate: dateOnly(addDays(start, 4)),
      nights: 4,
      days: 5,
      items,
      createdAt: new Date().toISOString(),
      status: 'DRAFT',
    };
    setDraft(next);
    void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    return next;
  }, [activeRegionId, savedPlaceIds]);

  const value = useMemo(() => ({
    ready, activeRegionId, setActiveRegionId, savedPlaceIds, toggleSavedPlace, isSaved, draft, createRecommendedDraft,
  }), [ready, activeRegionId, savedPlaceIds, toggleSavedPlace, isSaved, draft, createRecommendedDraft]);

  return <SpotlogContext.Provider value={value}>{children}</SpotlogContext.Provider>;
}

export function useSpotlog() {
  const context = useContext(SpotlogContext);
  if (!context) throw new Error('useSpotlog must be used inside SpotlogProvider');
  return context;
}
