// The browser sends Telegram's original initData, never a trusted owner field.
// No credentials or initData are logged or put into URLs.
async function hmac(key:Uint8Array,message:string){
 const imported=await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',imported,new TextEncoder().encode(message)));
}
function equal(a:string,b:string){
 if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
export async function verifyMiniApp(initData:string,botToken:string,owner:string,now:number){
 if(!initData||initData.length>12000||!/^\d+$/.test(owner)||!botToken||!Number.isFinite(now))throw Error('MINI_APP_UNAUTHORIZED');
 const params=new URLSearchParams(initData),seen=new Set<string>();
 for(const [key] of params){if(seen.has(key))throw Error('MINI_APP_UNAUTHORIZED');seen.add(key);}
 const hash=params.get('hash')??'',date=params.get('auth_date')??'';
 if(!/^[a-f0-9]{64}$/.test(hash)||!/^\d{1,12}$/.test(date))throw Error('MINI_APP_UNAUTHORIZED');
 const age=Math.floor(now/1000)-Number(date);
 if(age< -30||age>900)throw Error('MINI_APP_EXPIRED');
 const data=[...params.entries()].filter(([key])=>key!=='hash').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>key+'='+value).join('\n');
 const secret=await hmac(new TextEncoder().encode('WebAppData'),botToken);
 const digest=await hmac(secret,data);
 const expected=[...digest].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(!equal(hash,expected))throw Error('MINI_APP_UNAUTHORIZED');
 let user:unknown;try{user=JSON.parse(params.get('user')??'');}catch{throw Error('MINI_APP_UNAUTHORIZED');}
 if(!user||typeof user!=='object'||!('id' in user)||!Number.isSafeInteger(user.id)||String(user.id)!==owner)throw Error('MINI_APP_UNAUTHORIZED');
 return {owner,authenticatedAt:Number(date)*1000};
}
