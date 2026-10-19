import { type Item } from './healthy.ts';
import { habitWeekStart } from './habits.ts';
import { trainingView, type BeastAttempt } from './linh-thu-training.ts';
import { randomUnit, talentChance } from './linh-thu.ts';

export const BEAST_SKILL_VERSION = 1;
export type SkillTrigger = 'task' | 'habit' | 'sleep' | 'combined' | 'draw' | 'breakthrough';
export type SkillReward = {
  qi?: number;
  tickets?: number;
  summonTickets?: number;
  items?: Partial<Record<Item, number>>;
};
type Talent = Readonly<{
  name: string;
  trigger: SkillTrigger;
  chance: number;
  reward?: SkillReward;
  refund?: number;
}>;
type Awakening = Readonly<{
  name: string;
  trigger: SkillTrigger;
  reward: SkillReward;
  every?: number;
  scope?: 'cumulative' | 'week';
  ordinal?: number;
  dryPity?: number;
}>;
export type UltimateKind =
  | 'summon_choice'
  | 'meteor_guard'
  | 'frost_guard'
  | 'task_bounty'
  | 'draw_three_two'
  | 'tower_rescue'
  | 'habit_bounty'
  | 'task_combo'
  | 'marked_tasks'
  | 'sleep_bounty'
  | 'breakthrough_pact'
  | 'knight_guard'
  | 'double_fusion'
  | 'owl_guard'
  | 'turtle_guard'
  | 'magnet_tasks'
  | 'draw_two_one'
  | 'dream_bounty';
export type BeastSkillSet = Readonly<{
  talents: readonly Talent[];
  awakening: Awakening;
  ultimate: Readonly<{
    name: string;
    kind: UltimateKind;
    expires: 'day' | 'week';
    parameters: Readonly<Record<string, number>>;
  }>;
}>;

function talent(name: string, trigger: SkillTrigger, reward: SkillReward, chance = 1): Talent {
  return { name, trigger, chance, reward };
}
function refund(name: string, amount: number): Talent {
  return { name, trigger: 'breakthrough', chance: 1, refund: amount };
}
function ultimate(
  name: string,
  kind: UltimateKind,
  parameters: Record<string, number>,
  expires: 'day' | 'week' = 'week',
) {
  return { name, kind, parameters, expires };
}

