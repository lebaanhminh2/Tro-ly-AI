import { BEAST_ART } from '../assets/linh-thu/art.js';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const percentNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const skillItems = {
  basic: 'phù sơ cấp',
  middle: 'phù trung cấp',
  high: 'phù cao cấp',
  supreme: 'phù tối cao',
  heart: 'Hộ Tâm Phù',
  peace: 'An Tâm Phù',
  keepsake: 'tín vật',
};
export const beastPoints = (value) => number.format(value / 10);
export const beastIdentity = (beast) =>
  Number.isSafeInteger(beast.individualNumber) && beast.individualNumber > 0
    ? '#' + beast.individualNumber
    : '#' + beast.id.slice(-8).replaceAll('_', '-').toUpperCase();
export function beastPurityLabel(progress) {
  if (progress.purity === null) return 'Chưa xác định';
  if (progress.perfect) return '100% · Hoàn mỹ';
  const percent =
    progress.purity === 1 ? 100 : Math.min(99.9, Math.floor(progress.purity * 1000) / 10);
  return (
    number.format(percent) +
    '%' +
    (progress.status === 'sealed' ? ' · Đã khóa' : progress.completed ? '' : ' · Tạm tính')
  );
}
export function beastSpecies(data, id) {
  return data?.config.catalog.find((species) => species.id === id);
}
export function beastProgress(data, beast) {
  const species = beastSpecies(data, beast.speciesId);
  const rule = data.config.training[species.rank];
  const occupied = beast.attempt.earned + beast.attempt.gray;
  const form =
    beast.attempt.form ?? 1 + rule.thresholds.filter((threshold) => occupied >= threshold).length;
  const start = form === 1 ? 0 : rule.thresholds[form - 2];
  const end = form === 4 ? rule.capacity : rule.thresholds[form - 1];
  const attainable = rule.capacity - beast.attempt.gray;
  return {
    species,
    status: beast.attempt.status,
    form,
    capacity: rule.capacity,
    occupied,
    stageStart: start,
    stageEnd: end,
    stageCapacity: end - start,
    stageEarned: Math.max(0, Math.min(end, beast.attempt.earned) - start),
    stageGray: Math.max(0, end - Math.max(start, attainable)),
    canEvolve:
      form < 4 &&
      beast.attempt.earned >= end &&
      ['training', 'completed'].includes(beast.attempt.status),
    blocked: form < 4 && attainable < end,
    needed: Math.max(0, end - beast.attempt.earned),
    purity: occupied ? beast.attempt.earned / occupied : null,
    completed: occupied === rule.capacity,
    perfect: form === 4 && occupied === rule.capacity && beast.attempt.gray === 0,
    awakened:
      form === 4 &&
      occupied === rule.capacity &&
      beast.attempt.gray <= Math.floor(rule.capacity / 20),
  };
}
export function beastDiscovery(data, beast) {
  const history = data.discoveries?.[beast.speciesId];
  const views = [...(data.selected ?? []), beast]
    .filter((entry) => entry.speciesId === beast.speciesId)
    .map((entry) => beastProgress(data, entry));
  return {
    form: Math.max(history?.form ?? 1, ...views.map((view) => view.form)),
    awakened: !!history?.awakened || views.some((view) => view.awakened),
    perfect: !!history?.perfect || views.some((view) => view.perfect),
  };
}
/** Server projections never change the committed attempt or evolution eligibility. */
export function beastTrainingProjection(data, beast, now = Date.now()) {
  const response = data?.trainingPreview,
    preview = response?.preview;
  const current = roleBeast(data, 'training');
  if (
    !preview ||
    !current ||
    !data.day ||
    response.day?.day !== data.day.day ||
    !Number.isFinite(response.receivedAt) ||
    !Number.isFinite(response.now) ||
    !Number.isFinite(response.day.endAt) ||
    response.now + Math.max(0, now - response.receivedAt) >= response.day.endAt ||
    current.id !== beast.id ||
    current.attemptId !== beast.attemptId ||
    preview.beastId !== beast.id ||
    preview.attemptId !== beast.attemptId ||
    preview.base?.earned !== beast.attempt.earned ||
    preview.base?.gray !== beast.attempt.gray ||
    preview.base?.form !== (beast.attempt.form ?? null) ||
    preview.base?.status !== beast.attempt.status ||
    !['ready', 'training'].includes(beast.attempt.status)
  )
    return null;
  const p = beastProgress(data, beast),
    delta = preview.delta;
  if (
    p.completed ||
    !delta ||
    ![delta.earned, delta.gray].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    delta.earned + delta.gray > p.capacity - p.occupied
  )
    return null;
  const room = Math.max(0, p.stageCapacity - p.stageEarned - p.stageGray);
  const earned = Math.min(room, delta.earned);
  const gray = Math.min(Math.max(0, room - earned), delta.gray);
  return { delta, earned, gray, total: earned + gray };
}
export function beastTalentChance(skill, form, index) {
  const scale = index === 0 ? form / 4 : form < 3 ? 0 : form === 3 ? 0.5 : 1;
  return percentNumber.format(skill.chance * scale * 100) + '%';
}
export function beastTalentUpgrade(skill, from, to, index) {
  if (index > 0 && from < 3) return 'Mở mới · ' + beastTalentLabel(skill, to, index);
  return `Cơ hội ${skill.refund ? 'hoàn tu vi' : 'nhận thưởng'}: ${beastTalentChance(skill, from, index)} → ${beastTalentChance(skill, to, index)}.`;
}
/** @param {Record<string, {full: string, thumb: string, kind: string}>} [art] */
export function beastArtwork(
  species,
  form,
  thumbnail = false,
  perfect = false,
  art = BEAST_ART,
  awakened = false,
) {
  if (![1, 2, 3, 4].includes(form)) throw Error('INVALID_BEAST_FORM');
  const perfectArt = perfect && form === 4 ? art[`${species.id}:4:perfect`] : null;
  const awakenedArt = awakened && form === 4 ? art[`${species.id}:4:awakened`] : null;
  const selected = perfectArt ?? awakenedArt ?? art[`${species.id}:${form}:normal`];
  if (!selected) throw Error('MISSING_BEAST_ART');
  return {
    src: new URL('../assets/linh-thu/' + selected[thumbnail ? 'thumb' : 'full'], import.meta.url)
      .href,
    variant: perfectArt ? 'perfect' : awakenedArt ? 'awakened' : 'normal',
    kind: selected.kind,
  };
}
export function beastImage(species, form, thumbnail = false, perfect = false) {
  return beastArtwork(species, form, thumbnail, perfect).src;
}
export function roleBeast(data, role) {
  const selected = data?.roles.current.find((selection) => selection.role === role);
  return selected
    ? data.selected.find(
        (beast) => beast.id === selected.beastId && beast.attemptId === selected.attemptId,
      )
    : null;
}
// Presentation can follow a confirmed next-day choice without activating its effects.
export function displayedRole(data, role) {
  const current = roleBeast(data, role);
  const selection = data?.roles.pending.find((entry) => entry.role === role);
  const pending = selection
    ? data.selected.find(
        (beast) => beast.id === selection.beastId && beast.attemptId === selection.attemptId,
      )
    : null;
  return { current, pending, displayed: pending ?? current };
}
export function beastTalentLabel(skill, form, index) {
  if (index > 0 && form < 3) return 'Mở từ T3.';
  const scale = index === 0 ? form / 4 : form < 3 ? 0 : form === 3 ? 0.5 : 1;
  return beastSkillLabel({ ...skill, chance: skill.chance * scale });
}
export function beastRewardLabel(reward) {
  if (!reward) return '';
  return (
    [
      reward.tickets ? reward.tickets + ' vé thường' : '',
      reward.summonTickets ? reward.summonTickets + ' vé triệu hồi' : '',
      reward.qi ? reward.qi + ' tu vi' : '',
      ...Object.entries(reward.items ?? {}).map(
        ([item, amount]) => `${amount} ${skillItems[item]}`,
      ),
    ]
      .filter(Boolean)
      .join(' · ') || 'Chưa có quà'
  );
}
export const beastUltimateText = {
  summon_choice:
    'Lần triệu hồi tiếp theo: xem 3 ứng viên, chọn 1. Tốn 1 vé triệu hồi; bảo hiểm cập nhật một lần theo con được chọn.',
  meteor_guard:
    'Đến hết tuần: 2 lượt giữ chuỗi và tu vi khi ngủ vi phạm; 1 lượt hoàn toàn bộ tu vi thực mất do đột phá. Mỗi lượt bảo hộ còn dư đổi thành 5 tu vi.',
  frost_guard:
    'Ba lần đánh giá ngủ tiếp theo trong tuần: đúng giờ thêm 5 tu vi; vi phạm giữ chuỗi và tránh mất tu vi. Mỗi lần dùng một lượt.',
  task_bounty:
    'Sau khi kích hoạt, hoàn thành 5 công việc trước hết tuần; chọn nhận 2 vé triệu hồi hoặc 40 tu vi. Chỉ tính 5 công việc nhận thưởng đầu tiên mỗi ngày.',
  draw_three_two:
    'Ba lượt quay thường có trả vé tiếp theo: mỗi lượt xem 3 kết quả, chọn 2. Vẫn tốn 1 vé mỗi lượt.',
  tower_rescue:
    'Mỗi lượt tháp bắt đầu sau kích hoạt trong tuần: được cứu một bẫy ở tầng 1–3 và chọn lại. Tầng 4 không được cứu.',
  habit_bounty:
    'Sau khi kích hoạt, hoàn thành đủ thói quen trong 3 ngày trước hết tuần, nhận 1 vé triệu hồi. Không cần liên tiếp.',
  task_combo:
    'Ba công việc nhận thưởng tiếp theo trong ngày được thêm lần lượt 3 → 5 → 10 tu vi. Chỉ tính 5 công việc nhận thưởng đầu tiên mỗi ngày; phần chưa đạt hết hạn cuối ngày.',
  marked_tasks:
    'Chọn 2 công việc chưa hoàn thành. Mỗi công việc hoàn thành trong tuần được thêm 5 vé thường; hoàn thành cả hai được thêm 5 tu vi.',
  sleep_bounty: 'Sau kích hoạt, báo ngủ đúng giờ 3 lần trong tuần để nhận 1 vé triệu hồi.',
  breakthrough_pact:
    'Lần đột phá tiếp theo: Truy Thưởng thưởng 1 vé triệu hồi nếu thành công; Hộ Thân hoàn toàn bộ tu vi thực mất nếu thất bại. Khóa lựa chọn trước khi thử.',
  knight_guard:
    'Lần đánh giá ngủ tiếp theo: vi phạm được giữ chuỗi và tu vi; đúng giờ nhận 1 Hộ Tâm Phù và 1 An Tâm Phù.',
  double_fusion:
    'Lần ghép sơ cấp → trung cấp tiếp theo: thành công nhận 2 phù trung cấp; thất bại hoàn 1 phù sơ cấp. Vẫn cần 3 phù và giữ tỷ lệ 80%.',
  owl_guard:
    'Lần đánh giá ngủ tiếp theo: vi phạm được giữ chuỗi; đúng giờ chọn 5 vé thường hoặc 12 tu vi. Tu vi phạt vẫn theo luật thường.',
  turtle_guard:
    'Lần đột phá tiếp theo: thất bại hoàn tối đa 10 tu vi thực mất, đã gồm thiên phú; thành công thêm 5 tu vi.',
  magnet_tasks:
    'Chọn tối đa 3 công việc chưa hoàn thành. Với mỗi công việc hoàn thành trong tuần, chọn nhận thêm 1 vé thường hoặc 3 tu vi.',
  draw_two_one:
    'Lượt quay thường tiếp theo trong tuần: xem 2 kết quả và chọn 1. Vẫn trả 1 vé, không bảo đảm vật phẩm hiếm.',
  dream_bounty:
    'Sau khi kích hoạt, hoàn thành đủ thói quen trong 3 ngày trước hết tuần; chọn nhận 6 vé thường hoặc 15 tu vi.',
};
export const beastUltimateRules = {
  summon_choice:
    'Dùng 1 vé triệu hồi, chỉ nhận ứng viên được chọn. Bảo hiểm cập nhật đúng một lượt theo kết quả đã chọn; ba ứng viên dùng cùng trạng thái bảo hiểm trước lượt quay.',
  meteor_guard:
    'Chỉ tiêu hao bảo hộ khi còn thiệt hại chưa được vật phẩm bảo vệ. Cuối tuần mỗi lượt bảo hộ còn dư đổi thành 5 tu vi, tối đa 15 tu vi.',
  frost_guard:
    'Mỗi lần đánh giá ngủ đều dùng một lượt, dù đúng giờ hay vi phạm. Phải kích hoạt trước mốc giờ ngủ được bảo vệ; lượt dư hết hạn cuối tuần.',
  task_bounty:
    'Chỉ tính công việc hoàn thành sau kích hoạt, trong 5 công việc nhận thưởng đầu tiên mỗi ngày. Nhận quà một lần trước hết tuần.',
  draw_three_two:
    'Mỗi lượt vẫn trả 1 vé thường. Chọn hai ô khác nhau; vật phẩm có thể trùng. Không áp dụng cho triệu hồi linh thú.',
  tower_rescue:
    'Mỗi lượt tháp mới được cứu một bẫy ở tầng 1–3: xáo lại đúng tầng đó rồi chọn lại, vẫn có một bẫy. Gặp bẫy lần nữa sẽ mất quà. Không cứu tầng 4 và không tăng số lượt tháp mỗi ngày.',
  habit_bounty:
    'Chỉ đếm ngày hoàn thành đủ thói quen sau kích hoạt và trước hết tuần; không cần liên tiếp.',
  task_combo:
    'Chỉ tính công việc hoàn thành sau kích hoạt, trong 5 công việc nhận thưởng đầu tiên mỗi ngày. Phần thưởng chưa đạt hết hạn cuối ngày.',
  marked_tasks:
    'Chọn đúng hai công việc khác nhau chưa hoàn thành. Không đổi mục tiêu sau kích hoạt. Tổng thưởng tối đa 10 vé thường và 5 tu vi; hết hạn cuối tuần.',
  sleep_bounty:
    'Chỉ đếm báo cáo ngủ đúng giờ sau kích hoạt trong tuần. Không sửa kết quả của một đêm đã vi phạm.',
  breakthrough_pact:
    'Khóa giao ước trước khi đột phá. Truy Thưởng: thành công thêm 1 vé triệu hồi, thất bại chỉ hoàn theo thiên phú. Hộ Thân: thất bại hoàn toàn bộ tu vi thực mất, thành công không có thưởng riêng. Dùng một lần trước hết tuần.',
  knight_guard:
    'Kích hoạt trước mốc giờ ngủ được bảo vệ. Bảo hộ một lần đánh giá ngủ trong tuần; nếu đúng giờ, hai phù được đưa vào kho.',
  double_fusion:
    'Chỉ áp dụng ghép sơ cấp thành trung cấp. Vẫn cần đủ ba phù đầu vào, xác suất thành công 80%; một lần thử tiêu hao tuyệt kỹ dù kết quả nào. Hết hạn cuối tuần.',
  owl_guard:
    'Kích hoạt trước mốc giờ ngủ. Chỉ bảo vệ chuỗi ngủ, tu vi phạt vẫn theo luật thường. Hiệu lực cho một lần đánh giá ngủ trong tuần.',
  turtle_guard:
    'Mức hoàn tối đa 10 tu vi đã gồm thiên phú Thạch Giáp, không cộng thành 11. Không hoàn vượt số tu vi thực mất. Dùng một lần trước hết tuần.',
  magnet_tasks:
    'Chọn từ một đến ba công việc khác nhau chưa hoàn thành; không đổi mục tiêu sau kích hoạt. Mỗi công việc nhận quà một lần trong tuần, theo giới hạn 5 công việc nhận thưởng đầu tiên mỗi ngày.',
  draw_two_one:
    'Dùng bảng quay thường, vẫn trả 1 vé. Không bảo đảm vật phẩm hiếm và không ảnh hưởng triệu hồi linh thú. Hết hạn cuối tuần.',
  dream_bounty:
    'Chỉ đếm ngày hoàn thành đủ thói quen sau kích hoạt và trước hết tuần; không cần liên tiếp. Chọn nhận một trong hai phần thưởng.',
};
export function beastUltimateProgress(active, skill, now = Date.now()) {
  if (active.cancelled) return 'Đã hủy khi luyện lại cá thể. Hạn mức tuần vẫn đã dùng.';
  if (active.settled || now >= active.expiresAt)
    return 'Đã hết hiệu lực. Các phần thưởng đang chờ chọn vẫn được giữ.';
  const p = skill?.parameters ?? {};
  if (active.kind === 'meteor_guard')
    return `Còn ${active.sleepRemaining} lượt bảo hộ ngủ · ${active.breakthroughRemaining} lượt bảo hộ đột phá.`;
  if (['task_bounty', 'habit_bounty', 'sleep_bounty', 'dream_bounty'].includes(active.kind))
    return `Tiến độ ${active.count}/${p.target}. ${active.count >= p.target ? 'Đã đạt mục tiêu.' : 'Tiếp tục thực hiện trong thời hạn.'}`;
  if (['marked_tasks', 'magnet_tasks'].includes(active.kind))
    return `Đã hoàn thành ${active.completedTargets.length}/${active.targets.length} task đã chọn.`;
  if (active.kind === 'task_combo') return `Đã nhận ${active.count}/3 mốc thưởng trong ngày.`;
  if (active.kind === 'tower_rescue')
    return 'Mỗi lượt tháp mới trong thời hạn được cứu một bẫy tầng 1–3.';
  const pact =
    active.kind === 'breakthrough_pact'
      ? active.pact === 'guard'
        ? 'Hộ Thân · '
        : 'Truy Thưởng · '
      : '';
  return `${pact}Còn ${active.remaining} lượt hiệu ứng. ${active.remaining === 0 ? 'Lựa chọn đã tạo vẫn được giữ đến khi nhận.' : ''}`;
}
export function beastSkillLabel(skill) {
  const triggers = {
    task: 'Hoàn thành công việc',
    habit: 'Hoàn thành đủ thói quen trong ngày',
    sleep: 'Báo ngủ đúng giờ',
    combined: 'Hoàn thành đủ thói quen và báo ngủ đúng giờ trong cùng ngày',
    draw: 'Quay thường được tu vi',
    breakthrough: 'Khi đột phá thất bại',
  };
  const counted = {
    task: 'công việc nhận thưởng',
    habit: 'ngày hoàn thành đủ thói quen',
    sleep: 'lần báo ngủ đúng giờ',
    combined: 'ngày vừa đủ thói quen vừa báo ngủ đúng giờ',
    draw: 'lượt quay thường có thưởng tu vi',
  };
  const rewards = beastRewardLabel(skill.reward);
  if (skill.every)
    return skill.scope === 'week'
      ? `Trong tuần, đủ ${skill.every} ${counted[skill.trigger]}, nhận ${rewards}. Tối đa một lần/tuần.`
      : `Cứ tích lũy ${skill.every} ${counted[skill.trigger]}, nhận thêm ${rewards}.`;
  if (skill.ordinal)
    return `Hoàn thành công việc nhận thưởng thứ ${skill.ordinal} trong ngày, nhận thêm ${rewards}.`;
  if (skill.dryPity)
    return `Nếu ${skill.dryPity - 1} ngày hoàn thành đủ thói quen chưa nhận phù từ thiên phú, ngày đủ thói quen thứ ${skill.dryPity} chắc chắn nhận ${rewards}.`;
  const effect = skill.refund
    ? `được hoàn tối đa ${skill.refund} tu vi thực mất`
    : `nhận thêm ${rewards}`;
  return `${triggers[skill.trigger]}, ${skill.chance !== undefined && skill.chance < 1 ? `có ${percentNumber.format(skill.chance * 100)}% cơ hội ${effect}` : effect}.`;
}

