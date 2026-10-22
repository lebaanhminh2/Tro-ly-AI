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
  beastTrainingProjection,
} from '../models/linh-thu.js';
import {
  beastSkillsV2,
  beastStageSkillsV2,
  beastUpgradeV2,
  beastProgressV2,
  beastSkillProgressV2,
  beastRoadmapSkillsV2,
  beastSkillTransitionV2,
  beastRulesV2,
} from '../models/linh-thu-v2.js';

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
  box.append(ui.el('h3', `Lên T${p.form + 1} sẽ nhận`, 'beast-upgrade-heading'));
  const v2 = beastSkillsV2(data, beast);
  if (v2) {
    for (const skill of beastUpgradeV2(v2, p.form, p.form + 1)) {
      const row = ui.el('div', undefined, 'beast-upgrade-row');
      const heading = ui.el('div', undefined, 'beast-upgrade-name');
      heading.append(ui.el('strong', skill.name));
      if (skill.isNew) heading.append(ui.el('span', 'Mở mới', 'beast-upgrade-badge'));
      row.append(heading);
      if (skill.change) {
        const change = ui.el('p', undefined, 'beast-upgrade-change');
        change.append('Xác suất: ', ui.el('strong', `${skill.change.from} → ${skill.change.to}`));
        row.append(change);
      }
      row.append(ui.el('p', skill.description, 'beast-upgrade-copy'));
      box.append(row);
    }
    return box;
  }
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
  if (skill.id) row.dataset.skillId = skill.id;
  row.append(ui.el('h3', skill.name), ui.el('p', description, 'beast-skill-description'));
  appendSkillDetails(ui, row, skill);
  if (progress) row.append(ui.el('p', progress, 'beast-skill-counter'));
  return row;
}

function appendSkillProgress(ui, row, progress, name) {
  if (!progress?.label) return;
  const box = ui.el('div', undefined, 'beast-skill-meter');
  box.dataset.kind = progress.kind;
  box.dataset.status = progress.status;
  box.append(ui.el('p', progress.label, 'beast-skill-meter-label'));
  if (
    progress.kind !== 'status' &&
    Number.isFinite(progress.value) &&
    Number.isFinite(progress.max) &&
    progress.max > 0
  ) {
    const value = Math.max(0, Math.min(progress.max, progress.value));
    const track = ui.el('div', undefined, 'beast-skill-meter-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', name);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(progress.max));
    track.setAttribute('aria-valuenow', String(value));
    track.setAttribute('aria-valuetext', progress.label);
    if (progress.kind !== 'probability' && Number.isInteger(progress.max) && progress.max <= 5) {
      track.classList.add('is-segmented');
      for (let index = 0; index < progress.max; index++) {
        const segment = ui.el('span', undefined, index < value ? 'is-filled' : '');
        segment.setAttribute('aria-hidden', 'true');
        track.append(segment);
      }
    } else {
      const fill = ui.el('span', undefined, 'beast-skill-meter-fill');
      fill.style.width = `${(value / progress.max) * 100}%`;
      fill.setAttribute('aria-hidden', 'true');
      track.append(fill);
    }
    box.append(track);
  }
  if (progress.hint) box.append(ui.el('p', progress.hint, 'beast-skill-meter-hint'));
  row.append(box);
}

function appendSkillDetails(ui, row, skill) {
  if (!skill.details?.length) return;
  const details = ui.el('details', undefined, 'beast-skill-details');
  details.append(ui.el('summary', 'Thưởng và phạt được tính thế nào?'));
  for (const text of skill.details) details.append(ui.el('p', text));
  row.append(details);
}

