import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AddToTripSheet } from '../web/src/AddToTripSheet';
import { applyTripPlacement } from '../web/src/tripPlacement';
import { normalizeVisits, removeVisit } from '../web/src/visits';
import type { Journey, Place } from '../web/src/data';

const place: Place = { id: 'qa-place', kind: 'LANDMARK', name: '서울숲', area: '서울 성동', address: '서울 성동구', lat: 37.54, lng: 127.04, image: '', description: '산책', note: '', duration: '1시간' };
const sample: Journey = normalizeVisits({ id: 'qa-own', title: '서울 산책', region: '서울', dateRange: '날짜 미정', duration: '1박 2일', status: 'PLANNING', visibility: 'PRIVATE', cover: '', summary: '', story: '', tags: [], saves: 0, author: 'QA', isMine: true,
  days: [1, 2].map((day) => ({ day, date: `DAY ${day}`, title: `${day}일차`, story: '', places: day === 1 ? [place] : [], blocks: day === 1 ? [{ id: 'qa-block', type: 'PLACE', placeId: place.id }] : [] })) });

function Fixture({ initialNew }: { initialNew: boolean }) {
  const [journeys, setJourneys] = useState([sample]);
  const [open, setOpen] = useState(true);
  return open ? <AddToTripSheet journeys={journeys} places={[place]} initialJourneyId={initialNew ? null : sample.id} onClose={() => setOpen(false)} onConfirm={(request) => {
    const result = applyTripPlacement(journeys, request, 'QA');
    if (!result.ok) return result.error;
    setJourneys(result.journeys);
    document.documentElement.dataset.placementResult = JSON.stringify(result);
    return null;
  }} onRemove={(journeyId, day, visitId) => { setJourneys((current) => current.map((journey) => journey.id === journeyId ? removeVisit(journey, day, visitId) : journey)); return null; }} /> : null;
}

export function mountTripPlacementFixture(initialNew = true) {
  const node = document.createElement('div');
  document.body.append(node);
  const root = createRoot(node);
  root.render(<Fixture initialNew={initialNew} />);
  return () => { root.unmount(); node.remove(); };
}