export function beastSkillRules(skill) {
  if (skill.dryPity)
    return 'Nhận được phù từ thiên phú thì bộ đếm về 0. Tối đa một phù mỗi ngày từ thiên phú và Thức tỉnh này.';
  if (skill.every && skill.scope !== 'week')
    return 'Không cần liên tiếp. Phần tiến độ chưa đủ mốc được giữ lại.';
  if (skill.trigger === 'task')
    return 'Chỉ tính 5 công việc nhận thưởng đầu tiên mỗi ngày. Các bước nhỏ và công việc đã nhận thưởng không được tính thêm.';
  if (skill.trigger === 'draw')
    return 'Chỉ tính 10 lượt quay thường có trả vé đầu tiên mỗi ngày; mỗi lượt được tính một lần.';
  if (skill.trigger === 'habit' || skill.trigger === 'combined')
    return 'Ngày đủ thói quen: có ít nhất một thói quen hoàn thành và không có thói quen đến hạn bị bỏ lỡ. Kết quả được chốt cuối ngày.';
  return '';
}

export function beastAwakeningProgress(data, beast) {
  const p = beastProgress(data, beast),
    skill = data.config.skills[beast.speciesId].awakening;
  if (!p.awakened || (!skill.every && !skill.dryPity)) return null;
  const counters = beast.counters ?? {},
    weekly = skill.scope === 'week';
  const day = data.day?.day;
  if (weekly && !Number.isInteger(day)) return null;
  const week = day - ((((day + 3) % 7) + 7) % 7);
  const paid = weekly && counters[`weekPaid:${week}`];
  const count = weekly ? (counters[`awakening:${week}`] ?? 0) : (counters.awakening ?? 0);
  const units = {
    task: 'công việc',
    habit: 'ngày đủ thói quen',
    sleep: 'lần báo ngủ đúng giờ',
    combined: 'ngày đủ thói quen và ngủ đúng giờ',
    draw: 'lượt quay có tu vi',
  };
  return paid
    ? 'Đã nhận phần thưởng tuần này'
    : skill.dryPity
      ? `${count}/${skill.dryPity} ngày đủ thói quen chưa nhận phù`
      : `${count}/${skill.every} ${units[skill.trigger]}${weekly ? ' trong tuần' : ' tích lũy'}`;
}
