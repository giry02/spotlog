from pathlib import Path
import zipfile

root=Path(__file__).resolve().parents[1]
out=root/'artifacts/frontend-completion-20260923'
out.mkdir(parents=True,exist_ok=True)
backup=out/'before-source.zip'
if not backup.exists():
    with zipfile.ZipFile(backup,'w',zipfile.ZIP_DEFLATED) as z:
        for folder in ['web/src','web/tests','src/hybrid','shared']:
            for p in (root/folder).rglob('*'):
                if p.is_file(): z.write(p,p.relative_to(root))
        z.write(root/'web/vite.config.ts','web/vite.config.ts')
p=root/'web/src/App.tsx'
s=p.read_text(encoding='utf-8')
start=s.index("type RouteSource =")
end=s.index('const orderPlacesByDistance',start)
logic=s[start:end]
for name in ['distanceKm','makeEstimatedRoute','fetchRoadRoute','scheduleCheckForLeg']:
    logic=logic.replace('const '+name+' =','export const '+name+' =')
logic=logic.replace('interface RouteResult','export interface RouteResult')
(root/'web/src/routeData.ts').write_text("import type { Place } from './data';\n"+logic,encoding='utf-8')
s=s[:start]+s[end:]
start=s.index('function RouteMap(')
end=s.index('const kindIcon:',start)
component=s[start:end].replace('function RouteMap(','export default function RouteMap(',1)
imports="""import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapIcon, MapPin, Footprints, Car, Check } from 'lucide-react';
import type { Place } from './data';
import { hasLocation } from './tripPlan';
import { distanceKm, makeEstimatedRoute, fetchRoadRoute, scheduleCheckForLeg, type RouteResult } from './routeData';
import { useLocale } from './locale';
import { NaverRouteCanvas } from './NaverRouteCanvas';
import 'maplibre-gl/dist/maplibre-gl.css';
"""
(root/'web/src/RouteMap.tsx').write_text(imports+component,encoding='utf-8')
s=s[:start]+s[end:]
s=s.replace("import 'maplibre-gl/dist/maplibre-gl.css';", "import { Suspense, lazy } from 'react';\nimport { distanceKm } from './routeData';\nconst LazyRouteMap = lazy(() => import('./RouteMap'));\nfunction RouteMap(props: {places: Place[];selectedVisitId?:string;onSelectVisit?:(id:string)=>void}) { const {locale}=useLocale();return <Suspense fallback={<div className=\"route-map-unavailable\" role=\"status\">{locale==='en'?'Loading map…':'지도를 불러오는 중…'}</div>}><LazyRouteMap {...props}/></Suspense>; }")
p.write_text(s,encoding='utf-8')
