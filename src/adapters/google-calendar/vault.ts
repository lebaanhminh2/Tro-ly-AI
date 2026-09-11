import {CalendarError} from '../../domain/calendar.ts';
import type {TokenVault} from '../../ports/calendar.ts';
function hex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
function unhex(s:string){if(!/^(?:[a-f0-9]{2})+$/.test(s))throw new CalendarError('INVALID_CIPHER');return Uint8Array.from(s.match(/../g)!,x=>parseInt(x,16));}
export function randomSecret(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
export async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export class GoogleTokenVault implements TokenVault {
  private key:Promise<CryptoKey>;
  constructor(keyHex:string){if(!/^[a-f0-9]{64}$/.test(keyHex))throw new CalendarError('INVALID_ENCRYPTION_KEY');this.key=crypto.subtle.importKey('raw',unhex(keyHex),'AES-GCM',false,['encrypt','decrypt']);}
  async seal(owner:string,token:string){
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(`google:v1:${owner}`)},await this.key,new TextEncoder().encode(token));
    return `v1.${hex(iv)}.${hex(new Uint8Array(ciphertext))}`;
  }
  async open(owner:string,cipher:string){
    try {const [version,iv,body,...extra]=cipher.split('.');if(version!=='v1'||!iv||iv.length!==24||!body||extra.length)throw Error();
      return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unhex(iv),additionalData:new TextEncoder().encode(`google:v1:${owner}`)},await this.key,unhex(body)));
    }catch{throw new CalendarError('TOKEN_DECRYPT_FAILED');}
  }
}