export function beastAbilities(ui, data, beast, form = beastProgress(data, beast).form, panel) {
  if (beastSkillsV2(data, beast)) return beastAbilitiesV2(ui, data, beast, form, panel);
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
  const heading = ui.el('div', undefined, 'beast-support-heading');
  heading.append(
    ui.el(
      'h2',
      panel === 'companion'
        ? 'Năng lực đồng hành'
        : panel === 'training'
          ? 'Năng lực hiện tại'
          : `Năng lực T${form}`,
    ),
  );
  if (panel) {
    section.dataset.panel = panel;
    heading.append(ui.el('span', `T${form}`, 'beast-stage-badge'));
  }
  section.append(heading);
  const transition = beastRoadmapSkillsV2(data, beast) && beastSkillTransitionV2(data);
  if (transition)
    section.append(ui.el('p', transition, 'beast-skill-context beast-skill-transition'));
  if (!current || preview || !panel)
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
    if (panel) row.classList.add('beast-role-ultimate');
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
  if (beastRoadmapSkillsV2(data, beast)) return beastRoadmapV2(ui, data, beast);
  const p = beastProgress(data, beast),
    skills = data.config.skills[beast.speciesId];
  const section = ui.el('section', undefined, 'beast-roadmap');
  section.setAttribute('aria-label', 'Năng lực qua từng mốc');
  const summary = ui.el('section', undefined, 'beast-individual-summary');
  summary.dataset.beastId = beast.id;
  summary.dataset.attemptId = beast.attemptId;
  summary.setAttribute('aria-label', 'Tiến độ cá thể');
  const identity = ui.el('div', undefined, 'beast-individual-heading');
  const status = {
    ready: 'Chưa luyện',
    training: 'Đang luyện',
    sealed: 'Đã khóa lượt',
    completed: 'Luyện hoàn tất',
  };
  identity.append(
    ui.el('strong', beastIdentity(beast)),
    ui.el('span', status[beast.attempt.status]),
  );
  summary.append(identity, beastTrainingTotals(ui, beast, p));
  section.append(summary);
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
  if (beastSkillsV2(data, beast)) return beastMilestonesV2(ui, data, beast);
  const p = beastProgress(data, beast),
    skills = data.config.skills[p.species.id];
  const section = ui.el('section', undefined, 'beast-milestones');
  section.append(ui.el('h2', 'Khi luyện đầy T4'));
  for (const [percent, name, description, opened] of [
    [95, skills.awakening.name, beastSkillLabel(skills.awakening), p.awakened],
    [100, skills.ultimate.name, beastUltimateText[skills.ultimate.kind], p.perfect],
  ]) {
    const row = ui.el('div', undefined, 'beast-milestone' + (opened ? ' is-open' : ''));
    const copy = ui.el('div');
    copy.append(ui.el('h3', name), ui.el('p', description, 'hint'));
    row.append(
      ui.el('span', percent === 95 ? 'Thức tỉnh · ≥95%' : 'Hoàn mỹ · 100%', 'beast-milestone-mark'),
      copy,
    );
    section.append(row);
  }
  section.append(ui.el('p', 'Mỗi tài khoản được kích hoạt một tuyệt kỹ mỗi tuần.', 'hint'));
  return section;
}

function beastAbilitiesV2(ui, data, beast, form, panel) {
  const p = beastProgress(data, beast),
    skills = beastSkillsV2(data, beast);
  const section = ui.el('section', undefined, 'card beast-support');
  section.dataset.skillVersion = '2';
  if (panel) section.dataset.panel = panel;
  section.append(ui.el('h2', panel === 'companion' ? 'Năng lực đồng hành' : `Năng lực T${form}`));
  const current = data.roles.current.some(
    (role) =>
      role.role === 'companion' && role.beastId === beast.id && role.attemptId === beast.attemptId,
  );
  const pending = data.roles.pending.some(
    (role) =>
      role.role === 'companion' && role.beastId === beast.id && role.attemptId === beast.attemptId,
  );
  if (!current || form !== p.form)
    section.append(
      ui.el(
        'p',
        form !== p.form
          ? `Đang xem T${form} · Cá thể hiện ở T${p.form}`
          : pending
            ? 'Đồng hành có hiệu lực từ ngày mai'
            : 'Chọn làm đồng hành để nhận hiệu ứng kỹ năng',
        'beast-skill-context',
      ),
    );
  if (skills.activity?.tasks)
    section.append(
      ui.el('p', 'Thiên phú xét 5 công việc hợp lệ đầu tiên mỗi ngày.', 'beast-skill-limit'),
    );
  const meters = current && form === p.form ? beastSkillProgressV2(data, beast) : {};
  for (const skill of beastStageSkillsV2(skills, form)) {
    const row = skillEntry(ui, skill, skill.description);
    appendSkillProgress(ui, row, meters[skill.id], skill.name);
    section.append(row);
  }
  if (form === p.form) {
    for (const [skill, opened, label] of [
      [skills.awakening, p.awakened, 'Thức tỉnh'],
      [skills.perfect, p.perfect, 'Hoàn mỹ'],
    ]) {
      if (!opened) continue;
      const row = skillEntry(ui, skill, skill.description);
      row.prepend(ui.el('span', label, 'beast-skill-tier'));
      appendSkillProgress(ui, row, meters[skill.id], skill.name);
      section.append(row);
    }
    if (current) {
      const progress = beastProgressV2(data, beast, p);
      if (progress.length) {
        const state = ui.el('div', undefined, 'beast-skill-progress');
        state.setAttribute('aria-label', 'Tiến trình kỹ năng tự động');
        for (const line of progress) state.append(ui.el('p', line, 'beast-skill-counter'));
        section.append(state);
      }
    }
  }
  section.append(
    ui.button(
      'Toàn bộ năng lực ›',
      () => ui.showBeast(beast, undefined, true),
      'text-button beast-abilities-link',
    ),
  );
  return section;
}

