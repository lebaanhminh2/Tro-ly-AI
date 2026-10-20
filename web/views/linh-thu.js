import {
  beastArtwork,
  beastPoints,
  beastIdentity,
  beastPurityLabel,
  beastProgress,
  beastRewardLabel,
  beastSkillLabel,
  beastSpecies,
  displayedRole,
  beastTalentLabel,
  beastUltimateText,
  beastUltimateRules,
  beastUltimateProgress,
  beastDiscovery,
  beastTalentUpgrade,
  beastSkillRules,
  beastAwakeningProgress,
} from '../models/linh-thu.js';

function ticketIcon() {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  const path = document.createElementNS(icon.namespaceURI, 'path');
  path.setAttribute('d', 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6z M9 6v3m0 2v2m0 2v3');
  icon.append(path);
  icon.classList.add('beast-ticket-icon');
  return icon;
}
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

export function beastJourney(ui, data, beast, selectedForm) {
  const p = beastProgress(data, beast),
    history = beastDiscovery(data, beast);
  const section = ui.el('section', undefined, 'beast-journey');
  section.setAttribute('aria-label', 'Hành trình tiến hóa');
  const cards = ui.el('div', undefined, 'beast-evolution-cards');
  for (let form = 1; form <= 4; form++) {
    const attained = form <= p.form,
      known = form <= history.form;
    const state =
      form === p.form ? 'Hiện tại' : attained ? 'Đã đạt' : known ? 'Đã khám phá' : 'Chưa khám phá';
    const entry = ui.button(
      '',
      () => ui.showBeast(beast, form),
      'beast-evolution-card' +
        (form === p.form ? ' is-current' : '') +
        (!attained && known ? ' is-discovered' : '') +
        (!known ? ' is-unknown' : ''),
    );
    entry.dataset.form = String(form);
    entry.setAttribute(
      'aria-label',
      `T${form} · ${known ? p.species.forms[form - 1] : 'Chưa khám phá'} · ${state}`,
    );
    entry.setAttribute('aria-pressed', String((selectedForm ?? p.form) === form));
    if (form === p.form) entry.setAttribute('aria-current', 'step');
    entry.append(ui.el('span', `T${form}`, 'beast-form-number'));
    if (known) entry.append(image(ui, p.species, form, true));
    else entry.append(paw(ui.el));
    cards.append(entry);
  }
  section.append(cards);
  return section;
}

export function beastUpgrade(ui, data, beast) {
  const p = beastProgress(data, beast);
  const box = ui.el('div', undefined, 'beast-upgrade');
  box.append(ui.el('h3', `Lên T${p.form + 1}`, 'beast-upgrade-heading'));
  data.config.skills[p.species.id].talents.forEach((skill, index) => {
    if (index > 0 && p.form + 1 < 3) return;
    const row = ui.el('div', undefined, 'beast-upgrade-row');
    row.append(
      ui.el('strong', skill.name),
      ui.el('p', beastTalentUpgrade(skill, p.form, p.form + 1, index), 'beast-upgrade-copy'),
    );
    box.append(row);
  });
  return box;
}

function skillEntry(ui, skill, description, progress) {
  const row = ui.el('div', undefined, 'beast-skill-entry');
  row.append(ui.el('h3', skill.name), ui.el('p', description, 'beast-skill-description'));
  if (progress) row.append(ui.el('p', progress, 'beast-skill-counter'));
  return row;
}

export function beastAbilities(ui, data, beast, form = beastProgress(data, beast).form) {
  const p = beastProgress(data, beast),
    skills = data.config.skills[beast.speciesId];
  const section = ui.el('section', undefined, 'card beast-support');
  const preview = form !== p.form;
  const current = data.roles.current.some(
    (role) =>
      role.role === 'companion' && role.beastId === beast.id && role.attemptId === beast.attemptId,
  );
  const pending = data.roles.pending.some(
    (role) =>
      role.role === 'companion' && role.beastId === beast.id && role.attemptId === beast.attemptId,
  );
  section.append(ui.el('h2', `Năng lực T${form}`));
  section.append(
    ui.el(
      'p',
      preview
        ? `Đang xem T${form} · Cá thể này hiện ở T${p.form}`
        : current
          ? 'Đang hỗ trợ bạn'
          : pending
            ? 'Có hiệu lực khi đồng hành từ ngày mai'
            : 'Có hiệu lực khi đồng hành',
      'beast-skill-context',
    ),
  );
  skills.talents.forEach((skill, index) => {
    if (index > 0 && form < 3) return;
    section.append(skillEntry(ui, skill, beastTalentLabel(skill, form, index)));
  });
  if (!preview && p.awakened) {
    const row = skillEntry(
      ui,
      skills.awakening,
      beastSkillLabel(skills.awakening),
      beastAwakeningProgress(data, beast),
    );
    row.prepend(ui.el('span', 'Thức tỉnh', 'beast-skill-tier'));
    section.append(row);
  }
  if (!preview && p.perfect) {
    const row = skillEntry(ui, skills.ultimate, beastUltimateText[skills.ultimate.kind]);
    row.prepend(ui.el('span', 'Tuyệt kỹ hoàn mỹ', 'beast-skill-tier'));
    if (data.ultimate?.beastId === beast.id && data.ultimate.attemptId === beast.attemptId)
      row.append(
        ui.el(
          'p',
          beastUltimateProgress(data.ultimate, skills.ultimate, data.now),
          'beast-skill-counter',
        ),
      );
    row.append(ui.button('Xem tuyệt kỹ hoàn mỹ', () => ui.openBeastUltimate(beast), 'secondary'));
    section.append(row);
  }
  if (skills.talents.some((skill) => skill.trigger === 'task'))
    section.append(
      ui.el('p', 'Áp dụng cho 5 công việc nhận thưởng đầu tiên mỗi ngày.', 'beast-skill-limit'),
    );
  if (skills.talents.some((skill) => skill.trigger === 'draw'))
    section.append(
      ui.el(
        'p',
        'Áp dụng cho 10 lượt quay thường có trả vé đầu tiên mỗi ngày.',
        'beast-skill-limit',
      ),
    );
  section.append(
    ui.button(
      'Toàn bộ năng lực ›',
      () => ui.showBeast(beast, undefined, true),
      'text-button beast-abilities-link',
    ),
  );
  return section;
}

export function beastAbilityRoadmap(ui, data, beast) {
  const p = beastProgress(data, beast),
    skills = data.config.skills[beast.speciesId];
  const section = ui.el('section', undefined, 'beast-roadmap');
  section.setAttribute('aria-label', 'Năng lực qua từng mốc');
  if (skills.talents.some((skill) => skill.trigger === 'task'))
    section.append(
      ui.el('p', 'Áp dụng cho 5 công việc nhận thưởng đầu tiên mỗi ngày.', 'beast-roadmap-limit'),
    );
  if (skills.talents.some((skill) => skill.trigger === 'draw'))
    section.append(
      ui.el(
        'p',
        'Áp dụng cho 10 lượt quay thường có trả vé đầu tiên mỗi ngày.',
        'beast-roadmap-limit',
      ),
    );
  for (let form = 1; form <= 4; form++) {
    const step = ui.el(
      'section',
      undefined,
      'beast-roadmap-step' + (form === p.form ? ' is-current' : ''),
    );
    step.dataset.tier = String(form);
    const header = ui.el('div', undefined, 'beast-roadmap-heading');
    header.append(ui.el('h2', `T${form}`));
    if (form === p.form) header.append(ui.el('span', 'Hiện tại', 'beast-stage-badge'));
    else if (form < p.form) header.append(ui.el('span', 'Đã đạt', 'beast-roadmap-status'));
    step.append(header);
    skills.talents.forEach((skill, index) => {
      if (index > 0 && form < 3) return;
      const row = skillEntry(
        ui,
        skill,
        form === 1 || (index > 0 && form === 3)
          ? beastTalentLabel(skill, form, index)
          : beastTalentUpgrade(skill, form - 1, form, index),
      );
      if (index > 0 && form === 3) row.prepend(ui.el('span', 'Mở mới', 'beast-skill-tier'));
      step.append(row);
    });
    if (form === 1 && skills.talents.length > 1)
      step.append(ui.el('p', `${skills.talents[1].name} mở từ T3.`, 'beast-roadmap-note'));
    section.append(step);
  }
  const full = ui.el('section', undefined, 'beast-roadmap-step beast-roadmap-full');
  full.append(
    ui.el('h2', 'Luyện đầy T4'),
    ui.el('p', 'Chốt độ thuần cuối lượt để xét hai mốc dưới đây.', 'beast-skill-description'),
  );
  section.append(full, beastMilestones(ui, data, beast));
  const rules = ui.el('details', undefined, 'beast-skill-rules');
  rules.append(ui.el('summary', 'Điều kiện áp dụng'));
  const descriptions = new Set(skills.talents.map(beastSkillRules));
  descriptions.add(beastSkillRules(skills.awakening));
  if (
    skills.awakening.every &&
    ['task', 'draw', 'habit', 'combined'].includes(skills.awakening.trigger)
  )
    descriptions.add(beastSkillRules({ trigger: skills.awakening.trigger }));
  for (const text of descriptions) if (text) rules.append(ui.el('p', text));
  if (skills.talents.length > 1 && skills.talents[0].trigger === skills.talents[1].trigger)
    rules.append(
      ui.el('p', 'Hai thiên phú được xét độc lập và có thể cùng kích hoạt từ một sự kiện.'),
    );
  if (beastUltimateRules[skills.ultimate.kind])
    rules.append(ui.el('p', beastUltimateRules[skills.ultimate.kind]));
  rules.append(
    ui.el(
      'p',
      'Năng lực hỗ trợ khi cá thể đang đồng hành có hiệu lực. Thức tỉnh và Hoàn mỹ mở sau khi luyện đầy T4; độ thuần đang luyện chỉ là tạm tính.',
    ),
  );
  section.append(rules);
  return section;
}

export function beastMilestones(ui, data, beast) {
  const p = beastProgress(data, beast),
    skills = data.config.skills[p.species.id];
  const section = ui.el('section', undefined, 'beast-milestones');
  section.append(ui.el('h2', 'Khi luyện đầy T4'));
  for (const [percent, name, description, opened, possible] of [
    [
      95,
      skills.awakening.name,
      beastSkillLabel(skills.awakening),
      p.awakened,
      beast.attempt.gray <= Math.floor(p.capacity / 20),
    ],
    [
      100,
      skills.ultimate.name,
      beastUltimateText[skills.ultimate.kind],
      p.perfect,
      beast.attempt.gray === 0,
    ],
  ]) {
    const row = ui.el('div', undefined, 'beast-milestone' + (opened ? ' is-open' : ''));
    const copy = ui.el('div');
    copy.append(
      ui.el('span', percent === 95 ? 'Thức tỉnh' : 'Tuyệt kỹ hoàn mỹ', 'beast-skill-tier'),
      ui.el(
        'span',
        opened
          ? 'Đã mở'
          : !possible || beast.attempt.status === 'sealed'
            ? 'Không đạt trong lượt này'
            : 'Luyện đầy T4 để mở',
        'beast-milestone-status',
      ),
      ui.el('h3', name),
      ui.el('p', description, 'hint'),
    );
    row.append(
      ui.el('span', percent === 95 ? 'Độ thuần ≥ 95%' : 'Độ thuần 100%', 'beast-milestone-mark'),
      copy,
    );
    section.append(row);
  }
  section.append(
    ui.el(
      'p',
      'Hoàn mỹ giữ cả Thức tỉnh. Mỗi tài khoản được kích hoạt một tuyệt kỹ mỗi tuần.',
      'hint',
    ),
  );
  return section;
}

export function beastTrainingCard(ui, data, beast, pending = false) {
  const p = beastProgress(data, beast),
    { el, button } = ui;
  const section = el('section', undefined, 'card beast-progress');
  section.dataset.evolutionState = p.canEvolve
    ? 'ready'
    : p.blocked
      ? 'blocked'
      : p.completed
        ? 'complete'
        : 'training';
  const heading = el('div', undefined, 'beast-progress-heading');
  heading.append(
    el('h2', p.completed && p.form === 4 ? 'Thành quả luyện tập' : 'Dấu ấn nỗ lực'),
    el(
      'span',
      `T${p.form} ${p.form < 4 ? '→ T' + (p.form + 1) : '· Luyện đầy'}`,
      'beast-stage-badge',
    ),
  );
  const numbers = el('div', undefined, 'beast-stage-numbers');
  numbers.append(
    el('strong', beastPoints(p.stageEarned)),
    el('span', `/ ${beastPoints(p.stageCapacity)} điểm thực`, 'hint'),
  );
  const track = el('div', undefined, 'beast-progress-track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute(
    'aria-label',
    `Tiến độ T${p.form}${p.form < 4 ? ' lên T' + (p.form + 1) : ' đến luyện đầy'}`,
  );
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', String(p.stageCapacity / 10));
  track.setAttribute('aria-valuenow', String(p.stageEarned / 10));
  track.setAttribute(
    'aria-valuetext',
    `${beastPoints(p.stageEarned)} trên ${beastPoints(p.stageCapacity)} điểm thực; ${beastPoints(p.stageGray)} điểm bị tạp chất chiếm`,
  );
  const earned = el('div', undefined, 'beast-progress-earned'),
    gray = el('div', undefined, 'beast-progress-gray');
  earned.style.width = (p.stageEarned / p.stageCapacity) * 100 + '%';
  gray.style.width = (p.stageGray / p.stageCapacity) * 100 + '%';
  track.append(earned, gray);
  let message = p.canEvolve
    ? ''
    : p.blocked
      ? `Lượt này không thể lên T${p.form + 1}. Điểm thực tối đa: ${beastPoints(p.capacity - beast.attempt.gray)}/${beastPoints(p.stageEnd)} do tạp chất.`
      : beast.attempt.status === 'sealed'
        ? 'Lượt luyện đã khóa tại tiến độ này.'
        : p.completed
          ? p.form === 4
            ? 'Đã luyện đầy T4. Thành quả của lượt luyện đã được chốt.'
            : 'Đã dùng hết dung lượng lượt luyện.'
          : p.form < 4
            ? `Còn ${beastPoints(p.needed)} điểm để lên T${p.form + 1}.`
            : `Còn ${beastPoints(p.capacity - p.occupied)} điểm để luyện đầy T4.`;
  if (pending) message = 'Bắt đầu tính điểm từ ngày mai.';
  section.append(heading, numbers, track);
  if (p.completed && p.form === 4)
    section.append(el('p', 'Độ thuần cuối lượt · ' + beastPurityLabel(p), 'beast-training-result'));
  if (message) section.append(el('p', message, 'beast-stage-message'));
  if (p.stageGray > 0 && !p.blocked)
    section.append(
      el(
        'p',
        p.stageGray > 0
          ? `${beastPoints(p.stageGray)} điểm trong chặng này bị tạp chất chiếm.`
          : `Tạp chất tích lũy: ${beastPoints(beast.attempt.gray)} điểm · Chưa lấn vào chặng này.`,
        'beast-gray-note',
      ),
    );
  if (p.form < 4 && !p.blocked && beast.attempt.status !== 'sealed') {
    section.append(beastUpgrade(ui, data, beast));
    if (p.canEvolve && !pending) {
      const evolve = button(
        data.busy
          ? 'Đang xử lý…'
          : p.canEvolve
            ? `Tiến hóa lên T${p.form + 1}`
            : p.blocked
              ? 'Không thể tiến hóa trong lượt này'
              : `Chưa đủ điểm lên T${p.form + 1}`,
        () => ui.evolveBeast(beast),
        'primary beast-evolve-button',
      );
      evolve.disabled = !p.canEvolve || pending || data.busy || ui.beastPending();
      section.append(evolve);
    }
  }
  const details = el('details', undefined, 'beast-training-details');
  details.append(
    el('summary', 'Chi tiết lượt luyện'),
    el(
      'p',
      `${beastPoints(beast.attempt.earned)} điểm thực · ${beastPoints(beast.attempt.gray)} tạp chất · Tổng dung lượng ${beastPoints(p.capacity)}.`,
      'hint',
    ),
    el('p', 'Độ thuần · ' + beastPurityLabel(p), 'hint'),
    el(
      'p',
      'Điểm được chốt từ thói quen cuối ngày. Tiến hóa giữ nguyên điểm đã tích lũy. Tạp chất giữ nguyên qua các ngày.',
      'hint',
    ),
  );
  section.append(details);
  return section;
}
// Keep decoded art and navigation nodes alive through role switches and refreshes.
export function reconcileBeasts(current, next) {
  if (!current) return next;
  const retained = new Map();
  for (const selector of ['.beast-hero', '.beast-summon-panel', '.beast-atlas']) {
    const old = current.querySelector(':scope > ' + selector);
    const fresh = next.querySelector(':scope > ' + selector);
    if (old?.isEqualNode(fresh)) retained.set(fresh, old);
  }
  const images = new Map();
  for (const img of current.querySelectorAll('img')) {
    const key = img.src + ':' + img.className;
    if (!images.has(key)) images.set(key, []);
    images.get(key).push(img);
  }
  for (const img of next.querySelectorAll('img')) {
    if ([...retained.keys()].some((node) => node.contains(img))) continue;
    const old = images.get(img.src + ':' + img.className)?.shift();
    if (old && old.isEqualNode(img)) img.replaceWith(old);
  }
  const head = current.querySelector(':scope > .heading');
  const nextHead = next.querySelector(':scope > .heading');
  if (head?.isEqualNode(nextHead)) retained.set(nextHead, head);
  const tabs = current.querySelector('.beast-tabs');
  const nextTabs = next.querySelector('.beast-tabs');
  if (tabs && nextTabs) {
    [...tabs.children].forEach((tab, index) =>
      tab.setAttribute('aria-current', nextTabs.children[index].getAttribute('aria-current')),
    );
    retained.set(nextTabs, tabs);
  }
  const hero = current.querySelector('.beast-hero');
  const nextHero = next.querySelector('.beast-hero');
  if (hero && nextHero && !retained.has(nextHero)) {
    for (const { name } of [...hero.attributes])
      if (!nextHero.hasAttribute(name)) hero.removeAttribute(name);
    for (const { name, value } of nextHero.attributes) hero.setAttribute(name, value);
    hero.replaceChildren(...nextHero.childNodes);
    retained.set(nextHero, hero);
  }
  current.className = next.className;
  const nodes = [...next.childNodes].map((fresh) => retained.get(fresh) ?? fresh);
  const keep = new Set(nodes);
  for (const child of [...current.childNodes]) if (!keep.has(child)) child.remove();
  let cursor = current.firstChild;
  for (const node of nodes) {
    if (node === cursor) cursor = cursor.nextSibling;
    else current.insertBefore(node, cursor);
  }
  while (cursor) {
    const following = cursor.nextSibling;
    cursor.remove();
    cursor = following;
  }
  return current;
}
export function renderBeasts(ui, state) {
  const { el, button, heading, card } = ui;
  const root = el('section', undefined, 'beast-page');
  const head = heading('Linh thú', 'Một giao ước. Một hành trình.');
  head.querySelector('.subtitle')?.remove();
  const alchemy = state.beastData?.account.state.alchemy;
  const furnace = button(
    'Lò đan' + (alchemy ? ` · ${alchemy.days}/30` : ''),
    ui.openBeastAlchemy,
    'beast-alchemy-entry',
  );
  furnace.disabled = !alchemy;
  head.append(furnace);
  const updating = el(
    'small',
    state.beastRoleSaving ? 'Đang lưu lựa chọn…' : state.beastLoading ? 'Đang cập nhật…' : '',
    'beast-updating' + (state.beastLoading ? ' feature-updating' : ''),
  );
  updating.setAttribute('role', 'status');
  head.append(updating);
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
  if (ui.beastPending() && !state.beastRoleSaving) {
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
  const panel = state.beastPanel ?? 'training';
  if (panel === 'summon') return summon(ui, state, root);
  if (panel === 'collection') return collection(ui, state, root);
  const { current, pending, displayed: beast } = displayedRole(data, panel);
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
  hero.dataset.panel = panel;
  hero.dataset.rank = p.species.rank;
  hero.dataset.beastId = beast.id;
  hero.dataset.attemptId = beast.attemptId;
  if (pending) hero.dataset.pending = 'true';
  hero.dataset.individual = [
    beast.id,
    beast.attemptId,
    beast.attempt.earned,
    beast.attempt.gray,
    beast.attempt.status,
  ].join(':');
  const copy = el('div', undefined, 'beast-hero-copy');
  copy.append(
    el('span', `${p.species.rank} · T${p.form}`, 'beast-rank'),
    el('h2', p.species.forms[p.form - 1]),
    el(
      'span',
      pending
        ? panel === 'training'
          ? 'Bắt đầu luyện từ ngày mai'
          : 'Hỗ trợ từ ngày mai'
        : panel === 'training'
          ? beast.attempt.status === 'completed'
            ? 'Luyện hoàn tất'
            : 'Đang nuôi dưỡng'
          : 'Đang đồng hành',
      'beast-role-label',
    ),
  );
  const actions = el('div', undefined, 'beast-role-actions');
  actions.append(
    button('Chi tiết linh thú', () => ui.showBeast(beast), 'beast-hero-view'),
    button(
      panel === 'training' ? 'Đổi linh thú luyện' : 'Đổi đồng hành',
      () => ui.openBeastPicker(panel),
      'secondary',
    ),
  );
  hero.append(copy, image(ui, p.species, p.form, false, p.perfect, p.awakened), actions);
  root.append(hero);
  if (pending && current) {
    const note = el('p', undefined, 'beast-role-today');
    const previous = beastProgress(data, current);
    const name = button(
      previous.species.forms[previous.form - 1],
      () => ui.showBeast(current),
      'beast-role-previous',
    );
    name.dataset.beastId = current.id;
    note.append(
      document.createTextNode(panel === 'training' ? 'Habit hôm nay vẫn tính cho ' : 'Hôm nay, '),
      name,
      document.createTextNode(panel === 'training' ? '.' : ' vẫn hỗ trợ bạn.'),
    );
    root.append(note);
  }
  if (panel === 'training') {
    root.append(
      beastJourney(ui, data, beast),
      beastTrainingCard(ui, { ...data, busy: state.beastBusy }, beast, !!pending),
      beastAbilities(ui, data, beast),
    );
    if (p.form === 4 && !p.completed) root.append(beastMilestones(ui, data, beast));
    return root;
  }
  root.append(beastAbilities(ui, data, beast));
  return root;
}
function collection(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData;
  const beasts = state.beastCollection?.beasts ?? [];
  const selectedSpecies = beastSpecies(data, state.beastCollectionSpecies);
  if (!selectedSpecies) return speciesCollection(ui, state, root);
  const label = el('div', undefined, 'beast-collection-heading');
  label.append(
    el('h2', selectedSpecies.title),
    el('span', `${data.speciesCounts?.[selectedSpecies.id] ?? 0} cá thể`, 'hint'),
  );
  root.append(
    button('‹ Bộ sưu tập', () => ui.openBeastSpecies(null), 'text-button beast-collection-back'),
    label,
  );
  const grid = el('div', undefined, 'beast-collection-grid');
  for (const beast of beasts.filter((entry) => entry.speciesId === selectedSpecies.id)) {
    const p = beastProgress(data, beast),
      b = button('', () => ui.showBeast(beast), 'beast-collection-card');
    b.dataset.rank = p.species.rank;
    b.dataset.beastId = beast.id;
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
    const roles = data.roles.current.filter(
      (role) => role.beastId === beast.id && role.attemptId === beast.attemptId,
    );
    if (roles.length)
      b.append(
        el(
          'small',
          roles.map((role) => (role.role === 'training' ? 'Đang luyện' : 'Đồng hành')).join(' · '),
          'beast-card-roles',
        ),
      );
    grid.append(b);
  }
  root.append(grid);
  if (state.beastCollection?.nextCursor)
    root.append(
      button(
        state.beastLoading ? 'Đang tải các cá thể…' : 'Tải tiếp các cá thể',
        () => ui.loadBeasts(true),
        'secondary',
      ),
    );
  return root;
}
function speciesCollection(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData;
  const catalog = data.config.catalog;
  const label = el('div', undefined, 'beast-collection-heading');
  label.append(
    el('h2', 'Bộ sưu tập'),
    el('span', `${Object.keys(data.speciesCounts ?? {}).length}/${catalog.length} loài`, 'hint'),
  );
  root.append(label);
  const atlas = el('div', undefined, 'beast-atlas');
  const complete = !!state.beastCollection && !state.beastCollection.nextCursor;
  for (const species of catalog) {
    const count = data.speciesCounts?.[species.id] ?? 0;
    const entry = button(
      '',
      () => ui.openBeastSpecies(species.id),
      'beast-atlas-entry' + (count ? '' : ' is-unowned'),
    );
    entry.disabled = !count;
    if (count) {
      entry.dataset.rank = species.rank;
      entry.dataset.species = species.id;
      const best = (state.beastCollection?.beasts ?? [])
        .filter((beast) => beast.speciesId === species.id)
        .map((beast) => beastProgress(data, beast))
        .sort(
          (a, b) =>
            b.form - a.form ||
            Number(b.perfect) - Number(a.perfect) ||
            (b.purity ?? 0) - (a.purity ?? 0),
        )[0];
      if (complete && best) {
        entry.append(
          image(ui, species, best.form, true, best.perfect, best.awakened),
          el('strong', species.forms[best.form - 1]),
        );
      } else {
        entry.append(paw(el), el('strong', 'Đang tải…'));
      }
      entry.append(el('small', `${species.rank} · ${count} cá thể`));
    } else {
      entry.append(paw(el), el('strong', 'Chưa khám phá'));
      entry.setAttribute('aria-label', 'Linh thú chưa khám phá');
    }
    atlas.append(entry);
  }
  root.append(atlas);
  if (state.beastCollection?.nextCursor && !state.beastLoading)
    root.append(button('Tải tiếp bộ sưu tập', () => ui.loadBeasts(true), 'secondary'));
  return root;
}
function paw(el) {
  const mark = el('span', undefined, 'beast-paw');
  mark.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute(
    'd',
    'M20 39c4-4 6-10 12-10s8 6 12 10c6 6 3 15-4 14-5-1-6-3-8-3s-3 2-8 3c-7 1-10-8-4-14Z M14 16c-8 0-8 15 0 15s8-15 0-15Z M26 8c-8 0-8 16 0 16s8-16 0-16Z M40 8c-8 0-8 16 0 16s8-16 0-16Z M52 16c-8 0-8 15 0 15s8-15 0-15Z',
  );
  svg.append(path);
  mark.append(svg);
  return mark;
}
function summon(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData,
    account = data.account.state;
  root.classList.add('beast-page--summon');
  const panel = el('section', undefined, 'beast-summon-panel');
  panel.setAttribute('aria-label', 'Triệu hồi linh thú');
  const rates = button('Tỷ lệ', ui.openBeastRates, 'beast-summon-rates');
  rates.setAttribute('aria-label', 'Tỷ lệ và bảo hiểm');
  const info = el('span', 'i');
  info.setAttribute('aria-hidden', 'true');
  rates.append(info);
  const banner = el('div', undefined, 'beast-summon-banner');
  const card = el('img');
  card.src = new URL('../assets/linh-thu/summon-card.webp', import.meta.url).href;
  card.alt = 'Thẻ triệu hồi chưa mở · Ấn tinh tú';
  card.width = 600;
  card.height = 900;
  card.decoding = 'async';
  banner.append(card);
  const wallet = el('div', undefined, 'beast-wallet');
  const balance = el('div', undefined, 'beast-summon-balance');
  const amount = el('strong', String(account.summonTickets));
  amount.setAttribute('aria-label', `${account.summonTickets} vé triệu hồi`);
  balance.append(ticketIcon(), el('span', 'Vé triệu hồi'), amount);
  const exchange = button('Đổi vé', ui.openBeastExchange, 'beast-summon-exchange');
  const plus = el('span', '+');
  plus.setAttribute('aria-hidden', 'true');
  exchange.append(plus);
  exchange.setAttribute('aria-label', `Đổi vé · Đang có ${data.wallet.state.tickets} vé thường`);
  exchange.disabled = state.beastBusy || ui.beastPending();
  wallet.append(balance, exchange);
  const actions = el('div', undefined, 'beast-summon-actions');
  for (const count of [1, 10]) {
    const b = button('', () => ui.summonBeast(count), count === 1 ? 'secondary' : 'primary');
    b.setAttribute('aria-label', `Triệu hồi ×${count} · ${count} vé`);
    const cost = el('small');
    cost.append(ticketIcon(), el('span', count + ' vé'));
    b.append(el('span', 'Triệu hồi ×' + count), cost);
    b.disabled =
      account.summonTickets < count || state.beastBusy || ui.beastPending() || !!data.summonChoice;
    actions.append(b);
  }
  const pity = el('div', undefined, 'beast-pity');
  for (const [rank, limit, current] of [
    ['SSR+', 20, account.pity.ssr],
    ['UR', 80, account.pity.ur],
  ]) {
    const meter = el('div', undefined, 'beast-summon-meter');
    meter.dataset.rank = rank === 'SSR+' ? 'SSR' : rank;
    const label = el('div', undefined, 'beast-summon-meter-label');
    label.append(el('strong', rank), el('span', `Còn tối đa ${limit - current} lượt`));
    const track = el('progress');
    track.max = limit;
    track.value = current;
    track.setAttribute('aria-label', `Bảo hiểm ${rank}: ${current}/${limit} lượt`);
    meter.append(label, track);
    pity.append(meter);
  }
  const pool = button(
    `${data.config.catalog.length} loài · Xem linh thú có thể nhận`,
    ui.openBeastSummonPool,
    'beast-summon-pool-link',
  );
  const arrow = el('span', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  pool.append(arrow);
  const footer = el('div', undefined, 'beast-summon-footer');
  footer.append(pool, rates);
  panel.append(wallet, banner, actions);
  if (account.summonTickets === 0) {
    const empty = el('div', undefined, 'beast-summon-empty');
    empty.append(
      el('span', 'Chưa có vé triệu hồi.'),
      button(
        'Kiếm vé từ Thói quen',
        () => {
          /** @type {HTMLButtonElement} */ (
            document.querySelector('button[data-tab="habits"]')
          ).click();
        },
        'text-button',
      ),
    );
    panel.append(empty);
  }
  panel.append(pity, footer);
  root.append(panel);
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
