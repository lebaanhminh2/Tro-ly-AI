export type ScheduleEntry={kind:'action';message:string}|{kind:'setup';message:string}|{kind:'help'}|{kind:'cancel'}|{kind:'open'};
export function scheduleEntry(text:string):ScheduleEntry|null{
 const input=text.trim();
 if(/^\/\s+\S/.test(input))return {kind:'action',message:input.replace(/^\/\s+/,'')};
 const setup=/^\/lich(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i.exec(input);
 if(setup)return {kind:'setup',message:(setup[1]??'').trim()};
 if(/^\/huongdan(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'help'};
 if(/^\/huy(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'cancel'};
 if(/^\/kiemtra(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'open'};
 return null;
}
