import {
  beastArtwork,
  beastPoints,
  beastIdentity,
  beastPurityLabel,
  beastProgress,
  beastRewardLabel,
  beastSkillLabel,
  beastSpecies,
  roleBeast,
  beastUltimateText,
} from '../models/linh-thu.js';

function image(ui, species, form, thumbnail = false, perfect = false, awakened = false) {
  const img = ui.el('img');
  const art = beastArtwork(species, form, thumbnail, perfect, undefined, awakened);
  img.src = art.src;
  img.alt =
    species.forms[form - 1] +
    (art.variant === 'perfect' ? ' · Hoàn mỹ' : art.variant === 'awakened' ? ' · Thức tỉnh' : '');
  img.dataset.artVariant = art.variant;
  img.dataset.artKind = art.kind;
  img.width = thumbnail ? 128 : 512;
  img.height = img.width;
  img.loading = thumbnail ? 'lazy' : 'eager';
  img.decoding = 'async';
  return img;
}
export function renderBeasts(ui, state) {
  const { el, button, heading, card } = ui;
  const root = el('section', undefined, 'beast-page');
  const head = heading('Linh thú', 'Một giao ước. Một hành trình cùng cậu.');
  const alchemy = state.beastData?.account.state.alchemy;
  const furnace = button(
    'Lò đan' + (alchemy ? ` · ${alchemy.days}/30` : ''),
    ui.openBeastAlchemy,
    'beast-alchemy-entry',
  );
  furnace.disabled = !alchemy;
  head.append(furnace);
  root.append(head);
  const tabs = el('nav', undefined, 'beast-tabs');
  tabs.setAttribute('aria-label', 'Linh thú');
  for (const [panel, label] of [
    ['training', 'Đang luyện'],
    ['companion', 'Đồng hành'],
    ['collection', 'Bộ sưu tập'],
    ['summon', 'Triệu hồi'],
  ]) {
    const control = button(label, () => ui.setBeastPanel(panel), 'beast-tab');
    control.setAttribute(
      'aria-current',
      (state.beastPanel ?? 'training') === panel ? 'page' : 'false',
    );
    tabs.append(control);
  }
  root.append(tabs);
  if (ui.beastPending()) {
    const pending = card('beast-notice');
    const recover = button('Kiểm tra kết quả', ui.recoverBeast, 'primary');
    recover.disabled = state.beastBusy;
    pending.append(
      el('h2', state.beastBusy ? 'Đang xác nhận giao ước…' : 'Một kết quả đang chờ xác nhận'),
      el(
        'p',
        state.beastBusy
          ? 'Cậu chờ một chút để nhận kết quả nhé.'
          : 'Kiểm tra thao tác trước khi bắt đầu một giao ước mới.',
        'hint',
      ),
      recover,
    );
    root.append(pending);
  }
  if (state.beastError)
    root.append(
      el('p', state.beastError, 'beast-notice'),
      button('Tải lại', () => ui.loadBeasts(), 'secondary'),
    );
  if (!state.beastData) {
    root.append(
      el(
        'p',
        state.live
          ? state.beastLoading
            ? 'Đang mở linh giới…'
            : 'Tải bộ sưu tập để bắt đầu.'
          : 'Mở ứng dụng đã đăng nhập để bắt đầu hành trình.',
        'hint',
      ),
    );
    if (state.live && !state.beastLoading)
      root.append(button('Mở bộ sưu tập', () => ui.loadBeasts(), 'primary'));
    return root;
  }
  const data = state.beastData;
  if (data.drawChoices?.length) {
    const box = card('beast-notice');
    box.append(
      el('h2', 'Vận may đang chờ lựa chọn'),
      el('p', `${data.drawChoices.length} lượt quay đã trả vé đang chờ cậu chọn thưởng.`, 'hint'),
      button('Chọn phần thưởng quay thường', () => ui.openBeastDrawChoices(), 'primary'),
    );
    root.append(box);
  }
  if (data.summonChoice) {
    const pending = card('beast-notice');
    pending.append(
      el('h2', 'Ba giao ước đang chờ lựa chọn'),
      el('p', 'Vé đã dùng; kết quả được giữ để cậu chọn một linh thú.', 'hint'),
      button('Chọn linh thú triệu hồi', () => ui.openBeastSummonChoice(), 'primary'),
    );
    root.append(pending);
  }
  for (const choice of data.choices ?? []) {
    const box = card('beast-reward-choice');
    box.append(el('h2', 'Thành quả đang chờ cậu chọn'));
    choice.options.forEach((reward, index) =>
      box.append(
        button(beastRewardLabel(reward), () => ui.chooseBeastReward(choice, index), 'secondary'),
      ),
    );
    root.append(box);
  }
  if (!data.day) {
    root.append(el('p', 'Chọn giờ sinh hoạt trong Cài đặt để bắt đầu.', 'hint'));
    return root;
  }
  if (state.beastLoading) root.append(el('small', 'Đang cập nhật…', 'feature-updating'));
  const panel = state.beastPanel ?? 'training';
  if (panel === 'summon') return summon(ui, state, root);
  if (panel === 'collection') return collection(ui, state, root);
  const beast = roleBeast(data, panel);
  const pendingRole = data.roles.pending.find((selection) => selection.role === panel);
  if (pendingRole) {
    const selected = data.selected.find(
      (entry) => entry.id === pendingRole.beastId && entry.attemptId === pendingRole.attemptId,
    );
    const species = selected && beastSpecies(data, selected.speciesId);
    const note = card('beast-notice');
    note.append(
      el(
        'strong',
        'Ngày kế tiếp · ' +
          (selected ? species.forms[beastProgress(data, selected).form - 1] : 'Lựa chọn mới'),
      ),
      el(
        'p',
        panel === 'training'
          ? 'Hôm nay vẫn ảnh hưởng đến linh thú cũ. Lượt luyện cũ khóa sau quyết toán.'
          : 'Hôm nay vẫn nhận hỗ trợ từ linh thú đồng hành hiện tại.',
        'hint',
      ),
      button('Hủy lựa chọn chờ', () => ui.cancelBeastRole(panel), 'text-button'),
    );
    root.append(note);
  }
  if (!beast) {
    const box = card('beast-empty');
    box.append(
      el('span', '✧', 'beast-empty-symbol'),
      el('h2', panel === 'training' ? 'Một hành trình đang chờ' : 'Chọn người bạn đồng hành'),
      el(
        'p',
        panel === 'training'
          ? 'Habit mỗi ngày nuôi dưỡng linh thú. Từng phần nỗ lực đều được ghi lại.'
          : 'Đồng hành hỗ trợ công việc và sinh hoạt. Có thể chọn khác linh thú đang luyện.',
        'hint',
      ),
      button(
        state.beastCollection?.beasts.length ? 'Chọn linh thú' : 'Đến Triệu hồi',
        () =>
          state.beastCollection?.beasts.length
            ? ui.openBeastPicker(panel)
            : ui.setBeastPanel('summon'),
        'primary',
      ),
    );
    root.append(box);
    return root;
  }
  const p = beastProgress(data, beast),
    hero = el('div', undefined, 'beast-hero');
  hero.dataset.rank = p.species.rank;
  const copy = el('div', undefined, 'beast-hero-copy');
  copy.append(
    el('span', `${p.species.rank} · DẠNG ${p.form}`, 'beast-rank'),
    el('h2', p.species.forms[p.form - 1]),
    el('p', p.species.title),
    el(
      'span',
      panel === 'training'
        ? beast.attempt.status === 'completed'
          ? 'Luyện hoàn tất'
          : 'Đang nuôi dưỡng'
        : 'Đang đồng hành',
      'beast-role-label',
    ),
  );
  hero.append(
    copy,
    image(ui, p.species, p.form, false, p.perfect, p.awakened),
    button('Xem linh thú ↗', () => ui.showBeast(beast), 'beast-hero-view'),
  );
  root.append(hero);
  const actions = el('div', undefined, 'beast-role-actions');
  actions.append(
    button(
      panel === 'training' ? 'Đổi linh thú luyện' : 'Đổi đồng hành',
      () => ui.openBeastPicker(panel),
      'secondary',
    ),
    button('Bốn hình dạng & kỹ năng', () => ui.showBeast(beast), 'text-button'),
  );
  root.append(actions);
  if (panel === 'training') {
    const progress = card('beast-progress');
    const title = el('div', undefined, 'beast-progress-heading');
    title.append(
      el('h2', 'Dấu ấn nỗ lực'),
      el('span', `${beastPoints(p.occupied)} / ${beastPoints(p.capacity)}`, 'hint'),
    );
    const bar = el('div', undefined, 'beast-progress-track');
    bar.setAttribute('role', 'img');
    bar.setAttribute(
      'aria-label',
      `${beastPoints(beast.attempt.earned)} điểm thực, ${beastPoints(beast.attempt.gray)} tạp chất trên ${beastPoints(p.capacity)}`,
    );
    const earned = el('div', undefined, 'beast-progress-earned'),
      gray = el('div', undefined, 'beast-progress-gray');
    earned.style.width = (beast.attempt.earned / p.capacity) * 100 + '%';
    gray.style.width = (beast.attempt.gray / p.capacity) * 100 + '%';
    bar.append(earned, gray);
    const legend = el('div', undefined, 'beast-progress-legend');
    legend.append(
      el('span', `● ${beastPoints(beast.attempt.earned)} điểm thực`),
      el('span', `● ${beastPoints(beast.attempt.gray)} tạp chất`),
    );
    progress.append(
      title,
      bar,
      legend,
      el('p', 'Độ thuần · ' + beastPurityLabel(p), 'beast-purity'),
      el(
        'p',
        'Tạp chất giữ lại qua các ngày. Chỉ habit quyết định điểm luyện; task không ảnh hưởng.',
        'hint',
      ),
    );
    root.append(progress);
    const evolutions = el('div', undefined, 'beast-evolution-cards');
    p.species.forms.forEach((name, i) => {
      const b = button(
        '',
        () => ui.showBeast(beast, i + 1),
        'beast-evolution-card' + (i + 1 === p.form ? ' is-current' : ''),
      );
      b.append(
        image(ui, p.species, i + 1, true, p.perfect, p.awakened),
        el('small', 'Dạng ' + (i + 1)),
        el('strong', name),
      );
      evolutions.append(b);
    });
    root.append(evolutions);
  }
  const skills = data.config.skills[p.species.id],
    support = card('beast-support');
  support.append(
    el('p', panel === 'companion' ? 'HỖ TRỢ HIỆN TẠI' : 'TIỀM NĂNG ĐỒNG HÀNH', 'beast-eyebrow'),
  );
  skills.talents.forEach((skill, index) =>
    support.append(
      el('h3', skill.name),
      el(
        'p',
        beastSkillLabel(skill) +
          (p.form < 4
            ? ` Hiện tại: ${index === 0 ? p.form * 25 : p.form < 3 ? 0 : 50}% xác suất gốc.`
            : ''),
        'hint',
      ),
    ),
  );
  support.append(
    el('h3', '95% · ' + skills.awakening.name),
    el('p', beastSkillLabel(skills.awakening), 'hint'),
    el('h3', '100% · ' + skills.ultimate.name),
    el('p', beastUltimateText[skills.ultimate.kind], 'hint'),
  );
  if (p.perfect)
    support.append(button('Xem tuyệt kỹ hoàn mỹ', () => ui.openBeastUltimate(beast), 'primary'));
  root.append(support);
  return root;
}
function collection(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData;
  const beasts = state.beastCollection?.beasts ?? [];
  const label = el('div', undefined, 'beast-collection-heading');
  label.append(
    el('h2', 'Bộ sưu tập của cậu'),
    el('span', `${Object.keys(data.speciesCounts ?? {}).length}/18 loài`, 'hint'),
  );
  root.append(label);
  const grid = el('div', undefined, 'beast-collection-grid');
  for (const beast of beasts) {
    const p = beastProgress(data, beast),
      b = button('', () => ui.showBeast(beast), 'beast-collection-card');
    b.dataset.rank = p.species.rank;
    b.append(
      el('span', p.species.rank, 'beast-card-rank'),
      image(ui, p.species, p.form, true, p.perfect, p.awakened),
      el('strong', p.species.forms[p.form - 1]),
      el('small', beastIdentity(beast) + ' · ' + beastPurityLabel(p)),
      el(
        'small',
        `Dạng ${p.form} · ${beast.attempt.status === 'sealed' ? 'Đã khóa lượt' : beast.attempt.status === 'completed' ? 'Hoàn tất' : beast.attempt.status === 'training' ? 'Đang luyện' : 'Chưa luyện'}`,
      ),
    );
    grid.append(b);
  }
  if (!beasts.length)
    root.append(
      el('p', 'Chưa có linh thú. Mỗi lần triệu hồi mở một cá thể mới để cậu nuôi dưỡng.', 'hint'),
      button('Đến Triệu hồi', () => ui.setBeastPanel('summon'), 'primary'),
    );
  root.append(grid);
  if (state.beastCollection?.nextCursor)
    root.append(button('Tải thêm linh thú', () => ui.loadBeasts(true), 'secondary'));
  const atlas = el('div', undefined, 'beast-atlas');
  atlas.append(el('h2', '18 giao ước đang chờ'));
  for (const species of data.config.catalog) {
    const owned = (data.speciesCounts?.[species.id] ?? 0) > 0;
    const entry = el('div', undefined, 'beast-atlas-entry' + (owned ? '' : ' is-unowned'));
    entry.dataset.rank = species.rank;
    entry.append(
      image(ui, species, 4, true),
      el('strong', species.forms[3]),
      el('small', species.rank + ' · ' + (owned ? 'Xem dạng IV' : 'Chưa sở hữu')),
    );
    atlas.append(entry);
  }
  root.append(atlas);
  return root;
}
function summon(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData,
    account = data.account.state;
  const wallet = el('div', undefined, 'beast-wallet');
  wallet.append(
    el('span', `${data.wallet.state.tickets} vé thường`),
    el('strong', `${account.summonTickets} vé triệu hồi`),
    button('Đổi vé', ui.openBeastExchange, 'text-button'),
  );
  root.append(wallet);
  const banner = el('div', undefined, 'beast-summon-banner');
  const species = beastSpecies(data, 'frostnip');
  banner.append(
    el('p', 'GIAO ƯỚC LINH GIỚI', 'beast-eyebrow'),
    el('h2', 'Ai sẽ cùng cậu\nđi đường dài?'),
    image(ui, species, 4),
    el('p', 'Frostluna · Xem trước dạng IV', 'beast-banner-label'),
    el(
      'small',
      'Mỗi lượt nhận dạng I. Các loài cùng rank có tỷ lệ bằng nhau.',
      'beast-banner-note',
    ),
  );
  root.append(banner);
  const actions = el('div', undefined, 'beast-summon-actions');
  for (const count of [1, 10]) {
    const b = button(
      'Triệu hồi ×' + count + ' · ' + count + ' vé',
      () => ui.summonBeast(count),
      count === 1 ? 'secondary' : 'primary',
    );
    b.disabled =
      account.summonTickets < count || state.beastBusy || ui.beastPending() || !!data.summonChoice;
    actions.append(b);
  }
  root.append(actions);
  const pity = el('div', undefined, 'beast-pity');
  pity.append(
    el('span', `SSR+ trong tối đa ${20 - account.pity.ssr} lượt`),
    el('span', `UR trong tối đa ${80 - account.pity.ur} lượt`),
    button('Tỷ lệ & bảo hiểm', ui.openBeastRates, 'text-button'),
  );
  root.append(pity);
  for (const receipt of data.recentSummons ?? [])
    root.append(
      button(
        'Xem lại lần triệu hồi · ' + receipt.result.count + ' linh thú',
        () => ui.showBeastReveal(receipt.result),
        'text-button',
      ),
    );
  return root;
}
export function renderBeastTowerEntry(ui, state) {
  const { card, el, button } = ui,
    box = card('beast-tower-entry');
  const data = state.beastTower,
    run = data?.run;
  const copy = el('div');
  copy.append(
    el('p', 'THÁP GIAO ƯỚC', 'beast-eyebrow'),
    el(
      'h3',
      run && ['choosing', 'decision'].includes(run.status)
        ? 'Giao ước đang chờ cậu'
        : 'Bốn tầng. Một lựa chọn.',
    ),
    el(
      'p',
      run
        ? ['choosing', 'decision'].includes(run.status)
          ? `Tầng ${run.floor} · ${beastRewardLabel(run.atRisk)} đang rủi ro`
          : 'Đã chơi hôm nay · Hẹn cậu ngày kế tiếp.'
        : data?.eligibility.eligible
          ? 'Đủ điều kiện · Một lượt miễn phí đã sẵn sàng.'
          : !data
            ? 'Mở tháp để xem điều kiện hôm nay.'
            : !data.eligibility.taskId
              ? 'Còn thiếu task công việc hoàn tất hợp lệ hôm nay.'
              : 'Hoàn thành đủ habit hôm nay để mở tháp.',
      'hint',
    ),
  );
  const action = button(run ? 'Xem lượt tháp' : 'Vào tháp', ui.openBeastTower, 'secondary');
  box.append(copy, action);
  return box;
}
