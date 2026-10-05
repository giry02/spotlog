/** Stop waiting even when an adapter ignores cancellation; never apply its late result. */
export function withRequestDeadline<T>(operation:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal,timeoutMs=20000):Promise<T> {
  return new Promise<T>((resolve,reject)=>{
    const inner=new AbortController();let settled=false;
    const finish=(error:unknown,value?:T,success=false)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
      if(!success){inner.abort();reject(error);}else resolve(value as T);
    };
    const abort=()=>finish(new DOMException('Cancelled','AbortError'));
    const timer=setTimeout(()=>finish(new Error('응답이 늦어지고 있어요. 입력을 유지했으니 다시 시도해 주세요.')),timeoutMs);
    if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>operation(inner.signal)).then(value=>finish(null,value,true),error=>finish(error));
  });
}
