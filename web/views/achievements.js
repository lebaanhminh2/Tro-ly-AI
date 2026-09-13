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
 const title=el('div',undefined,'section-heading');title.append(el('h2','Tu luyện kỷ luật'),el('span','GIẤC NGỦ','pill'));root.append(title);
 const streak=card('streak');const number=el('div');number.append(el('h2','5 ngày đúng giờ'),el('p','Kỷ lục: 5 ngày · Báo /ngu đúng mục tiêu','subtitle'));streak.append(el('span','☾','streak-icon'),number);root.append(streak);
 const rank=el('article',undefined,'rank-card');rank.append(el('div','✧','rank-seal'),el('p','CẢNH GIỚI ĐÃ MỞ','eyebrow'),el('h2','Luyện Khí'),el('p','3 ngày báo ngủ đúng giờ liên tiếp'));
 rank.append(button('Xem thẻ thành tích',()=>ui.openShare(),'text-button'));root.append(rank);
 const next=card();
 for(const [label,condition,progress] of [['Trúc Cơ','7 ngày liên tiếp',true],['Kết Đan','14 ngày liên tiếp',false],['Nguyên Anh','30 ngày liên tiếp',false]]){
  const row=el('div',undefined,'rank-row'),info=el('div');info.append(el('h3',label),el('small',condition));
  if(progress){const track=el('div',undefined,'track'),fill=el('span');fill.style.width='71%';track.append(fill);info.append(track);}
  row.append(el('span',progress?'◇':'◌','streak-icon'),info);if(progress)row.append(el('small','5/7'));next.append(row);
 }root.append(next);
 root.append(el('p','Minh họa: các số trên là dữ liệu mẫu. Chuỗi ghi nhận lúc cậu báo /ngu, không đo thời gian ngủ thực tế.','footer-note'));
 return root;
}
