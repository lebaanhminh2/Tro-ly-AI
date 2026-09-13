import {realms} from '../api.js';
export function renderAchievements(ui){
 const {el,button,heading,card}=ui,root=el('section');
 root.append(heading('Tích lũy từng ngày.','Không cần hoàn hảo. Chỉ cần tiếp tục.'));
 const stats=el('div',undefined,'stats');
 for(const [value,label,suffix] of [['8','Hoàn thành tuần này','việc'],['3/4','Hoàn thành đúng hạn','việc có hạn']]){
  const c=card();const n=el('p',value,'stat-value');n.append(el('small',' '+suffix));c.append(el('p',label,'stat-label'),n);stats.append(c);
 }root.append(stats);
 const chart=card();chart.append(el('h2','Nhịp làm việc'));
 const bars=el('div',undefined,'chart');bars.setAttribute('role','img');bars.setAttribute('aria-label','Dữ liệu mẫu: thứ Hai đến Chủ nhật hoàn thành lần lượt 1, 2, 0, 1, 1, 2, 1 việc.');
 [1,2,0,1,1,2,1].forEach((n,i)=>{const col=el('div',undefined,'chart-col'),bar=el('div',undefined,'chart-bar');bar.style.height=(n*34+3)+'px';col.append(el('span',String(n)),bar,el('span',['T2','T3','T4','T5','T6','T7','CN'][i]));bars.append(col);});chart.append(bars);root.append(chart);
 const c=ui.cultivation(),current=realms[c.rank],next=realms[c.rank+1];
 const title=el('div',undefined,'section-heading');title.append(el('h2','Tu luyện cùng Minh Anh'),el('span','DEMO','pill'));root.append(title);
 const rank=el('article',undefined,'rank-card');
 rank.append(el('div','✧','rank-seal'),el('p','CẢNH GIỚI HIỆN TẠI','eyebrow'),el('h2',current.name),el('p','Đỉnh cao từng đạt: '+realms[c.highestRank].name));
 if(c.protectedUntil>Date.now())rank.append(el('p','🛡 Miễn hạ bậc đến '+new Date(c.protectedUntil).toLocaleString('vi-VN'),'protection'));
 rank.append(button('Xem thẻ thành tích',()=>ui.openShare(),'text-button'));root.append(rank);
 const balances=el('div',undefined,'stats');
 for(const [value,label] of [[c.qi,'Tu vi hiện tại'],[c.totalEarned,'Tổng tu vi từng kiếm']]){
  const box=card();box.append(el('p',label,'stat-label'),el('p',String(value),'stat-value'));balances.append(box);
 }root.append(balances);
 root.append(el('p','Tổng tích lũy không giảm khi bị phạt. Chỉ tu vi hiện tại dùng để xét đột phá.','footer-note'));
 if(next){
  const target=card();target.append(el('p','ĐỘT PHÁ TIẾP THEO','eyebrow'),el('h2',next.name),el('p',c.qi+'/'+next.qi+' tu vi · '+c.streak+'/'+next.days+' ngày đúng giờ','subtitle'));
  const track=el('div',undefined,'track'),fill=el('span');fill.style.width=Math.min(100,100*Math.min(c.qi/next.qi,c.streak/next.days))+'%';track.append(fill);target.append(track);
  const attempt=button('Thử đột phá',()=>ui.openBreakthrough(),'primary');attempt.disabled=c.qi<next.qi||c.streak<next.days||c.attemptDay===ui.demoDay();target.append(attempt);
  target.append(el('p',c.attemptDay===ui.demoDay()?'Đã thử hôm nay · ngày mới mới được thử tiếp.':'Mỗi ngày 1 lần · thất bại không mất tu vi.','hint'));root.append(target);
 }
 const tools=el('div',undefined,'reward-tools');tools.append(button('✦ Quay thưởng · '+c.tickets+' vé',()=>ui.openDraw(),'primary'),button('▣ Túi vật phẩm',()=>ui.openInventory(),'secondary'));root.append(tools);
 const rules=card();rules.append(el('h3','Nhịp ngủ & tu vi'),el('p','Đúng giờ +5 · Muộn −20','subtitle'),el('p','Ngoài bảo vệ: tu vi âm hạ ngay 1 bậc. Trong 72 giờ sau đột phá: vẫn trừ, không hạ bậc.','hint'),el('p','Chưa mô phỏng phạt: còn chờ chốt số dư âm sau xử lý và trường hợp không báo /ngu.','footer-note'));root.append(rules);
 const path=el('details',undefined,'card realm-path');path.append(el('summary','Lộ trình cảnh giới'));
 realms.slice(1).forEach((r,index)=>{const row=el('div',undefined,'rank-row');row.append(el('span',index+1<=c.highestRank?'✦':'◇'),el('h3',r.name),el('small',r.qi+' tu vi · '+r.days+' ngày'));path.append(row);});root.append(path);
 const history=el('details',undefined,'card realm-path');history.append(el('summary','Nhật ký bản mẫu'));for(const line of c.log.slice(0,6))history.append(el('p',line,'hint'));if(!c.log.length)history.append(el('p','Chưa có giao dịch demo.','hint'));root.append(history);
 root.append(el('p','Toàn bộ số dư và kết quả là minh họa. Tải lại trang sẽ khôi phục; không phát thưởng thật.','footer-note'));
 return root;
}
