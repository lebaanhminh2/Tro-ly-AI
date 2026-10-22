// Presentation consumes the server's v2 projection. Gameplay values live in domain config.
export function beastSkillsV2(data, beast) {
  if (data?.config?.skillVersion !== 2 || data.v2?.active === false) return null;
  return data.config.skillsV2?.[beast.speciesId] ?? null;
}

/** The approved roadmap is readable before rewards switch to the new rules. */
export function beastRoadmapSkillsV2(data, beast) {
  return (
    beastSkillsV2(data, beast) ??
    (beastSkillTransitionV2(data) ? (data.config?.skillsV2?.[beast.speciesId] ?? null) : null)
  );
}

export function beastSkillTransitionV2(data) {
  if (
    data?.v2?.active !== false ||
    !Number.isSafeInteger(data.v2.cutoverDay) ||
    !Number.isSafeInteger(data.day?.day) ||
    data.v2.cutoverDay <= data.day.day
  )
    return null;
  const at =
    data.v2.cutoverDay === data.day.day + 1 && Number.isFinite(data.day.endAt)
      ? data.day.endAt
      : null;
  if (at === null)
    return 'Bộ kỹ năng mới đã chốt, đang chờ ngày sinh hoạt áp dụng. Hiện tại vẫn tính thưởng theo bộ kỹ năng cũ.';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return `Bộ kỹ năng mới áp dụng từ ${parts.hour}:${parts.minute} ngày ${parts.day}/${parts.month}/${parts.year} (giờ Việt Nam). Hiện tại vẫn tính thưởng theo bộ kỹ năng cũ.`;
}

export function beastStageSkillsV2(skills, form) {
  return skills.stages?.find((stage) => stage.form === form)?.skills ?? [];
}

export function beastUpgradeV2(skills, from, to) {
  const previous = beastStageSkillsV2(skills, from);
  return beastStageSkillsV2(skills, to).map((skill) => {
    const old = previous.find((entry) => entry.id === skill.id);
    const talentIndex = Number(skill.id.replace('talent_', '')) - 1;
    const chances = skills.talentChances?.[talentIndex];
    const before = chances?.[from - 1];
    const after = chances?.[to - 1];
    const change =
      old && Number.isFinite(before) && Number.isFinite(after) && before !== after
        ? {
            from: `${Number((before * 100).toFixed(2))}%`,
            to: `${Number((after * 100).toFixed(2))}%`,
          }
        : null;
    return {
      ...skill,
      isNew: !old,
      change,
      // Only remove the exact presentation prefix supplied by the server.
      // Special effects and compatibility payloads keep their full description.
      description: change ? skill.description.replace(`: ${change.to} `, ': ') : skill.description,
    };
  });
}

const count = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** Dynamic progress belongs only to this exact, currently effective attempt. */
export function beastSkillProgressV2(data, beast) {
  const progress = data.v2?.skillProgress;
  if (
    !beastSkillsV2(data, beast) ||
    !progress ||
    progress?.beastId !== beast.id ||
    progress?.attemptId !== beast.attemptId
  )
    return {};
  const current = data.roles?.current?.some(
    (role) =>
      role.role === 'companion' && role.beastId === beast.id && role.attemptId === beast.attemptId,
  );
  return current ? (progress.items ?? {}) : {};
}

/** Shared reading conventions, rendered once instead of repeated on every skill. */
export function beastRulesV2(skills) {
  return [
    'Kỹ năng tự động khi linh thú đang đồng hành có hiệu lực và đủ điều kiện.',
    'Đủ thói quen: hoàn thành các thói quen đến hạn trong ngày. Thói quen chưa đến hạn hoặc ngày nghỉ hợp lệ không tính là bỏ lỡ. Riêng thưởng chỉ từ thói quen cần ít nhất 1 thói quen đạt.',
    'Ngày hoàn hảo: đủ thói quen, ngủ đúng giờ và hoàn thành ít nhất 1 công việc trong cùng ngày sinh hoạt.',
    'Mốc liên tiếp bị đứt khi bỏ lỡ điều kiện; mốc tích lũy được giữ lại. Nhận thưởng xong bắt đầu chu kỳ mới; chuỗi ngủ đúng giờ vẫn giữ nguyên. Kỹ năng có quy tắc riêng sẽ ghi rõ trong mô tả.',
    ...(skills?.activity?.tasks
      ? [
          'Thiên phú công việc chỉ xét 5 công việc hợp lệ đầu tiên mỗi ngày. Kỹ năng Thức tỉnh, Hoàn mỹ và hiệu ứng tăng thưởng ngày sau áp dụng giới hạn ghi riêng.',
        ]
      : []),
    'Chỉ tính công việc chính hoàn thành hợp lệ lần đầu; hoàn thành lại không được tính thêm lượt.',
  ];
}

