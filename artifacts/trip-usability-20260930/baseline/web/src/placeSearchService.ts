import { isRecord,requestJson,safeExternalUrl,ServiceError } from './serviceRequest.ts';
export interface ExternalPlaceResult { name:string;address:string;category:string;url:string }
export interface ExternalPlaceResponse { provider:'NAVER';items:ExternalPlaceResult[] }
export function validateExternalPlaces(value:unknown):ExternalPlaceResponse {
  if(!isRecord(value)||value.provider!=='NAVER'||!Array.isArray(value.items)||value.items.length>5)throw new ServiceError(502,'invalid-response');
  const items=value.items.map(item=>{
    if(!isRecord(item)||!['name','address','category'].every(k=>typeof item[k]==='string')||!safeExternalUrl(item.url))throw new ServiceError(502,'invalid-response');
    return {name:item.name as string,address:item.address as string,category:item.category as string,url:safeExternalUrl(item.url)!};
  });
  return {provider:'NAVER',items};
}
export async function searchExternalPlaces(endpoint:string,query:string,signal:AbortSignal):Promise<ExternalPlaceResponse> {
  const q=query.trim();if(!q||q.length>100)throw new ServiceError(400,'query');
  return validateExternalPlaces(await requestJson(`${endpoint}${endpoint.includes('?')?'&':'?'}query=${encodeURIComponent(q)}`,{signal}));
}
