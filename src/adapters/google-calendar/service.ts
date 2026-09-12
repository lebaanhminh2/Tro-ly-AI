import type {Database,Statement} from '../d1/database.ts';
import {query} from '../d1/database.ts';
import type {CalendarProvider,TokenProvider,TokenVault} from '../../ports/calendar.ts';
import {CalendarError,object,string,eventInterval,overlaps,slots} from '../../domain/calendar.ts';
import type {CalendarRef,Connection,Interval} from '../../domain/calendar.ts';
import type {Input,View} from '../../domain/work.ts';
import type {Session} from '../../domain/session.ts';
import {digest,randomSecret} from './vault.ts';

type Write = {id:string;owner:string;session_id:string;session_version:number;connection_revision:number;calendar_id:string;event_id:string;start_at:number;end_at:number;status:string;attempts:number;etag:string|null};
type SlotProposal = {id:string;owner:string;session_id:string;session_version:number;connection_revision:number;start_at:number;end_at:number;expires:number;status:string};
export class CalendarService {
  constructor(privateOptions:{db:Database;provider:CalendarProvider;tokens:TokenProvider;vault:TokenVault;owner:string;origin:string;writes:boolean;now:()=>number}) {
    const origin=new URL(privateOptions.origin);
    if(origin.protocol!=='https:'||origin.origin!==privateOptions.origin||!/^\d+$/.test(privateOptions.owner))throw new CalendarError('INVALID_CALENDAR_CONFIG');
    this.options=privateOptions;
  }
  private options:{db:Database;provider:CalendarProvider;tokens:TokenProvider;vault:TokenVault;owner:string;origin:string;writes:boolean;now:()=>number};
  private q(sql:string,...args:(string|number|null)[]){return query(this.options.db,sql,...args);}
  private connection(){return this.q('SELECT * FROM calendar_connections WHERE owner=?',this.options.owner).first<Connection>();}
  private async token(){
    const c=await this.connection();
    if(!c||c.status!=='ready'||!c.refresh_cipher)throw new CalendarError('CONNECT_REQUIRED');
    try{return {connection:c,access:await this.options.tokens.refresh(await this.options.vault.open(c.owner,c.refresh_cipher))};}
    catch(e){
      if(e instanceof CalendarError&&['GOOGLE_HTTP_400','GOOGLE_HTTP_401'].includes(e.message))await this.q("UPDATE calendar_connections SET status='reconnect' WHERE owner=? AND revision=?",c.owner,c.revision).run();
      throw e;
    }
  }
  private async lock<T>(fn:(fence:()=>Statement)=>Promise<T>,authority?:{token:string}):Promise<T>{
    const token=randomSecret(),owner=this.options.owner,now=this.options.now();
    const result=await this.q(`INSERT INTO calendar_leases(owner,token,expires) VALUES(?,?,?) ON CONFLICT(owner)
      DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE calendar_leases.expires<=?`,owner,token,now+90000,now).run();
    if(!result.meta.changes)throw new CalendarError('CALENDAR_BUSY');
    const fence=()=>this.q(`INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM calendar_leases WHERE owner=? AND token=? AND expires>?)
      AND (? IS NULL OR EXISTS(SELECT 1 FROM owner_leases WHERE owner=? AND token=? AND expires>?)) THEN 1 ELSE 0 END`,owner,token,this.options.now(),authority?.token??null,owner,authority?.token??null,this.options.now());
    try{return await fn(fence);}finally{await this.q('DELETE FROM calendar_leases WHERE owner=? AND token=?',owner,token).run();}
  }
  private async checkConnection(revision:number){
    const c=await this.connection();if(!c||c.status!=='ready'||c.revision!==revision)throw new CalendarError('CONNECTION_CHANGED');return c;
  }
  async connectLink(authority?:{token:string}):Promise<string>{
    return this.lock(async fence=>{
      const owner=this.options.owner,old=await this.connection();
      if(old?.status==='ready')throw new CalendarError('DISCONNECT_BEFORE_RELINK');
      const revision=(old?.revision??0)+1,ticket=randomSecret();
      await this.options.db.batch([fence(),
        this.q(`INSERT INTO calendar_connections(owner,revision,status) VALUES(?,?,'authorizing') ON CONFLICT(owner)
          DO UPDATE SET revision=excluded.revision,status='authorizing',refresh_cipher=NULL,managed_id=NULL`,owner,revision),
        this.q('DELETE FROM calendar_oauth WHERE owner=?',owner),
        this.q('UPDATE calendars SET selected=0,managed=0,synced_at=NULL,sync_token=NULL WHERE owner=?',owner),
        this.q('INSERT INTO calendar_oauth(hash,owner,revision,phase,expires) VALUES(?,?,?,?,?)',await digest(ticket),owner,revision,'ticket',this.options.now()+600000),
        this.q('DELETE FROM transaction_guard')]);
      return `${this.options.origin}/oauth/google/start?ticket=${ticket}`;
    },authority);
  }
  async start(ticket:string){
    if(!/^[a-f0-9]{64}$/.test(ticket))throw new CalendarError('INVALID_OAUTH');
    const row=await this.q("UPDATE calendar_oauth SET phase='used' WHERE hash=? AND phase='ticket' AND expires>? RETURNING owner,revision",await digest(ticket),this.options.now()).first<{owner:string;revision:number}>();
    if(!row||row.owner!==this.options.owner)throw new CalendarError('INVALID_OAUTH');
    const state=randomSecret(),browser=randomSecret();
    await this.q('INSERT INTO calendar_oauth(hash,owner,revision,phase,browser_hash,expires) VALUES(?,?,?,?,?,?)',await digest(state),row.owner,row.revision,'callback',await digest(browser),this.options.now()+600000).run();
    return {url:this.options.tokens.authorize(state),browser};
  }
  async callback(state:string,browser:string,code:string){
    if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(browser)||!code||code.length>4096)throw new CalendarError('INVALID_OAUTH');
    const row=await this.q(`UPDATE calendar_oauth SET phase='used' WHERE hash=? AND browser_hash=? AND phase='callback' AND expires>?
      RETURNING owner,revision`,await digest(state),await digest(browser),this.options.now()).first<{owner:string;revision:number}>();
    if(!row||row.owner!==this.options.owner)throw new CalendarError('INVALID_OAUTH');
    const refresh=await this.options.tokens.exchange(code),cipher=await this.options.vault.seal(row.owner,refresh);
    const changed=await this.q("UPDATE calendar_connections SET refresh_cipher=?,status='ready' WHERE owner=? AND revision=? AND status='authorizing'",cipher,row.owner,row.revision).run();
    if(!changed.meta.changes)throw new CalendarError('OAUTH_SUPERSEDED');
  }
  private async disconnect(){
    const c=await this.connection();
    await this.options.db.batch([
      this.q("UPDATE calendar_connections SET refresh_cipher=NULL,status='disconnected',revision=revision+1,managed_id=NULL WHERE owner=?",this.options.owner),
      this.q('DELETE FROM calendar_oauth WHERE owner=?',this.options.owner),
      this.q("UPDATE calendar_writes SET status='cancelled' WHERE owner=? AND status IN ('pending','uncertain')",this.options.owner),
      this.q("UPDATE calendar_proposals SET status='cancelled' WHERE owner=? AND status='pending'",this.options.owner)
    ]);
    if(c?.refresh_cipher){try{await this.options.tokens.revoke(await this.options.vault.open(c.owner,c.refresh_cipher));}catch{return 'Đã ngắt kết nối trong bot. Thu hồi ở Google chưa xác nhận; cậu kiểm tra quyền ứng dụng trong tài khoản Google.';}}
    return 'Đã ngắt kết nối và thu hồi quyền Google. Không xóa sự kiện đã tạo.';
  }
  private async discover(){
    const {connection:c,access}=await this.token(),refs=await this.options.provider.calendars(access);
    await this.checkConnection(c.revision);
    for(const r of refs)await this.q(`INSERT INTO calendars(id,owner,external_id,name) VALUES(?,?,?,?)
      ON CONFLICT(owner,external_id) DO UPDATE SET name=excluded.name`,crypto.randomUUID().replaceAll('-',''),c.owner,r.id,r.summary).run();
  }
  private async refs(){return (await this.q('SELECT * FROM calendars WHERE owner=? ORDER BY name,id',this.options.owner).all<CalendarRef>()).results;}
  private async setup(fence:()=>Statement){
    if(!this.options.writes)throw new CalendarError('WRITES_DISABLED');
    const {connection:c,access}=await this.token();
    if(c.managed_id==='creating')throw new CalendarError('CALENDAR_CREATION_UNCERTAIN');
    if(c.managed_id)return 'Assistant Plan đã được tạo.';
    // calendars.insert has no client ID: never retry an uncertain creation automatically.
    await this.options.db.batch([fence(),this.q("UPDATE calendar_connections SET managed_id='creating' WHERE owner=? AND revision=? AND managed_id IS NULL",c.owner,c.revision),this.q('DELETE FROM transaction_guard')]);
    let id:string;
    try{id=await this.options.provider.createCalendar(access);}catch{throw new CalendarError('CALENDAR_CREATION_UNCERTAIN');}
    const changed=await this.q("UPDATE calendar_connections SET managed_id=? WHERE owner=? AND revision=? AND managed_id='creating'",id,c.owner,c.revision).run();
    if(!changed.meta.changes)throw new CalendarError('CONNECTION_CHANGED');
    await this.q(`INSERT INTO calendars(id,owner,external_id,name,managed,selected) VALUES(?,?,?,'Assistant Plan',1,1)
      ON CONFLICT(owner,external_id) DO UPDATE SET managed=1,selected=1`,crypto.randomUUID().replaceAll('-',''),c.owner,id).run();
    return 'Đã tạo Assistant Plan. Bot chỉ ghi buổi đã xác nhận vào lịch này.';
  }
  async synchronize(){
    return this.lock(async fence=>{
      const {connection:c,access}=await this.token();
      for(const ref of (await this.refs()).filter(r=>r.selected)){
        let full=!ref.sync_token,page='',nextSync:string|undefined,items:unknown[]=[],restarted=false;
        try{
          for(let n=0;n<10;n++){
            let data;
            try{data=await this.options.provider.events(access,ref.external_id,{maxResults:'100',singleEvents:'false',showDeleted:'true',...(!full?{syncToken:ref.sync_token!}:{}),...(page?{pageToken:page}:{})});}
            catch(e){if(!restarted&&e instanceof CalendarError&&e.message==='GOOGLE_HTTP_410'){full=true;page='';items=[];restarted=true;continue;}throw e;}
            items.push(...data.items);
            if(items.length>1000)throw new CalendarError('SYNC_PAGE_LIMIT');
            if(data.nextPageToken){page=data.nextPageToken;continue;}
            nextSync=data.nextSyncToken;break;
          }
          if(!nextSync)throw new CalendarError('SYNC_INCOMPLETE');
          await this.checkConnection(c.revision);
          const statements=[fence()];
          if(full)statements.push(this.q('DELETE FROM calendar_events WHERE calendar_id=?',ref.id));
          for(const raw of items){
            const e=object(raw),id=string(e.id);
            if(e.status==='cancelled')statements.push(this.q('DELETE FROM calendar_events WHERE calendar_id=? AND external_id=?',ref.id,id));
            else { // Persist only fields needed for calendar display, not descriptions/attendees.
              const cache={id,summary:typeof e.summary==='string'?e.summary.slice(0,160):'',start:e.start,end:e.end,recurrence:e.recurrence,recurringEventId:e.recurringEventId,originalStartTime:e.originalStartTime,etag:e.etag};
              statements.push(this.q('INSERT INTO calendar_events(calendar_id,external_id,payload) VALUES(?,?,?) ON CONFLICT(calendar_id,external_id) DO UPDATE SET payload=excluded.payload',ref.id,id,JSON.stringify(cache)));
            }
          }
          // Detect overrides from the complete sync result BEFORE committing the cursor.
          // Updating needs_review and cancelling reminders must be in the same transaction.
          const linked=(await this.q("SELECT * FROM calendar_writes WHERE owner=? AND calendar_id=? AND status='synced'",c.owner,ref.external_id).all<Write>()).results;
          const changed=new Map(items.map(raw=>{const e=object(raw);return [string(e.id),e] as const;}));
          for(const w of linked){
            let current=changed.get(w.event_id);
            if(!current&&!full){
              const cached=await this.q('SELECT payload FROM calendar_events WHERE calendar_id=? AND external_id=?',ref.id,w.event_id).first<{payload:string}>();
              if(cached)current=object(JSON.parse(cached.payload));
            }
            if(!current||current.status==='cancelled'||(w.etag&&current.etag!==w.etag)){
              statements.push(
                this.q("UPDATE calendar_writes SET status='needs_review' WHERE id=? AND owner=? AND status='synced'",w.id,c.owner),
                this.q("UPDATE sessions SET status='unknown',version=version+1 WHERE id=? AND owner=? AND version=? AND status='planned'",w.session_id,c.owner,w.session_version),
                this.q("UPDATE reminders SET status='cancelled' WHERE session_id=? AND owner=? AND status IN ('pending','queued')",w.session_id,c.owner),
                this.q("UPDATE outbox SET state='failed' WHERE state='pending' AND reminder_id IN (SELECT id FROM reminders WHERE session_id=? AND owner=?)",w.session_id,c.owner)
              );
            }
          }
          statements.push(this.q('UPDATE calendars SET sync_token=?,synced_at=?,revision=revision+1 WHERE id=? AND owner=?',nextSync,this.options.now(),ref.id,c.owner),this.q('DELETE FROM transaction_guard'));
          await this.options.db.batch(statements);
        }catch(e){await this.q('UPDATE calendars SET synced_at=NULL WHERE id=? AND owner=?',ref.id,c.owner).run();throw e;}
      }
    });
  }
  private async busy(access:string,range:Interval,ignoreEvent?:string):Promise<Interval[]>{
    const refs=(await this.refs()).filter(r=>r.selected);
    if(!refs.length||refs.some(r=>r.synced_at===null||this.options.now()-r.synced_at>300000))throw new CalendarError('SYNC_REQUIRED');
    const busy:Interval[]=[];
    for(const ref of refs){
      let page='',complete=false;
      for(let n=0;n<10;n++){
        const data=await this.options.provider.events(access,ref.external_id,{singleEvents:'true',showDeleted:'true',maxResults:'100',timeMin:new Date(range.start).toISOString(),timeMax:new Date(range.end).toISOString(),...(page?{pageToken:page}:{})});
        for(const event of data.items){const e=object(event);if(ignoreEvent&&e.id===ignoreEvent&&ref.managed)continue;const interval=eventInterval(e,data.timeZone??'Asia/Ho_Chi_Minh');if(interval)busy.push(interval);}
        if(!data.nextPageToken){complete=true;break;}page=data.nextPageToken;
      }
      if(!complete)throw new CalendarError('BUSY_PAGE_LIMIT');
    }
    return busy;
  }
  private async alternatives(sessionId:string):Promise<View>{
    const {connection:c,access}=await this.token();
    const s=await this.q('SELECT * FROM sessions WHERE owner=? AND id=?',c.owner,sessionId).first<Session>();
    if(!s||!['planned','draft'].includes(s.status))throw new CalendarError('SESSION_NOT_AVAILABLE');
    if(!c.managed_id||c.managed_id==='creating')throw new CalendarError('SETUP_REQUIRED');
    const now=this.options.now(),range={start:now+60000,end:now+7*86400000};
    const busy=await this.busy(access,range);
    const local=(await this.q("SELECT start_at,minutes FROM sessions WHERE owner=? AND id!=? AND status IN ('planned','running','paused')",c.owner,s.id).all<{start_at:number;minutes:number}>()).results;
    busy.push(...local.map(l=>({start:l.start_at,end:l.start_at+l.minutes*60000})));
    const p=await this.q('SELECT quiet_start,quiet_end,pause_until FROM reminder_preferences WHERE owner=?',c.owner).first<{quiet_start:number;quiet_end:number;pause_until:number}>();
    const choices=slots(Math.max(range.start,p?.pause_until??0),range.end,s.minutes,busy,p?.quiet_start??1320,p?.quiet_end??420);
    await this.checkConnection(c.revision);
    const buttons:View['buttons']=[];
    for(const slot of choices){const id=crypto.randomUUID().replaceAll('-','');
      await this.q('INSERT INTO calendar_proposals(id,owner,session_id,session_version,connection_revision,start_at,end_at,expires) VALUES(?,?,?,?,?,?,?,?)',id,c.owner,s.id,s.version,c.revision,slot.start,slot.end,now+300000).run();
      buttons.push([{text:new Date(slot.start+7*3600000).toISOString().slice(0,16).replace('T',' ')+' · '+s.minutes+' phút',callback_data:`cal-write:${id}`}]);
    }
    return {text:choices.length?'Chọn để XÁC NHẬN dời/chốt buổi và ghi vào Assistant Plan. Giờ Việt Nam; kiểm tra lại xung đột trước ghi.':'Chưa tìm thấy slot phù hợp; không lấy giờ nghỉ để lấp lịch.',buttons};
  }
  private async localAvailable(owner:string,session:Session,range:Interval){
    const local=(await this.q("SELECT start_at,minutes FROM sessions WHERE owner=? AND id!=? AND status IN ('planned','running','paused')",owner,session.id).all<{start_at:number;minutes:number}>()).results;
    const pref=await this.q('SELECT quiet_start,quiet_end,pause_until FROM reminder_preferences WHERE owner=?',owner).first<{quiet_start:number;quiet_end:number;pause_until:number}>();
    return (pref?.pause_until??0)<=range.start&&slots(range.start,range.end,session.minutes,local.map(l=>({start:l.start_at,end:l.start_at+l.minutes*60000})),pref?.quiet_start??1320,pref?.quiet_end??420).length>0;
  }
  private async confirm(id:string,fence:()=>Statement):Promise<string>{
    if(!this.options.writes)throw new CalendarError('WRITES_DISABLED');
    const {connection:c,access}=await this.token(),now=this.options.now();
    const p=await this.q('SELECT * FROM calendar_proposals WHERE owner=? AND id=?',c.owner,id).first<SlotProposal>();
    if(!p||p.status!=='pending'||p.expires<=now||p.connection_revision!==c.revision||!c.managed_id||c.managed_id==='creating')throw new CalendarError('STALE_CALENDAR_PROPOSAL');
    const s=await this.q('SELECT * FROM sessions WHERE owner=? AND id=?',c.owner,p.session_id).first<Session>();
    if(!s||s.version!==p.session_version||!['draft','planned'].includes(s.status))throw new CalendarError('SESSION_CHANGED');
    if(await this.q('SELECT id FROM calendar_writes WHERE owner=? AND session_id=?',c.owner,s.id).first())throw new CalendarError('SESSION_ALREADY_LINKED');
    if(p.start_at<=now||(await this.busy(access,{start:p.start_at-600000,end:p.end_at+600000})).some(b=>overlaps({start:p.start_at,end:p.end_at},b,600000)))throw new CalendarError('SLOT_CONFLICT');
    if(!await this.localAvailable(c.owner,s,{start:p.start_at,end:p.end_at}))throw new CalendarError('LOCAL_PLAN_CHANGED');
    const generation=s.generation+1,eventId='a'+id;
    await this.options.db.batch([fence(),
      this.q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM sessions WHERE id=? AND owner=? AND version=?) AND EXISTS(SELECT 1 FROM calendar_connections WHERE owner=? AND revision=? AND status='ready') THEN 1 ELSE 0 END",s.id,c.owner,s.version,c.owner,c.revision),
      this.q("UPDATE sessions SET start_at=?,status='planned',version=version+1,generation=? WHERE id=? AND owner=?",p.start_at,generation,s.id,c.owner),
      this.q("UPDATE reminders SET status='cancelled' WHERE session_id=? AND owner=? AND status IN ('pending','queued')",s.id,c.owner),
      ...[1,2].map(n=>this.q('INSERT INTO reminders(id,owner,session_id,generation,ordinal,due) VALUES(?,?,?,?,?,?)',`${s.id}:${generation}:${n}`,c.owner,s.id,generation,n,p.start_at+(n-1)*900000)),
      this.q('INSERT OR IGNORE INTO reminder_preferences(owner,quiet_start,quiet_end) VALUES(?,1320,420)',c.owner),
      this.q("UPDATE calendar_proposals SET status='accepted' WHERE id=? AND owner=?",id,c.owner),
      this.q('INSERT INTO calendar_writes(id,owner,session_id,session_version,connection_revision,calendar_id,event_id,start_at,end_at) VALUES(?,?,?,?,?,?,?,?,?)',id,c.owner,s.id,s.version+1,c.revision,c.managed_id,eventId,p.start_at,p.end_at),
      this.q('DELETE FROM transaction_guard')]);
    return 'Đã chốt buổi trong bot, đang chờ ghi Google Calendar. /calendar để kiểm tra; chưa báo đồng bộ thành công.';
  }
  async flushWrites(){
    if(!this.options.writes)return;
    return this.lock(async fence=>{
      const {connection:c,access}=await this.token();
      const jobs=(await this.q("SELECT * FROM calendar_writes WHERE owner=? AND status IN ('pending','uncertain') AND attempts<3 ORDER BY id LIMIT 1",c.owner).all<Write>()).results;
      for(const w of jobs){
        const guarded=async(statements:Statement[])=>{
          await this.options.db.batch([
            fence(),
            this.q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM calendar_connections WHERE owner=? AND revision=? AND status='ready' AND managed_id=?) AND EXISTS(SELECT 1 FROM calendar_writes WHERE id=? AND owner=? AND connection_revision=? AND status IN ('pending','uncertain')) THEN 1 ELSE 0 END",c.owner,c.revision,w.calendar_id,w.id,c.owner,c.revision),
            ...statements,this.q('DELETE FROM transaction_guard')
          ]);
        };
        await guarded([this.q('UPDATE calendar_writes SET attempts=attempts+1 WHERE id=? AND owner=?',w.id,c.owner)]);
        let mayHaveInserted=w.status==='uncertain';
        try{
          const s=await this.q('SELECT * FROM sessions WHERE owner=? AND id=?',c.owner,w.session_id).first<Session>();
          if(c.revision!==w.connection_revision||c.managed_id!==w.calendar_id||!s||s.version!==w.session_version||s.status!=='planned')throw new CalendarError('SESSION_CHANGED');
          let remote=await this.options.provider.getEvent(access,w.calendar_id,w.event_id);
          if(remote===null){
            if(mayHaveInserted)throw new CalendarError('UNCERTAIN_MISSING_EVENT');
            if(!await this.localAvailable(c.owner,s,{start:w.start_at,end:w.end_at}))throw new CalendarError('LOCAL_PLAN_CHANGED');
            if(this.options.now()>=w.start_at||(await this.busy(access,{start:w.start_at-600000,end:w.end_at+600000},w.event_id)).some(b=>overlaps({start:w.start_at,end:w.end_at},b,600000)))throw new CalendarError('SLOT_CONFLICT');
            // Validate lease/connection/session immediately before external write.
            await guarded([
              this.q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM sessions WHERE id=? AND owner=? AND version=? AND status='planned') THEN 1 ELSE 0 END",w.session_id,c.owner,w.session_version),
              this.q("UPDATE calendar_writes SET status='uncertain' WHERE id=? AND owner=?",w.id,c.owner)
            ]);
            mayHaveInserted=true;
            remote=await this.options.provider.insertEvent(access,w.calendar_id,w.event_id,{start:w.start_at,end:w.end_at},w.id);
          }
          const marker=object(object(remote.extendedProperties).private).assistantWrite;
          const interval=eventInterval(remote,'Asia/Ho_Chi_Minh');
          if(marker!==w.id||remote.id!==w.event_id||!interval||interval.start!==w.start_at||interval.end!==w.end_at)throw new CalendarError('REMOTE_CHANGED');
          await guarded([this.q("UPDATE calendar_writes SET status='synced',etag=? WHERE id=? AND owner=?",typeof remote.etag==='string'?remote.etag:null,w.id,c.owner)]);
        }catch(e){
          const code=e instanceof CalendarError?e.message:'UNKNOWN';
          const review=['SESSION_CHANGED','SLOT_CONFLICT','LOCAL_PLAN_CHANGED','REMOTE_CHANGED','UNCERTAIN_MISSING_EVENT','GOOGLE_HTTP_410'].includes(code);
          const permanent=['GOOGLE_HTTP_400','GOOGLE_HTTP_401','GOOGLE_HTTP_403'].includes(code);
          const status=review?'needs_review':mayHaveInserted?'uncertain':permanent||w.attempts+1>=3?'failed':'pending';
          // A stale worker cannot overwrite a new lease or disconnected/cancelled job, even on failure.
          await guarded([this.q('UPDATE calendar_writes SET status=? WHERE id=? AND owner=?',status,w.id,c.owner)]);
        }
      }
    });
  }
  async tick(){
    const c=await this.connection();if(c?.status!=='ready')return;
    const refs=(await this.refs()).filter(r=>r.selected);
    if(refs.some(r=>r.synced_at===null||this.options.now()-r.synced_at>=300000))await this.synchronize();
    await this.flushWrites();
  }
  async command(input:Input,authority?:{token:string}):Promise<View|null>{
    if(input.owner!==this.options.owner)throw new CalendarError('FORBIDDEN');
    const text=input.text??'',cb=input.callback??'';
    if(!text.startsWith('/calendar')&&!cb.startsWith('cal-'))return null;
    const view=(text:string):View=>({text,buttons:[]});
    try{
      if(text==='/calendar connect')return view(`Mở liên kết một lần để kết nối Google (10 phút): ${await this.connectLink(authority)}`);
      if(text==='/calendar sync'){await this.synchronize();await this.flushWrites();return view('Đã đồng bộ các lịch được chọn.');}
      return await this.lock(async fence=>{
        if(text==='/calendar disconnect'||text==='/calendar setup'){
          const action=text.endsWith('setup')?'setup':'disconnect',id=crypto.randomUUID().replaceAll('-','');
          await this.q('INSERT INTO calendar_control(id,owner,action,expires) VALUES(?,?,?,?)',id,input.owner,action,this.options.now()+300000).run();
          return {text:action==='setup'?'Tạo Calendar riêng Assistant Plan? Không sửa lịch ngoài.':'Ngắt bot khỏi Google và thu hồi token? Sự kiện Google đã tạo vẫn giữ.',buttons:[[{text:'Xác nhận',callback_data:`cal-control:${id}`}]]};
        }
        if(cb.startsWith('cal-control:')){
          await this.options.db.batch([fence(),this.q('DELETE FROM transaction_guard')]);
          const p=await this.q("UPDATE calendar_control SET status='used' WHERE id=? AND owner=? AND status='pending' AND expires>? RETURNING action",cb.slice(12),input.owner,this.options.now()).first<{action:string}>();
          if(!p)throw new CalendarError('CONFIRMATION_EXPIRED');return view(p.action==='setup'?await this.setup(fence):await this.disconnect());
        }
        if(text==='/calendar list')await this.discover();
        if(cb.startsWith('cal-toggle:'))throw new CalendarError('STALE_CALENDAR_CONTROL');
        if(cb.startsWith('cal-select:')){
          const match=/^cal-select:([01]):(.+)$/.exec(cb);
          if(!match)throw new CalendarError('INVALID_CALENDAR_CONTROL');
          const selected=Number(match[1]);
          const ref=await this.q('SELECT * FROM calendars WHERE owner=? AND id=?',input.owner,match[2]!).first<CalendarRef>();
          if(!ref||ref.managed)throw new CalendarError('CALENDAR_NOT_AVAILABLE');
          if(selected&&!ref.selected&&(await this.refs()).filter(r=>r.selected&&!r.managed).length>=3)throw new CalendarError('SELECTED_CALENDAR_LIMIT');
          await this.options.db.batch([fence(),this.q('UPDATE calendars SET selected=?,synced_at=NULL WHERE owner=? AND id=? AND selected!=?',selected,input.owner,ref.id,selected),this.q('DELETE FROM transaction_guard')]);
        }
        if(cb.startsWith('cal-plan:'))return this.alternatives(cb.slice(9));
        if(cb.startsWith('cal-write:'))return view(await this.confirm(cb.slice(10),fence));
        const refs=await this.refs(),c=await this.connection();
        const jobs=(await this.q('SELECT status,COUNT(*) AS n FROM calendar_writes WHERE owner=? GROUP BY status',input.owner).all<{status:string;n:number}>()).results;
        const sessions=(await this.q("SELECT id,minutes FROM sessions WHERE owner=? AND status IN ('draft','planned') ORDER BY start_at LIMIT 5",input.owner).all<{id:string;minutes:number}>()).results;
        const page=cb.startsWith('cal-page:')?Number(cb.slice(9)):0;
        if(!Number.isSafeInteger(page)||page<0||page>1000)throw new CalendarError('INVALID_PAGE');
        const external=refs.filter(r=>!r.managed);
        return {text:`Google: ${c?.status??'chưa kết nối'}. ${jobs.map(j=>`${j.status}: ${j.n}`).join(', ')}\n/calendar connect · /calendar list · /calendar setup · /calendar sync · /calendar disconnect\nChọn lịch đọc bên dưới; slot cần sync mới, chỉ là đề xuất.`,buttons:[
          ...external.slice(page,page+10).map(r=>[{text:`${r.selected?'✓':'○'} ${r.name}`,callback_data:`cal-select:${r.selected?0:1}:${r.id}`}]),
          ...(page>0?[[{text:'Trang trước',callback_data:`cal-page:${Math.max(0,page-10)}`}]]:[]),
          ...(external.length>page+10?[[{text:'Trang tiếp',callback_data:`cal-page:${page+10}`}]]:[]),
          ...sessions.map(s=>[{text:`Tìm slot cho buổi ${s.id} · ${s.minutes} phút`,callback_data:`cal-plan:${s.id}`}])
        ]};
      },authority);
    }catch(e){const code=e instanceof CalendarError?e.message:'CALENDAR_OPERATION_FAILED';return view(`Calendar chưa hoàn tất: ${code}. Không tự sửa lịch ngoài; kiểm tra /calendar hoặc kết nối lại.`);}
  }
}