/** Only server-projected labels are displayed; never expose internal counter keys. */
export function beastProgressV2(data, beast, levels) {
  // Collection rows carry training identity; the current role snapshot carries
  // authoritative skill progress for that exact attempt.
  const selected = data.selected?.find(
    (entry) => entry.id === beast.id && entry.attemptId === beast.attemptId,
  );
  const state = selected?.skillStateV2 ?? beast.skillStateV2 ?? { counters: {}, daily: null };
  const lines = [];
  const structured =
    !!data.v2?.skillProgress &&
    data.v2.skillProgress.beastId === beast.id &&
    data.v2.skillProgress.attemptId === beast.attemptId;
  const skills = beastSkillsV2(data, beast);
  for (const entry of structured ? [] : (skills?.progress ?? [])) {
    if (entry.tier === 'awakening' && !levels?.awakened) continue;
    if (entry.tier === 'perfect' && !levels?.perfect) continue;
    const value =
      entry.source === 'daily'
        ? state.daily?.day === data.v2?.day
          ? (state.daily?.[entry.key] ?? 0)
          : 0
        : (state.counters?.[entry.key] ?? 0);
    if (!entry.label || !Number.isFinite(value)) continue;
    const target = Number.isFinite(entry.target) ? ` / ${count.format(entry.target)}` : '';
    const remaining = Number.isFinite(entry.remainingFrom);
    lines.push(
      `${entry.label}: ${remaining ? 'còn ' : ''}${count.format(remaining ? Math.max(0, entry.remainingFrom - value) : value)}${target}${entry.unit ? ' ' + entry.unit : ''}${entry.source === 'daily' ? ' hôm nay' : ''}`,
    );
  }
  const day = data.v2;
  const hasTaskBuff = day?.taskBuff && (day.taskBuff.qi > 0 || day.taskBuff.tickets > 0);
  if (!structured && (skills?.activity?.tasks || hasTaskBuff) && Number.isFinite(day?.taskCount))
    lines.push(`Công việc hợp lệ hôm nay: ${count.format(day.taskCount)}`);
  if (
    !structured &&
    (skills?.activity?.sleep || (levels?.perfect && skills?.activity?.sleepOnPerfect)) &&
    Number.isFinite(day?.startSleepStreak)
  )
    lines.push(`Chuỗi ngủ đúng giờ đầu ngày: ${count.format(day.startSleepStreak)} ngày`);
  if (hasTaskBuff) {
    lines.push(
      `Thưởng công việc hôm nay: mỗi việc +${count.format(day.taskBuff.qi)} tu vi và +${count.format(day.taskBuff.tickets)} vé quay thường.`,
    );
  }
  if (!structured && state.daily?.day === day?.day && state.daily?.monkeyTriggered)
    lines.push('Kiên Tâm: đã tăng thưởng công việc cho ngày mai.');
  if (day?.multiplier === 3 && (!structured || !levels?.perfect || beast.speciesId !== 'pyropup')) {
    const burn = Number.isFinite(day.selfBurnFinal)
      ? `; tự trừ ${count.format(day.selfBurnFinal)} tu vi/ngày`
      : '';
    lines.push(`Hôm nay: thưởng ×3, phạt tu vi ×3${burn}.`);
  }
  if (Number.isSafeInteger(day?.pendingDay) && day.pendingDay < day.day)
    lines.push('Đang chờ chốt kết quả ngày; thưởng và tiến trình sẽ cập nhật tự động.');
  return lines;
}