/** Published baseline. New versions affect new events, never replay paid rewards. */
export const BEAST_SKILLS: Readonly<Record<string, BeastSkillSet>> = {
  pyropup: {
    talents: [
      talent('Liệp Hỏa', 'task', { qi: 1 }),
      talent('Truy Tài', 'task', { tickets: 1 }, 0.8),
    ],
    awakening: {
      name: 'Tam Diệm Tụ Hồn',
      trigger: 'task',
      every: 20,
      scope: 'cumulative',
      reward: { summonTickets: 1 },
    },
    ultimate: ultimate('Tam Thủ Chiêu Hồn', 'summon_choice', { candidates: 3, picks: 1, uses: 1 }),
  },
  rubblet: {
    talents: [talent('Địa Mạch', 'habit', { qi: 4 }), talent('Tinh Tức', 'sleep', { qi: 3 })],
    awakening: {
      name: 'Nhật Nguyệt Đồng Tu',
      trigger: 'combined',
      every: 5,
      scope: 'cumulative',
      reward: { summonTickets: 1 },
    },
    ultimate: ultimate('Tinh Vẫn Kết Giới', 'meteor_guard', {
      sleepUses: 2,
      breakthroughUses: 1,
      unusedQi: 5,
    }),
  },
  frostnip: {
    talents: [
      talent('Nguyệt Tức', 'sleep', { qi: 3 }),
      talent('Tuyết Ấn', 'habit', { items: { peace: 1 } }, 0.1),
    ],
    awakening: { name: 'Băng Nguyệt Giao Hòa', trigger: 'combined', reward: { tickets: 1 } },
    ultimate: ultimate('Băng Nguyệt Phong Ấn', 'frost_guard', { uses: 3, onTimeQi: 5 }),
  },
  zappur: {
    talents: [
      talent('Lôi Tài', 'task', { tickets: 1 }, 0.5),
      talent('Lôi Tức', 'task', { qi: 1 }, 0.5),
    ],
    awakening: { name: 'Tam Lôi', trigger: 'task', ordinal: 3, reward: { tickets: 2 } },
    ultimate: ultimate('Lôi Vương Bảo Khố', 'task_bounty', { target: 5, summonTickets: 2, qi: 40 }),
  },
  skinklet: {
    talents: [talent('Huyễn Tức', 'draw', { qi: 1 }, 0.6), refund('Thế Thân', 3)],
    awakening: {
      name: 'Tam Ảnh Tụ Khí',
      trigger: 'draw',
      every: 3,
      scope: 'cumulative',
      reward: { qi: 3 },
    },
    ultimate: ultimate('Ảo Ảnh Tam Phân', 'draw_three_two', { candidates: 3, picks: 2, uses: 3 }),
  },
  punchimp: {
    talents: [
      talent('Hầu Vương Tụ Khí', 'habit', { qi: 3 }),
      talent('Kiên Tâm', 'habit', { tickets: 1 }),
    ],
    awakening: {
      name: 'Ngũ Nhật Chiêu Linh',
      trigger: 'habit',
      every: 5,
      scope: 'cumulative',
      reward: { summonTickets: 1 },
    },
    ultimate: ultimate('Phân Thân Thế Mệnh', 'tower_rescue', { savesPerRun: 1, lastFloor: 3 }),
  },
  shardsnail: {
    talents: [talent('Tinh Thạch Tích Lũy', 'habit', { tickets: 1 })],
    awakening: {
      name: 'Ngũ Sắc Kết Tinh',
      trigger: 'habit',
      every: 5,
      scope: 'cumulative',
      reward: { tickets: 3 },
    },
    ultimate: ultimate('Tinh Hốc Bí Tàng', 'habit_bounty', { target: 3, summonTickets: 1 }),
  },
  flameow: {
    talents: [talent('Dư Hỏa', 'task', { qi: 1 }, 0.5)],
    awakening: { name: 'Tam Trảo', trigger: 'task', ordinal: 3, reward: { qi: 3 } },
    ultimate: ultimate('Hỏa Liên Trảm', 'task_combo', { first: 3, second: 5, third: 10 }, 'day'),
  },
  manteeny: {
    talents: [talent('Lan Liêm Truy Tài', 'task', { tickets: 1 }, 0.4)],
    awakening: { name: 'Tam Hoa', trigger: 'task', ordinal: 3, reward: { tickets: 1 } },
    ultimate: ultimate('Song Liêm Khế', 'marked_tasks', {
      targets: 2,
      ticketsPerTask: 5,
      completionQi: 5,
    }),
  },
  fluffle: {
    talents: [talent('Vân Tức', 'sleep', { qi: 2 })],
    awakening: {
      name: 'Tam Vân Tụ Khí',
      trigger: 'sleep',
      every: 3,
      scope: 'cumulative',
      reward: { qi: 5 },
    },
    ultimate: ultimate('Thiên Cung Mộng Du', 'sleep_bounty', { target: 3, summonTickets: 1 }),
  },
  maskfry: {
    talents: [refund('Hải Giáp', 3)],
    awakening: { name: 'Triều Sinh', trigger: 'habit', reward: { qi: 2 } },
    ultimate: ultimate('Giao Ước Vực Sâu', 'breakthrough_pact', { uses: 1, summonTickets: 1 }),
  },
  goonbug: {
    talents: [talent('Giáp Dực', 'habit', { items: { peace: 1 } }, 0.07)],
    awakening: {
      name: 'Thất Nhật Hộ Ấn',
      trigger: 'habit',
      dryPity: 7,
      reward: { items: { peace: 1 } },
    },
    ultimate: ultimate('Hiệp Sĩ Hộ Vệ', 'knight_guard', {
      uses: 1,
      onTimeHeart: 1,
      onTimePeace: 1,
    }),
  },
  humbug: {
    talents: [talent('Phù Ấn', 'habit', { items: { basic: 1 } }, 0.1)],
    awakening: {
      name: 'Tam Nhật Kết Ấn',
      trigger: 'habit',
      every: 3,
      scope: 'cumulative',
      reward: { items: { basic: 1 } },
    },
    ultimate: ultimate('Luyện Phù Song Sinh', 'double_fusion', {
      uses: 1,
      successOutputs: 2,
      failureRefund: 1,
    }),
  },
  hootlet: {
    talents: [talent('Dạ Tức', 'sleep', { qi: 1 })],
    awakening: {
      name: 'Tam Dạ Hộ Tâm',
      trigger: 'sleep',
      every: 3,
      scope: 'week',
      reward: { items: { heart: 1 } },
    },
    ultimate: ultimate('Đêm Đứng Yên', 'owl_guard', { uses: 1, onTimeTickets: 5, onTimeQi: 12 }),
  },
  gibber: {
    talents: [refund('Thạch Giáp', 1)],
    awakening: { name: 'Quy Tức', trigger: 'habit', reward: { qi: 1 } },
    ultimate: ultimate('Mai Đá Hộ Thể', 'turtle_guard', { uses: 1, maxRefund: 10, successQi: 5 }),
  },
  voltfawn: {
    talents: [talent('Tụ Từ', 'task', { qi: 1 }, 0.25)],
    awakening: { name: 'Tam Cực', trigger: 'task', ordinal: 3, reward: { qi: 1 } },
    ultimate: ultimate('Cực Từ Đảo Chiều', 'magnet_tasks', {
      maxTargets: 3,
      ticketsPerTask: 1,
      qiPerTask: 3,
    }),
  },
  cheerling: {
    talents: [talent('Tinh Tài', 'task', { tickets: 1 }, 0.2)],
    awakening: { name: 'Tam Tinh', trigger: 'task', ordinal: 3, reward: { tickets: 1 } },
    ultimate: ultimate('Tinh Tú Dẫn Lối', 'draw_two_one', { candidates: 2, picks: 1, uses: 1 }),
  },
  funglet: {
    talents: [talent('Mộng Tức', 'habit', { qi: 1 })],
    awakening: { name: 'An Mộng', trigger: 'combined', reward: { qi: 1 } },
    ultimate: ultimate('Mộng Cảnh', 'dream_bounty', { target: 3, tickets: 6, qi: 15 }),
  },
};

