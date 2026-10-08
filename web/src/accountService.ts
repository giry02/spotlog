/** Legacy contract retained for compatibility tests. Customer UI uses the unified EMAIL/GOOGLE/APPLE adapter in socialAccountService.ts. */
import { isRecord,requestJson,ServiceError,servicePath } from './serviceRequest.ts';
export interface AccountUser {id:string;displayName:string;email:string}
export interface AccountAdapter {
  configured:boolean;
  termsUrl?:string;privacyUrl?:string;
  session(signal:AbortSignal):Promise<AccountUser|null>;
  signIn(email:string,password:string,signal:AbortSignal):Promise<AccountUser>;
  signUp(input:{email:string;password:string;displayName:string;acceptedTerms:true},signal:AbortSignal):Promise<void>;
  resetPassword(email:string,signal:AbortSignal):Promise<void>;
  signOut(signal:AbortSignal):Promise<void>;
  removeAccount(signal:AbortSignal):Promise<void>;
}
export function validateAccountUser(value:unknown):AccountUser {
  if(!isRecord(value)||!['id','displayName','email'].every(k=>typeof value[k]==='string'&&String(value[k]).trim()))throw new ServiceError(502,'invalid-account');
  return {id:value.id as string,displayName:value.displayName as string,email:value.email as string};
}
export function createAccountAdapter(endpoint:string,policy:{termsUrl?:string;privacyUrl?:string}={}):AccountAdapter {
  const call=(suffix:string,signal:AbortSignal,body?:unknown)=>requestJson(`${servicePath(endpoint)}${suffix}`,{signal,method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Requested-With':'Spotlog'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {configured:Boolean(endpoint),...policy,
    async session(signal){if(!endpoint)return null;try{const value=await call('/session',signal);return value===null?null:validateAccountUser(value);}catch(error){if(error instanceof ServiceError&&error.status===401)return null;throw error;}},
    async signIn(email,password,signal){return validateAccountUser(await call('/sign-in',signal,{email,password}));},
    async signUp(input,signal){await call('/sign-up',signal,input);},
    async resetPassword(email,signal){await call('/password-reset',signal,{email});},
    async signOut(signal){await call('/sign-out',signal,{});},
    async removeAccount(signal){await call('/delete',signal,{confirmed:true});},
  };
}
