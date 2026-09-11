export type Session = { id:string; owner:string; task_id:string; start_at:number; minutes:number;
  status:'draft'|'planned'|'running'|'paused'|'completed'|'skipped'|'unknown';
  version:number; generation:number; expires:number; active_since:number|null; spent_ms:number };
export type Preferences = { owner:string; quiet_start:number; quiet_end:number; pause_until:number };
export type SessionChange =
  | {type:'session-input';taskId:string;expires:number}
  | {type:'session-create';session:Session}
  | {type:'session-action';session:Session;action:'confirm'|'start'|'pause'|'finish'|'skip'|'snooze';now:number}
  | {type:'preferences';preferences:Preferences};
export function dayStart(now:number) {return Math.floor((now+7*3600000)/86400000)*86400000-7*3600000;}
export function quiet(now:number,p:Pick<Preferences,'quiet_start'|'quiet_end'>) {
  const minute=Math.floor(((now+7*3600000)%86400000)/60000);
  return p.quiet_start===p.quiet_end ? false : p.quiet_start<p.quiet_end
    ? minute>=p.quiet_start&&minute<p.quiet_end : minute>=p.quiet_start||minute<p.quiet_end;
}
export function sessionButtons(s:Session) {
  const button=(text:string,action:string)=>({text,callback_data:`s:${action}:${s.id}:${s.version}`});
  if(s.status==='draft') return [[button('Chốt buổi','confirm'),button('Thôi','skip')]];
  if(['completed','skipped'].includes(s.status))return [];
  return [[button(s.status==='paused'?'Làm tiếp':'Bắt đầu','start'),button('+15 phút','snooze')],
    [button('Tạm dừng','pause'),button('Kết thúc buổi','finish'),button('Bỏ buổi','skip')]];
}
export function canAct(s:Session,action:string,now:number) {
  if(action==='confirm') return s.status==='draft'&&s.expires>now&&s.start_at>=now;
  if(action==='skip')return !['completed','skipped'].includes(s.status);
  if(action==='start')return ['planned','paused','unknown'].includes(s.status);
  if(action==='pause')return s.status==='running';
  if(action==='finish')return ['running','paused'].includes(s.status);
  if(action==='snooze')return ['planned','paused','unknown'].includes(s.status);
  return false;
}