function beastRoadmapV2(ui, data, beast) {
  const p = beastProgress(data, beast),
    skills = beastRoadmapSkillsV2(data, beast),
    transition = beastSkillTransitionV2(data);
  const section = ui.el('section', undefined, 'beast-roadmap');
  section.dataset.skillVersion = '2';
  section.setAttribute('aria-label', 'Năng lực qua từng mốc');
  if (transition) {
    section.dataset.skillPreview = 'true';
    const notice = ui.el('p', transition, 'beast-skill-context beast-skill-transition');
    notice.setAttribute('role', 'status');
    section.append(ui.el('strong', 'Bộ kỹ năng mới đã chốt'), notice);
  }
  section.append(ui.el('p', skills.summary, 'beast-skill-description'));
  if (skills.activity?.tasks)
    section.append(
      ui.el('p', 'Thiên phú xét 5 công việc hợp lệ đầu tiên mỗi ngày.', 'beast-skill-limit'),
    );
  const track = ui.el('div', undefined, 'beast-roadmap-track');
  for (let form = 1; form <= 4; form++) {
    const step = ui.el(
      'section',
      undefined,
      'beast-roadmap-step' + (form === p.form ? ' is-current' : ''),
    );
    step.dataset.tier = String(form);
    const header = ui.el('div', undefined, 'beast-roadmap-heading');
    header.append(ui.el('h2', `T${form}`));
    if (form === p.form)
      header.append(
        ui.el('span', transition ? 'Hình thái hiện tại' : 'Hiện tại', 'beast-stage-badge'),
      );
    else if (form < p.form) header.append(ui.el('span', 'Đã đạt', 'beast-roadmap-status'));
    step.append(header);
    for (const skill of beastStageSkillsV2(skills, form))
      step.append(skillEntry(ui, skill, skill.description));
    track.append(step);
  }
  track.append(beastMilestonesV2(ui, data, beast, skills));
  section.append(track);
  const rules = ui.el('details', undefined, 'beast-skill-rules');
  rules.append(ui.el('summary', 'Quy ước chung'));
  for (const text of beastRulesV2(skills)) rules.append(ui.el('p', text));
  section.append(rules);
  return section;
}

function beastMilestonesV2(ui, data, beast, roadmapSkills = null) {
  const p = beastProgress(data, beast),
    skills = roadmapSkills ?? beastSkillsV2(data, beast);
  const section = ui.el('section', undefined, 'beast-milestones');
  section.append(ui.el('h2', 'Luyện đầy T4 để mở các mốc độ thuần'));
  for (const [percent, skill, opened] of [
    [95, skills.awakening, p.awakened],
    [100, skills.perfect, p.perfect],
  ]) {
    const row = ui.el('div', undefined, 'beast-milestone' + (opened ? ' is-open' : ''));
    row.dataset.tier = String(percent);
    const copy = ui.el('div');
    copy.append(ui.el('h3', skill.name), ui.el('p', skill.description, 'hint'));
    appendSkillDetails(ui, copy, skill);
    row.append(
      ui.el('span', percent === 95 ? 'Thức tỉnh · ≥95%' : 'Hoàn mỹ · 100%', 'beast-milestone-mark'),
      copy,
    );
    section.append(row);
  }
  return section;
}