export type BeastSkillEvent = {
  trigger: SkillTrigger;
  day: number;
  ordinal?: number;
  /** Habit/combined: full day. Sleep: on time. Draw: a chosen reward contains qi. */
  qualified: boolean;
  actualQiLoss?: number;
};
export type BeastSkillCounters = Record<string, number>;
export type BeastSkillOutcome = {
  counters: BeastSkillCounters;
  reward: SkillReward;
  refundQi: number;
  triggered: string[];
};

export function addSkillReward(target: SkillReward, value: SkillReward): void {
  for (const key of ['qi', 'tickets', 'summonTickets'] as const)
    if (value[key]) target[key] = (target[key] ?? 0) + value[key]!;
  for (const [key, amount] of Object.entries(value.items ?? {})) {
    target.items ??= {};
    const item = key as Item;
    target.items[item] = (target.items[item] ?? 0) + amount;
  }
}

/** The adapter journals each original source event once before applying this outcome. */
export function applyBeastPassives(
  attempt: BeastAttempt,
  savedCounters: BeastSkillCounters,
  event: BeastSkillEvent,
  random: () => number,
): BeastSkillOutcome {
  const skills = BEAST_SKILLS[attempt.speciesId];
  if (
    !skills ||
    !Number.isSafeInteger(event.day) ||
    !['task', 'habit', 'sleep', 'combined', 'draw', 'breakthrough'].includes(event.trigger)
  )
    throw Error('INVALID_BEAST_SKILL_EVENT');
  const outcome: BeastSkillOutcome = {
    counters: { ...savedCounters },
    reward: {},
    refundQi: 0,
    triggered: [],
  };
  if (!event.qualified) return outcome;
  if (event.trigger === 'task' || event.trigger === 'draw') {
    if (!Number.isInteger(event.ordinal) || Number(event.ordinal) < 1)
      throw Error('INVALID_BEAST_SKILL_ORDINAL');
    if (Number(event.ordinal) > (event.trigger === 'task' ? 5 : 10)) return outcome;
  }
  if (
    event.trigger === 'breakthrough' &&
    (!Number.isSafeInteger(event.actualQiLoss) || Number(event.actualQiLoss) < 0)
  )
    throw Error('INVALID_BEAST_SKILL_LOSS');
  const view = trainingView(attempt);
  let firstTalentHit = false;
  skills.talents.forEach((skill, index) => {
    if (skill.trigger !== event.trigger) return;
    const chance = talentChance(skill.chance, view.form, index === 0 ? 1 : 2);
    const hit = chance === 1 || (chance > 0 && randomUnit(random) < chance);
    if (!hit) return;
    if (index === 0) firstTalentHit = true;
    outcome.triggered.push(skill.name);
    if (skill.reward) addSkillReward(outcome.reward, skill.reward);
    if (skill.refund) outcome.refundQi = Math.min(event.actualQiLoss ?? 0, skill.refund);
  });
  const awakening = skills.awakening;
  if (!view.awakened || awakening.trigger !== event.trigger) return outcome;
  const key = 'awakening';
  if (awakening.dryPity) {
    const count = firstTalentHit ? 0 : (outcome.counters[key] ?? 0) + 1;
    if (count >= awakening.dryPity) {
      addSkillReward(outcome.reward, awakening.reward);
      outcome.triggered.push(awakening.name);
      outcome.counters[key] = 0;
    } else outcome.counters[key] = count;
    return outcome;
  }
  if (awakening.ordinal !== undefined && event.ordinal !== awakening.ordinal) return outcome;
  if (awakening.every) {
    const week = habitWeekStart(event.day);
    // A delayed Sunday assessment may arrive after the next week's sleep reports.
    // Keep each calendar week's budget independent rather than resetting a shared counter.
    const weekly = awakening.scope === 'week';
    const counterKey = weekly ? `${key}:${week}` : key;
    const paidKey = `weekPaid:${week}`;
    if (weekly && outcome.counters[paidKey]) return outcome;
    const count = (outcome.counters[counterKey] ?? 0) + 1;
    outcome.counters[counterKey] = count;
    if (weekly && week >= (outcome.counters.week ?? -Infinity)) {
      outcome.counters.week = week;
      outcome.counters[key] = count;
      outcome.counters.weekPaid = 0;
    }
    if (count < awakening.every) return outcome;
    outcome.counters[counterKey] = count - awakening.every;
    if (weekly) {
      outcome.counters[paidKey] = 1;
      if (outcome.counters.week === week) {
        outcome.counters[key] = count - awakening.every;
        outcome.counters.weekPaid = 1;
      }
    }
  }
  addSkillReward(outcome.reward, awakening.reward);
  outcome.triggered.push(awakening.name);
  return outcome;
}
