export class ServiceError extends Error {
  status:number;
  constructor(status:number,message:string){super(message);this.name='ServiceError';this.status=status;}
}
export const ACCOUNT_EXPIRED_EVENT = 'spotlog:account-expired';
/** Relative, same-origin service paths only; provider credentials stay on the server. */
export function servicePath(path:string):string {
  if(!path.startsWith('/')||path.startsWith('//')||/[\\\r\n#]/.test(path))throw new ServiceError(0,'unconfigured');
  return path;
}
export async function requestJson(path:string,options:RequestInit={},timeoutMs=12000):Promise<unknown> {
  servicePath(path);
  const controller=new AbortController();
  const abort=()=>controller.abort(options.signal?.reason);
  if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  const headers=new Headers(options.headers);if(!headers.has('Accept'))headers.set('Accept','application/json');
  try {
    const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',headers,signal:controller.signal});
    if(!response.ok){
      // A rejected member operation invalidates the shared customer identity.
      if(response.status===401 && !path.startsWith('/api/admin/') && typeof window!=='undefined')window.dispatchEvent(new Event(ACCOUNT_EXPIRED_EVENT));
      throw new ServiceError(response.status,'request-failed');
    }
    if(response.status===204)return null;
    try{return await response.json();}catch{if(controller.signal.aborted)throw controller.signal.reason;throw new ServiceError(502,'invalid-response');}
  }catch(error){if(timedOut)throw new ServiceError(504,'timeout');throw error;}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
export const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function safeExternalUrl(value:unknown):string|null {
  if(typeof value!=='string')return null;
  try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