function beastTrainingTotals(ui, beast, progress, includePurity = true) {
  const totals = ui.el('dl', undefined, 'beast-training-totals');
  const values = [
    [
      'Điểm thực',
      `${beastPoints(beast.attempt.earned)} / ${beastPoints(progress.capacity - beast.attempt.gray)}`,
    ],
    ['Tạp chất tích lũy', beastPoints(beast.attempt.gray)],
  ];
  if (includePurity) values.push(['Độ thuần', beastPurityLabel(progress)]);
  for (const [label, value] of values) {
    const row = ui.el('div');
    row.append(ui.el('dt', label), ui.el('dd', value));
    totals.append(row);
  }
  return totals;
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
  const projection = pending ? null : beastTrainingProjection(data, beast);
  const day = el('div', undefined, 'beast-progress-day');
  const previewEarned = el('div', undefined, 'beast-progress-preview-earned');
  const previewGray = el('div', undefined, 'beast-progress-preview-gray');
  const total = projection?.total ?? 0;
  day.style.width = (total / p.stageCapacity) * 100 + '%';
  previewEarned.style.width = (total ? (projection.earned / total) * 100 : 0) + '%';
  previewGray.style.width = (total ? (projection.gray / total) * 100 : 0) + '%';
  day.append(previewEarned, previewGray);
  earned.style.width = (p.stageEarned / p.stageCapacity) * 100 + '%';
  gray.style.width = (p.stageGray / p.stageCapacity) * 100 + '%';
  track.append(earned, day, el('div', undefined, 'beast-progress-empty'), gray);
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
  section.append(beastJourney(ui, data, beast), heading, numbers, track);
  if (projection) {
    const text = `Hôm nay dự tính: +${beastPoints(projection.delta.earned)} điểm thực · ${beastPoints(projection.delta.gray)} tạp chất`;
    const forecast = el('p', text, 'beast-training-forecast');
    forecast.setAttribute('role', 'status');
    section.append(forecast);
    track.setAttribute('aria-valuetext', track.getAttribute('aria-valuetext') + '. ' + text);
  }
  if (p.completed && p.form === 4)
    section.append(el('p', 'Độ thuần cuối lượt · ' + beastPurityLabel(p), 'beast-training-result'));
  if (message) section.append(el('p', message, 'beast-stage-message'));
  if (p.stageGray > 0 && !p.blocked)
    section.append(
      el(
        'p',
        `${beastPoints(p.stageGray)} điểm trong chặng này bị tạp chất chiếm.`,
        'beast-gray-note',
      ),
    );
  if (p.form < 4) {
    const evolve = button('Tiến hóa', () => ui.evolveBeast(beast), 'primary beast-evolve-button');
    evolve.disabled =
      !p.canEvolve ||
      p.blocked ||
      beast.attempt.status === 'sealed' ||
      pending ||
      data.busy ||
      ui.beastPending();
    section.append(evolve);
    if (!p.blocked && beast.attempt.status !== 'sealed')
      section.append(beastUpgrade(ui, data, beast));
  }
  const details = el('details', undefined, 'beast-training-details');
  details.append(
    el('summary', 'Điểm thực và tạp chất'),
    beastTrainingTotals(ui, beast, p, !(p.completed && p.form === 4)),
  );
  section.append(details);
  return section;
}
// Keep decoded art and navigation nodes alive through role switches and refreshes.
export function reconcileBeasts(current, next) {
  if (!current) return next;
  // A shorter role panel must not clamp the scroll and move the retained portrait.
  if (current.dataset.rolePanel && next.dataset.rolePanel && window.scrollY > 0) {
    const bottomPadding = parseFloat(getComputedStyle(current.parentElement).paddingBottom) || 0;
    const visibleTop = current.getBoundingClientRect().top;
    current.style.minHeight = Math.max(0, window.innerHeight - visibleTop - bottomPadding) + 'px';
  } else current.style.removeProperty('min-height');
  const retained = new Map();
  const oldProgress = current.querySelector(':scope > .beast-progress');
  const freshProgress = next.querySelector(':scope > .beast-progress');
  const oldTrack = current.querySelector('.beast-progress-track');
  const freshTrack = next.querySelector('.beast-progress-track');
  if (oldTrack && freshTrack && oldTrack.children.length === freshTrack.children.length) {
    for (const { name } of [...oldTrack.attributes])
      if (!freshTrack.hasAttribute(name)) oldTrack.removeAttribute(name);
    for (const { name, value } of freshTrack.attributes) oldTrack.setAttribute(name, value);
    for (const name of ['earned', 'day', 'preview-earned', 'preview-gray', 'gray']) {
      const oldPart = oldTrack.querySelector('.beast-progress-' + name);
      const freshPart = freshTrack.querySelector('.beast-progress-' + name);
      if (oldPart && freshPart) oldPart.setAttribute('style', freshPart.getAttribute('style'));
    }
    retained.set(freshTrack, oldTrack);
  }
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
  // Keep the progress card and track connected while updating siblings. Moving a
  // track through a detached card cancels its CSS width transitions.
  if (oldProgress && freshProgress && retained.get(freshTrack) === oldTrack) {
    for (const { name } of [...oldProgress.attributes])
      if (!freshProgress.hasAttribute(name)) oldProgress.removeAttribute(name);
    for (const { name, value } of freshProgress.attributes) oldProgress.setAttribute(name, value);
    const oldDetails = oldProgress.querySelector('.beast-training-details');
    const freshDetails = freshProgress.querySelector('.beast-training-details');
    if (oldDetails && freshDetails) freshDetails.open = oldDetails.open;
    const children = [...freshProgress.childNodes].map((child) => {
      if (child === freshTrack) return oldTrack;
      return [...oldProgress.childNodes].find((old) => old.isEqualNode(child)) ?? child;
    });
    const keepChildren = new Set(children);
    for (const child of [...oldProgress.childNodes]) if (!keepChildren.has(child)) child.remove();
    let progressCursor = oldProgress.firstChild;
    for (const child of children) {
      if (child === progressCursor) progressCursor = progressCursor.nextSibling;
      else oldProgress.insertBefore(child, progressCursor);
    }
    retained.set(freshProgress, oldProgress);
  }
  current.className = next.className;
  if (next.dataset.rolePanel) current.dataset.rolePanel = next.dataset.rolePanel;
  else delete current.dataset.rolePanel;
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
  const furnace = button('', ui.openBeastAlchemy, 'beast-alchemy-entry');
  const flask = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  flask.setAttribute('viewBox', '0 0 24 24');
  flask.setAttribute('aria-hidden', 'true');
  flask.setAttribute('focusable', 'false');
  flask.setAttribute('fill', 'none');
  flask.setAttribute('stroke', 'currentColor');
  flask.setAttribute('stroke-width', '1.6');
  flask.setAttribute('stroke-linecap', 'round');
  flask.setAttribute('stroke-linejoin', 'round');
  const flaskPath = document.createElementNS(flask.namespaceURI, 'path');
  flaskPath.setAttribute('d', 'M9 3h6M10 3v6L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 14h8');
  flask.append(flaskPath);
  furnace.append(flask, el('span', 'Lò đan'));
  if (alchemy) furnace.append(el('span', ` · ${alchemy.days}/30`, 'beast-alchemy-entry-count'));
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
  if (['training', 'companion'].includes(panel)) root.dataset.rolePanel = panel;
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
          ? 'Thói quen mỗi ngày nuôi dưỡng linh thú. Từng phần nỗ lực đều được ghi lại.'
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
  const copy = el('div', undefined, 'beast-hero-copy'),
    meta = el('div', undefined, 'beast-hero-meta');
  meta.append(
    el('span', `${p.species.rank} · T${p.form}`, 'beast-rank'),
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
  copy.append(el('h2', p.species.forms[p.form - 1]), meta);
  const skillsV2 = beastSkillsV2(data, beast);
  if (skillsV2) copy.append(el('p', skillsV2.summary, 'beast-skill-description'));
  if (p.awakened || p.perfect)
    copy.append(
      el(
        'span',
        p.perfect ? '100% · Hoàn mỹ' : beastPurityLabel(p) + ' · Thức tỉnh',
        'beast-quality-label',
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
      document.createTextNode(
        panel === 'training' ? 'Thói quen hôm nay vẫn tính cho ' : 'Hôm nay, ',
      ),
      name,
      document.createTextNode(panel === 'training' ? '.' : ' vẫn hỗ trợ bạn.'),
    );
    root.append(note);
  }
  if (panel === 'training') {
    root.append(
      beastTrainingCard(ui, { ...data, busy: state.beastBusy }, beast, !!pending),
      beastAbilities(ui, data, beast, p.form, panel),
    );
    if (p.form === 4 && !p.completed) root.append(beastMilestones(ui, data, beast));
    return root;
  }
  root.append(beastAbilities(ui, data, beast, p.form, panel));
  return root;
}
export function updateBeastProtectionButton(star, beast, change = null) {
  const protectedValue = change?.desired ?? !!beast.isProtected;
  const status = change?.status ?? 'saved';
  star.classList.toggle('is-protected', protectedValue);
  star.dataset.protectionId = beast.id;
  star.dataset.protectionStatus = status;
  star.setAttribute('aria-pressed', String(protectedValue));
  star.setAttribute('aria-busy', String(status === 'saving' || status === 'queued'));
  star.setAttribute(
    'aria-label',
    `${protectedValue ? 'Bỏ bảo vệ' : 'Bảo vệ'} ${beastIdentity(beast)}${status === 'unconfirmed' ? ' · Chưa xác nhận lưu' : status !== 'saved' ? ' · Đang lưu' : ''}`,
  );
  star.title =
    status === 'unconfirmed'
      ? 'Chưa xác nhận lưu · Kiểm tra kết quả trước khi tiếp tục'
      : status !== 'saved'
        ? 'Đang lưu dấu sao…'
        : protectedValue
          ? 'Đã bảo vệ · Không thể hiến tế'
          : 'Đánh dấu sao để bảo vệ khỏi hiến tế';
}
export function beastProtectionButton(ui, state, beast, onChange = ui.toggleBeastProtection) {
  const star = ui.button('', () => onChange(beast), 'beast-protection');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const path = document.createElementNS(icon.namespaceURI, 'path');
  path.setAttribute(
    'd',
    'M12 3.4 14.62 8.72 20.49 9.58 16.25 13.71 17.25 19.55 12 16.79 6.75 19.55 7.75 13.71 3.51 9.58 9.38 8.72Z',
  );
  icon.append(path);
  star.append(icon);
  updateBeastProtectionButton(star, beast, state.beastProtectionChanges?.get(beast.id));
  star.disabled = !state.beastProtectionSaving && (state.beastBusy || ui.beastPending());
  return star;
}

/** @param {{onSelect?: (beast:any)=>void, onDetails?: (beast:any)=>void, selected?: boolean, blockedReason?: string, points?: number}} options */
export function beastCollectionCard(ui, state, beast, options = {}) {
  const { el, button } = ui,
    data = state.beastData,
    p = beastProgress(data, beast);
  const wrapper = el('div', undefined, 'beast-collection-item');
  wrapper.classList.toggle('is-picker', !!options.onSelect);
  wrapper.classList.toggle('is-selected', !!options.selected);
  const b = button('', () => (options.onSelect ?? ui.showBeast)(beast), 'beast-collection-card');
  b.dataset.rank = p.species.rank;
  b.dataset.beastId = beast.id;
  b.classList.toggle('is-selected', !!options.selected);
  if (options.onSelect) {
    b.setAttribute('aria-pressed', String(!!options.selected));
    b.disabled = !!options.blockedReason || state.beastBusy || ui.beastPending();
  }
  const heading = el('span', undefined, 'beast-card-heading');
  heading.append(
    el('span', p.species.rank, 'beast-card-rank'),
    el('span', beastIdentity(beast), 'beast-card-number'),
  );
  b.append(
    heading,
    image(ui, p.species, p.form, true, p.perfect, p.awakened),
    el('strong', p.species.forms[p.form - 1]),
    el(
      'small',
      `T${p.form} · ${beast.attempt.status === 'sealed' ? 'Đã khóa lượt' : beast.attempt.status === 'completed' ? 'Hoàn tất' : beast.attempt.status === 'training' ? 'Đang luyện' : 'Chưa luyện'}`,
      'beast-card-stage',
    ),
  );
  if (!options.onSelect) b.append(el('small', beastPurityLabel(p), 'beast-card-purity'));
  const roles = data.roles.current.filter(
    (role) => role.beastId === beast.id && role.attemptId === beast.attemptId,
  );
  if (!options.onSelect)
    b.append(
      el(
        'small',
        roles.length
          ? roles.map((role) => (role.role === 'training' ? 'Đang luyện' : 'Đồng hành')).join(' · ')
          : 'Chưa nhận vai trò',
        'beast-card-roles' + (roles.length ? '' : ' is-idle'),
      ),
    );
  if (options.onSelect) {
    const selection = el('small', undefined, 'beast-card-selection');
    selection.classList.toggle('is-blocked', !!options.blockedReason);
    const check = el(
      'span',
      options.blockedReason ? '·' : options.selected ? '✓' : '',
      'beast-card-check',
    );
    check.setAttribute('aria-hidden', 'true');
    selection.append(
      check,
      el(
        'span',
        options.blockedReason || `${options.selected ? 'Đã chọn · ' : ''}${options.points} điểm`,
      ),
    );
    b.append(selection);
  }
  const star = beastProtectionButton(ui, state, beast);
  if (options.onSelect) {
    star.disabled = true;
    star.dataset.protectionReadonly = 'true';
    star.title = beast.isProtected
      ? 'Đã bảo vệ · Bỏ bảo vệ trong chi tiết cá thể'
      : 'Bật bảo vệ trong chi tiết cá thể';
  }
  wrapper.append(b, star);
  if (options.onDetails)
    wrapper.append(
      button('Xem chi tiết', () => options.onDetails(beast), 'text-button beast-card-details'),
    );
  return wrapper;
}

function collection(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData;
  const beasts = state.beastSpeciesPage?.beasts ?? [];
  const selectedSpecies = beastSpecies(data, state.beastCollectionSpecies);
  if (!selectedSpecies) return speciesCollection(ui, state, root);
  const label = el('div', undefined, 'beast-collection-heading beast-species-heading');
  const meta = el('div', undefined, 'beast-species-meta');
  meta.dataset.rank = selectedSpecies.rank;
  meta.append(
    el('span', selectedSpecies.rank, 'beast-species-rank'),
    el('span', `· ${data.speciesCounts?.[selectedSpecies.id] ?? 0} cá thể đang sở hữu`, 'hint'),
  );
  label.append(el('h2', selectedSpecies.title), meta);
  root.append(
    button('‹ Bộ sưu tập', () => ui.openBeastSpecies(null), 'text-button beast-collection-back'),
    label,
  );
  const representative = data.collectionOverview?.[selectedSpecies.id]?.best;
  const history = data.discoveries?.[selectedSpecies.id];
  const views = [representative, ...beasts, ...(data.selected ?? [])]
    .filter((entry) => entry?.speciesId === selectedSpecies.id)
    .map((entry) => beastProgress(data, entry));
  const knownForm = Math.max(history?.form ?? 1, ...views.map((view) => view.form));
  const knownForms = [
    ...Array.from({ length: 4 }, (_, index) => index < knownForm),
    !!history?.awakened || views.some((view) => view.awakened),
    !!history?.perfect || views.some((view) => view.perfect),
  ];
  const discovery = el('div', undefined, 'beast-species-discovery');
  const steps = el('div', undefined, 'beast-discovery-steps');
  steps.setAttribute('aria-hidden', 'true');
  for (const known of knownForms) {
    steps.append(el('span', undefined, 'beast-discovery-step' + (known ? ' is-known' : '')));
  }
  discovery.append(
    el('p', `Đã khám phá ${knownForms.filter(Boolean).length}/${knownForms.length} dạng`),
    steps,
  );
  root.append(discovery);
  const grid = el('div', undefined, 'beast-collection-grid');
  for (const beast of beasts.filter((entry) => entry.speciesId === selectedSpecies.id)) {
    grid.append(beastCollectionCard(ui, state, beast));
  }
  root.append(grid);
  if (state.beastSpeciesError)
    root.append(
      el('p', state.beastSpeciesError, 'hint'),
      button('Thử lại', () => ui.loadBeasts(!!state.beastSpeciesPage, 'species'), 'secondary'),
    );
  if (state.beastSpeciesLoading && !beasts.length)
    root.append(el('p', 'Đang tải các cá thể…', 'hint'));
  if (
    !state.beastSpeciesLoading &&
    !state.beastSpeciesError &&
    state.beastSpeciesPage &&
    !beasts.length
  )
    root.append(
      el('p', 'Hiện không còn cá thể của loài này. Các dạng đã khám phá vẫn được lưu.', 'hint'),
    );
  if (state.beastSpeciesPage?.nextCursor) {
    const more = button(
      state.beastSpeciesLoading ? 'Đang tải các cá thể…' : 'Tải tiếp các cá thể',
      () => ui.loadBeasts(true, 'species'),
      'secondary',
    );
    more.disabled = state.beastSpeciesLoading;
    root.append(more);
  }
  return root;
}
function speciesCollection(ui, state, root) {
  const { el, button } = ui,
    data = state.beastData;
  const catalog = data.config.catalog;
  const discoveredCount = catalog.filter(
    (species) => (data.speciesCounts?.[species.id] ?? 0) > 0 || !!data.discoveries?.[species.id],
  ).length;
  const label = el('div', undefined, 'beast-collection-heading');
  const count = el('span', undefined, 'beast-catalog-count');
  count.append(el('strong', String(discoveredCount)), el('span', `/${catalog.length} loài`));
  label.append(el('h2', 'Bộ sưu tập'), count);
  const progress = el('div', undefined, 'beast-catalog-track');
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Số loài đã khám phá');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', String(catalog.length));
  progress.setAttribute('aria-valuenow', String(discoveredCount));
  const fill = el('span');
  fill.style.width = (catalog.length ? (100 * discoveredCount) / catalog.length : 0) + '%';
  progress.append(fill);
  root.append(label, progress);
  const atlas = el('div', undefined, 'beast-atlas');
  for (const species of catalog) {
    const count = data.speciesCounts?.[species.id] ?? 0;
    const discovered = count > 0 || !!data.discoveries?.[species.id];
    const entry = button(
      '',
      () => ui.openBeastSpecies(species.id),
      'beast-atlas-entry' + (discovered ? '' : ' is-unowned'),
    );
    entry.disabled = !discovered;
    const rankLabel = el('span', discovered ? species.rank : '', 'beast-atlas-rank');
    rankLabel.setAttribute('aria-hidden', 'true');
    entry.append(rankLabel);
    if (discovered) entry.dataset.rank = species.rank;
    if (count) {
      entry.dataset.species = species.id;
      const representative = data.collectionOverview?.[species.id]?.best;
      const best = representative && beastProgress(data, representative);
      if (best) {
        entry.append(
          image(ui, species, best.form, true, best.perfect, best.awakened),
          el('strong', species.forms[best.form - 1]),
        );
      } else {
        entry.append(paw(el), el('strong', 'Đang tải…'));
      }
      const metadata = el('small');
      metadata.append(
        el('span', `${species.rank} · `, 'beast-atlas-meta-rank'),
        document.createTextNode(`${count} cá thể`),
      );
      entry.append(metadata);
    } else if (discovered) {
      entry.dataset.species = species.id;
      entry.append(
        image(ui, species, data.discoveries[species.id].form, true),
        el('strong', species.title),
        el('small', 'Đã khám phá · 0 cá thể'),
      );
    } else {
      const unknown = el('small', '· · ·');
      unknown.setAttribute('aria-hidden', 'true');
      entry.append(paw(el), el('strong', 'Chưa khám phá'), unknown);
      entry.setAttribute('aria-label', 'Linh thú chưa khám phá');
    }
    atlas.append(entry);
  }
  root.append(
    atlas,
    el('p', 'Mỗi giao ước, thêm một dấu mốc trên hành trình.', 'beast-catalog-note'),
  );
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
              ? 'Còn thiếu công việc hoàn tất hợp lệ hôm nay.'
              : 'Hoàn thành đủ thói quen hôm nay để mở tháp.',
      'hint',
    ),
  );
  const action = button(run ? 'Xem lượt tháp' : 'Vào tháp', ui.openBeastTower, 'secondary');
  box.append(copy, action);
  return box;
}
