import { REGIONS } from './trip-data';
import { isTripLocalAction, MAX_OFFLINE_PACKAGES, MAX_OFFLINE_BYTES } from './trip-local-features';
import type { TripAction, TripSession } from './trip-engine';
import { validTravelDate } from './trip-extensions';
type Invalid=(message?:string)=>never;
const object=(value:unknown)=>!!value&&typeof value==='object'&&!Array.isArray(value);
const id=(value:unknown,max=160)=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9_-]+$/.test(value);
const integer=(value:unknown,min:number,max:number)=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max;
const region=(value:unknown)=>value===null||REGIONS.includes(value as typeof REGIONS[number]);
const iso=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)&&Number.isFinite(Date.parse(value));
export function parseTripLocalAction(a:Record<string,unknown>,invalid:Invalid):TripAction|undefined {
  if(!isTripLocalAction(a as {type:string}))return;
  const allowed:Record<string,string[]>={'saved-filter':['region'],'plan-status':['status'],'continue-trip':[],'offline-save':['id'],'offline-open':['id'],'offline-remove':['id'],'offline-library':[]};
  if(Object.keys(a).some(key=>key!=='type'&&!allowed[String(a.type)].includes(key)))invalid();
  if(a.type==='saved-filter'&&!region(a.region))invalid();
  if(a.type==='plan-status'&&!['DRAFT','READY'].includes(String(a.status)))invalid();
  if(a.type==='offline-save'&&a.id!==undefined&&!id(a.id))invalid();
  if(['offline-open','offline-remove'].includes(String(a.type))&&!id(a.id,180))invalid();
  return a as unknown as TripAction;
}
export function validateTripLocalState(s:Record<string,unknown>,invalid:Invalid) {
  if(s.planStatus!==undefined&&!['DRAFT','READY'].includes(String(s.planStatus)))invalid();
  if(s.savedRegion!==undefined&&!region(s.savedRegion))invalid();
  if(s.offlinePackageId!==undefined&&s.offlinePackageId!==null&&!id(s.offlinePackageId,180))invalid();
}
export function validateTripLocalSession(s:Record<string,unknown>,validateVisits:(visits:unknown,days:number,region:unknown)=>unknown,invalid:Invalid) {
  if(s.recentPlanIds!==undefined&&(!Array.isArray(s.recentPlanIds)||s.recentPlanIds.length>50||new Set(s.recentPlanIds).size!==s.recentPlanIds.length||s.recentPlanIds.some(value=>!id(value))))invalid();
  if(s.offlineTrips===undefined)return;
  if(!Array.isArray(s.offlineTrips)||s.offlineTrips.length>MAX_OFFLINE_PACKAGES||new TextEncoder().encode(JSON.stringify(s.offlineTrips)).byteLength>MAX_OFFLINE_BYTES)invalid();
  const packages=s.offlineTrips as Record<string,unknown>[];
  const packageIds=new Set<string>(),sourceIds=new Set<string>();
  for(const p of packages) {
    if(!object(p)||Object.keys(p).some(key=>!['id','sourcePlanId','title','region','days','startDate','status','capturedAt','visits','points'].includes(key))||!id(p.id,180)||!id(p.sourcePlanId)||packageIds.has(String(p.id))||sourceIds.has(String(p.sourcePlanId))||!text(p.title,200)||!String(p.title).trim()||!region(p.region)||p.region===null||!integer(p.days,1,30)||p.status!=='READY'||!iso(p.capturedAt))invalid();
    packageIds.add(String(p.id));sourceIds.add(String(p.sourcePlanId));
    if(p.startDate!==undefined&&p.startDate!==null&&!validTravelDate(p.startDate))invalid();
    if(!Array.isArray(p.visits)||p.visits.length>180||!p.visits.length)invalid();
    const visits=p.visits as Record<string,unknown>[];
    const original=visits.map(v=>{if(!object(v)||Object.keys(v).some(key=>!['id','day','kind','entityId','anchorId','label','locked','status','note','time','durationMinutes','nights','name','address'].includes(key))||!text(v.name,200)||!String(v.name).trim()||v.address!==undefined&&!text(v.address,500))invalid();const {name:_name,address:_address,...fields}=v;return fields;});
    validateVisits(original,Number(p.days),p.region);
    if(!Array.isArray(p.points)||p.points.length>180)invalid();
    const pointIds=new Set<string>();
    for(const point of p.points as Record<string,unknown>[]) {
      if(!object(point)||Object.keys(point).some(key=>!['visitId','entityId','day','sequence','name','latitude','longitude','sourceTitle','checkedAt'].includes(key))||!id(point.visitId)||pointIds.has(String(point.visitId))||!id(point.entityId)||!integer(point.day,1,Number(p.days))||!integer(point.sequence,1,visits.length)||!text(point.name,200)||typeof point.latitude!=='number'||!Number.isFinite(point.latitude)||point.latitude< -90||point.latitude>90||typeof point.longitude!=='number'||!Number.isFinite(point.longitude)||point.longitude< -180||point.longitude>180||!text(point.sourceTitle,200)||!text(point.checkedAt,10)||!/^\d{4}-\d{2}-\d{2}$/.test(String(point.checkedAt)))invalid();
      const visit=visits[Number(point.sequence)-1];if(visit.id!==point.visitId||visit.entityId!==point.entityId||visit.day!==point.day)invalid();pointIds.add(String(point.visitId));
    }
  }
}
