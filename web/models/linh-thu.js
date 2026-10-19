import { BEAST_ART } from '../assets/linh-thu/art.js';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
export const beastPoints = (value) => number.format(value / 10);
export const beastIdentity = (beast) => '#' + beast.id.slice(-8).replaceAll('_', '-').toUpperCase();
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
  const form = 1 + rule.thresholds.filter((threshold) => occupied >= threshold).length;
  return {
    species,
    status: beast.attempt.status,
    form,
    capacity: rule.capacity,
    occupied,
    purity: occupied ? beast.attempt.earned / occupied : null,
    completed: occupied === rule.capacity,
    perfect: occupied === rule.capacity && beast.attempt.gray === 0,
    awakened: occupied === rule.capacity && beast.attempt.gray <= Math.floor(rule.capacity / 20),
  };
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
export function beastRewardLabel(reward) {
  if (!reward) return '';
  return (
    [
      reward.tickets ? reward.tickets + ' vé thường' : '',
      reward.summonTickets ? reward.summonTickets + ' vé triệu hồi' : '',
      reward.qi ? reward.qi + ' tu vi' : '',
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
    'Hoàn thành 5 task hợp lệ sau kích hoạt trong tuần; chọn 2 vé triệu hồi hoặc 40 tu vi. Chỉ xét 5 task hợp lệ đầu mỗi ngày.',
  draw_three_two:
    'Ba lượt quay thường có trả vé tiếp theo: mỗi lượt xem 3 kết quả, chọn 2. Vẫn tốn 1 vé mỗi lượt.',
  tower_rescue:
    'Mỗi lượt tháp bắt đầu sau kích hoạt trong tuần: được cứu một bẫy ở tầng 1–3 và chọn lại. Tầng 4 không được cứu.',
  habit_bounty:
    'Tích đủ 3 ngày đủ habit sau kích hoạt trong tuần, nhận 1 vé triệu hồi. Không cần liên tiếp.',
  task_combo:
    'Ba task hợp lệ tiếp theo trong ngày thưởng lần lượt 3 → 5 → 10 tu vi. Hết ngày mất phần chưa làm; vẫn giới hạn 5 task/ngày.',
  marked_tasks:
    'Khóa 2 task chưa hoàn thành. Mỗi task hoàn thành hợp lệ trong tuần thêm 5 vé thường; hoàn thành cả hai thêm 5 tu vi.',
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
    'Khóa tối đa 3 task chưa hoàn thành. Mỗi task hoàn thành hợp lệ trong tuần được chọn thêm 1 vé thường hoặc 3 tu vi.',
  draw_two_one:
    'Lượt quay thường tiếp theo trong tuần: xem 2 kết quả và chọn 1. Vẫn trả 1 vé, không bảo đảm vật phẩm hiếm.',
  dream_bounty:
    'Tích 3 ngày vừa đủ habit vừa ngủ đúng giờ sau kích hoạt trong tuần; chọn 6 vé thường hoặc 15 tu vi.',
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
    task: 'Task hợp lệ',
    habit: 'Ngày đủ habit',
    sleep: 'Báo ngủ đúng giờ',
    combined: 'Ngày đủ habit và ngủ đúng giờ',
    draw: 'Quay thường có tu vi',
    breakthrough: 'Đột phá thất bại',
  };
  const items = {
    basic: 'phù sơ cấp',
    middle: 'phù trung cấp',
    high: 'phù cao cấp',
    supreme: 'phù tối cao',
    heart: 'Hộ Tâm Phù',
    peace: 'An Tâm Phù',
    keepsake: 'tín vật',
  };
  const rewards = [
    beastRewardLabel(skill.reward) === 'Chưa có quà' ? '' : beastRewardLabel(skill.reward),
    ...Object.entries(skill.reward?.items ?? {}).map(
      ([item, amount]) => amount + ' ' + items[item],
    ),
  ]
    .filter(Boolean)
    .join(' · ');
  const condition = skill.every
    ? `Mỗi ${skill.every} lần ${skill.scope === 'week' ? 'trong tuần' : 'tích lũy'}`
    : skill.ordinal
      ? `Lần thứ ${skill.ordinal} trong ngày`
      : skill.dryPity
        ? `Bảo đảm lần thứ ${skill.dryPity} nếu chưa trúng`
        : triggers[skill.trigger];
  return `${condition}${skill.chance !== undefined && skill.chance < 1 ? ' · ' + number.format(skill.chance * 100) + '%' : ''}: ${skill.refund ? 'hoàn tối đa ' + skill.refund + ' tu vi thực mất' : rewards}.`;
}
