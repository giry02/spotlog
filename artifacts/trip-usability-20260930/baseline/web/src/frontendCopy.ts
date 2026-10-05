import { useCallback } from 'react';
import { useLocale } from './locale';
import translations from './frontend-copy.en.json';
const english:Record<string,string>=translations;
/** Only explicitly named interface copy. Never applied to user content or place data. */
export function interfaceCopy(locale:'ko'|'en',text:string):string {return locale==='en'?(english[text]??text):text;}
export function useUiCopy(){const {locale}=useLocale();return useCallback((text:string)=>interfaceCopy(locale,text),[locale]);}
