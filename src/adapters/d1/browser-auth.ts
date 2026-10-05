import {query,type Database} from './database.ts';

const PAIR_COOKIE='__Host-minh-anh-pair';
const SESSION_COOKIE='__Host-minh-anh-session';
const PAIR_TTL=10*60000,SESSION_TTL=30*86400000;
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
function cookie(request:Request,name:string){
 const values=(request.headers.get('Cookie')??'').split(';').map(part=>part.trim()).filter(part=>part.startsWith(name+'='));
 if(values.length!==1)return null;
 const value=values[0]!.slice(name.length+1);return /^[a-f0-9]{64}$/.test(value)?value:null;
}
const setCookie=(name:string,value:string,seconds:number)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
function response(data:unknown,status=200,cookies:string[]=[]){
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const value of cookies)headers.append('Set-Cookie',value);
 return new Response(JSON.stringify(data),{status,headers});
}
export function browserWriteAllowed(request:Request){
 return request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('X-Minh-Anh-Request')==='1'&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
export async function browserOwner(db:Database,request:Request,expectedOwner:string,now:number){
 const value=cookie(request,SESSION_COOKIE);if(!value)return null;
 const row=await query(db,'SELECT owner FROM browser_sessions WHERE token_hash=? AND expires_at>?',await hash(value),now).first<{owner:string}>();
 return row?.owner===expectedOwner?row.owner:null;
}
export async function approveBrowserCode(db:Database,owner:string,expectedOwner:string,code:string,now:number){
 if(owner!==expectedOwner)return false;
 const normalized=code.toUpperCase().replace(/-/g,'');
 if(!/^[A-F0-9]{12}$/.test(normalized))return false;
 const result=await query(db,'UPDATE browser_pairings SET approved_owner=? WHERE code_hash=? AND expires_at>? AND consumed_at IS NULL AND (approved_owner IS NULL OR approved_owner=?)',owner,await hash(normalized),now,owner).run();
 return result.meta.changes===1;
}
export async function browserAuthApi(db:Database,request:Request,owner:string,now:number){
 const path=new URL(request.url).pathname;
 if(!['/api/browser-auth/start','/api/browser-auth/status','/api/browser-auth/logout'].includes(path))return response({error:'NOT_FOUND'},404);
 if(request.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 if(!browserWriteAllowed(request))return response({error:'FORBIDDEN'},403);
 if(path.endsWith('/logout')){
  const value=cookie(request,SESSION_COOKIE);
  if(value)await query(db,'DELETE FROM browser_sessions WHERE token_hash=?',await hash(value)).run();
  const pair=cookie(request,PAIR_COOKIE);
  if(pair)await query(db,'DELETE FROM browser_pairings WHERE verifier_hash=?',await hash(pair)).run();
  return response({authenticated:false},200,[setCookie(SESSION_COOKIE,'',0),setCookie(PAIR_COOKIE,'',0)]);
 }
 if(await browserOwner(db,request,owner,now))return response({authenticated:true});
 if(path.endsWith('/start')){
  const verifier=token(),code=token().slice(0,12).toUpperCase();
  const clientHash=await hash(request.headers.get('CF-Connecting-IP')??'local');
  await db.batch([query(db,'DELETE FROM browser_pairings WHERE expires_at<=?',now),query(db,'DELETE FROM browser_sessions WHERE expires_at<=?',now)]);
  const created=await query(db,`INSERT INTO browser_pairings(verifier_hash,code_hash,client_hash,created_at,expires_at)
   SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM browser_pairings WHERE client_hash=? AND created_at>?)<8
   AND (SELECT COUNT(*) FROM browser_pairings)<1000`,await hash(verifier),await hash(code),clientHash,now,now+PAIR_TTL,clientHash,now-PAIR_TTL).run();
  if(!created.meta.changes)return response({error:'LOGIN_RATE_LIMIT',message:'Cậu đã tạo nhiều mã. Chờ vài phút rồi thử lại nhé.'},429);
  return response({authenticated:false,code:code.match(/.{4}/g)!.join('-'),expiresAt:now+PAIR_TTL},200,[setCookie(PAIR_COOKIE,verifier,PAIR_TTL/1000)]);
 }
 const verifier=cookie(request,PAIR_COOKIE);if(!verifier)return response({error:'LOGIN_EXPIRED'},401);
 const verifierHash=await hash(verifier);
 const pair=await query(db,'SELECT approved_owner,expires_at,consumed_at FROM browser_pairings WHERE verifier_hash=? AND expires_at>?',verifierHash,now).first<{approved_owner:string|null;expires_at:number;consumed_at:number|null}>();
 if(!pair||pair.consumed_at!==null)return response({error:'LOGIN_EXPIRED'},401);
 if(pair.approved_owner!==owner)return response({authenticated:false,expiresAt:pair.expires_at});
 const session=token(),sessionHash=await hash(session);
 const results=await db.batch([
  query(db,'INSERT INTO browser_sessions(token_hash,owner,created_at,expires_at) SELECT ?,approved_owner,?,? FROM browser_pairings WHERE verifier_hash=? AND approved_owner=? AND consumed_at IS NULL AND expires_at>?',sessionHash,now,now+SESSION_TTL,verifierHash,owner,now),
  query(db,'UPDATE browser_pairings SET consumed_at=? WHERE verifier_hash=? AND EXISTS(SELECT 1 FROM browser_sessions WHERE token_hash=?)',now,verifierHash,sessionHash)
 ]);
 if(!(results[0] as {meta:{changes:number}}).meta.changes)return response({error:'LOGIN_EXPIRED'},401);
 return response({authenticated:true},200,[setCookie(SESSION_COOKIE,session,SESSION_TTL/1000),setCookie(PAIR_COOKIE,'',0)]);
}
