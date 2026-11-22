// Extracted from the immutable approved HTML (SHA-256 5a406bd6...).
import { pbIcon, pbSparkArt, pbArt } from '../ui/first-step-art.js';
function pbFace(timer = false) {
  return (
    '<span class="pb-socket" aria-hidden="' +
    !timer +
    '"><span class="pb-gem" aria-hidden="true">' +
    pbSparkArt +
    '</span><span class="pb-switch-title" aria-hidden="true">Bắt đầu</span><svg class="pb-edge-track" viewBox="0 0 106 46" aria-hidden="true"><rect x="2" y="2" width="102" height="42" rx="21"/></svg><svg class="pb-edge-light" viewBox="0 0 106 46" aria-hidden="true"><defs><linearGradient id="pb-refined-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c7bb9c"/><stop offset=".47" stop-color="#f2e8d1"/><stop offset="1" stop-color="#bfa87a"/></linearGradient></defs><rect x="2" y="2" width="102" height="42" rx="21" pathLength="1"/></svg><span class="pb-refined-clock' +
    (timer ? ' pb-clock" role="timer" aria-live="off">05:00' : '">') +
    '</span><span class="pb-gacha-wipe" aria-hidden="true"></span></span>'
  );
}
const pbPerks = () =>
  '<div class="pb-perks" aria-label="Mỗi lần nhận 1 tu vi và 1 vé quay thường"><span>' +
  pbIcon('spark') +
  '+1 tu vi</span><span>' +
  pbIcon('ticket') +
  '+1 vé</span></div>';
function pbMenu(active) {
  return (
    '<details class="pb-menu"><summary aria-label="Tùy chọn phá trì hoãn">' +
    pbIcon('more') +
    '</summary><div class="pb-menu-panel">' +
    (active
      ? '<button class="pb-danger" data-pb="stop">Hủy lượt đang làm</button>'
      : '<button data-pb="start-accessible">Bắt đầu bằng một chạm</button>') +
    '</div></details>'
  );
}
export function firstStepInner(state, active, now) {
  const backdrop = '<div class="pb-backdrop" aria-hidden="true"></div>';
  let title = 'Đang muốn để sau?',
    note = 'Bắt đầu 5 phút thôi.',
    action = '',
    bottom = '',
    meta = pbPerks() + pbMenu(active);
  if (state === 'idle') {
    action =
      '<button id="pb-hold" class="pb-switch" aria-label="Giữ 3 giây để bắt đầu 5 phút" aria-describedby="pb-hold-help">' +
      pbFace() +
      '<span class="pb-switch-label"><span class="pb-duration">Giữ 3 giây</span><span class="pb-counts" aria-hidden="true"><b>1</b><i></i><b>2</b><i></i><b>3</b></span></span></button><span id="pb-hold-help" class="sr-only">Giữ chuột, chạm giữ, hoặc giữ phím cách hay Enter đủ 3 giây. Đếm 1–2–3 trong lúc giữ, rồi bắt tay làm 5 phút. Thả sớm để bỏ thao tác. Có thể bắt đầu bằng một chạm trong tùy chọn.</span>';
    bottom =
      '<button class="pb-quick" data-pb="outside">' + pbIcon('check') + 'Đã tự làm 5 phút</button>';
  }
  if (state === 'launch' || state === 'running') {
    title = state === 'launch' ? 'Làm ngay.' : '5 phút đầu tiên';
    note = state === 'launch' ? 'Chỉ 5 phút thôi.' : 'Hết giờ, cậu có thể dừng.';
    action =
      '<div class="pb-switch pb-timer" aria-label="Thời gian còn lại">' +
      pbFace(true) +
      '<span class="pb-switch-label" aria-hidden="true">Giữ 3 giây</span></div>';
    bottom = '<p class="pb-footnote">Thời gian vẫn chạy khi rời app.</p>';
    meta = pbMenu(active);
  }
  if (state === 'ready') {
    title = 'Đã làm 5 phút chưa?';
    note = 'Ghi nhận nếu đã thực sự làm.';
    action = '<button class="pb-action" data-pb="claim">Đã làm, nhận thưởng</button>';
    bottom = '<p class="pb-footnote">Dừng hay làm tiếp đều được.</p>';
  }
  if (state === 'confirm') {
    title = 'Đã làm đủ 5 phút?';
    note = 'Đã đếm 1–3 rồi làm việc đang né?';
    action = '<button class="pb-action" data-pb="claim">Đã làm, nhận thưởng</button>';
    bottom = '<button class="pb-back" data-pb="back">' + pbIcon('close') + 'Quay lại</button>';
    meta = pbPerks();
  }
  if (state === 'stop') {
    title = 'Hủy lượt này?';
    note = 'Không nhận thưởng. Có thể bắt đầu lại.';
    action = '<button class="pb-action" data-pb="stop-confirm">Hủy lượt</button>';
    bottom =
      '<button class="pb-back" data-pb="back">' +
      (active?.endsAt <= now ? 'Quay lại' : 'Tiếp tục làm') +
      '</button>';
    meta = '';
  }
  if (state === 'reward') {
    title = 'Đã bắt tay làm.';
    note = 'Làm thay vì để sau.';
    action =
      '<div class="pb-receipt-art">' +
      pbArt('coin', 'pb-receipt-coin') +
      pbArt('ticket', 'pb-receipt-ticket') +
      '</div>';
    bottom = '<p class="pb-footnote">Cứ mang nhịp này đi tiếp.</p>';
    meta = '<span class="pb-receipt-value">+1 tu vi · +1 vé quay</span>';
  }
  return (
    backdrop +
    '<div class="pb-main"><div class="pb-copy"><h2 class="pb-heading" id="pb-heading">' +
    title +
    '</h2><p class="pb-note">' +
    note +
    '</p></div>' +
    action +
    '</div><div class="pb-bottom">' +
    bottom +
    '<div class="pb-meta">' +
    meta +
    '</div></div>'
  );
}
export function firstStepEntry() {
  const entry = document.createElement('section');
  entry.className = 'pb-entry';
  entry.id = 'pb-entry';
  entry.tabIndex = -1;
  entry.setAttribute('aria-label', 'Phá trì hoãn');
  return entry;
}

// Keep the card and all its ancestors connected during a Habit refresh. Moving
// a captured button through a detached tree would cancel a valid pointer hold.
export function reconcileFirstStep(current, next) {
  if (!current) return next;
  const card = current.querySelector(':scope > #pb-entry');
  const placeholder = next.querySelector(':scope > #pb-entry');
  if (!card || !placeholder) return next;
  current.className = next.className;
  const nodes = [...next.childNodes].map((node) => (node === placeholder ? card : node));
  const keep = new Set(nodes);
  for (const child of [...current.childNodes]) if (!keep.has(child)) child.remove();
  let cursor = current.firstChild;
  for (const node of nodes) {
    if (node === cursor) cursor = cursor.nextSibling;
    else current.insertBefore(node, cursor);
  }
  return current;
}
