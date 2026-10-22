import type { Item } from './healthy.ts';

/** V1 remains immutable for receipts and choices created before the cutover. */
export const BEAST_SKILL_VERSION_V2 = 2;
export const BEAST_V2_SELF_BURN_BASE = 12;
export const BEAST_V2_SELF_BURN_FINAL = 36;
export type BeastV2Form = 1 | 2 | 3 | 4;
export type BeastV2Reward = {
  qi: number;
  tickets: number;
  summonTickets: number;
  items: Partial<Record<Item, number>>;
};
type RewardInput = Partial<BeastV2Reward>;
export type BeastV2Talent = {
  name: string;
  trigger: 'task' | 'habit' | 'sleep' | 'perfect' | 'breakthrough' | 'two_tasks';
  /** Exact probabilities; never interpolate the fourth-stage chance. */
  chances: readonly [number, number, number, number];
  reward: RewardInput;
  refundQi?: number;
  taskLimit?: number;
  description: string;
};
export type BeastV2Milestone = {
  name: string;
  description: string;
  details?: readonly string[];
  target?: number;
  scope: 'cumulative' | 'consecutive' | 'daily' | 'event';
};
export type BeastV2Config = {
  summary: string;
  talents: readonly BeastV2Talent[];
  awakening: BeastV2Milestone;
  perfect: BeastV2Milestone;
};
const standard = [0.25, 0.5, 0.75, 1] as const;
function talent(
  name: string,
  trigger: BeastV2Talent['trigger'],
  reward: RewardInput,
  description: string,
  chances: BeastV2Talent['chances'] = standard,
): BeastV2Talent {
  return {
    name,
    trigger,
    reward,
    description,
    chances,
    ...(trigger === 'task' ? { taskLimit: 5 } : {}),
  };
}
function milestone(
  name: string,
  description: string,
  scope: BeastV2Milestone['scope'],
  target?: number,
): BeastV2Milestone {
  return { name, description, scope, ...(target === undefined ? {} : { target }) };
}

/** Also exposed by the read API so web descriptions cannot drift from server rates. */
export const BEAST_V2_CONFIG = {
  humbug: {
    summary: 'Kiếm Phá Cảnh Phù từ thói quen và hỗ trợ ghép phù.',
    talents: [
      talent(
        'Phù Ấn',
        'habit',
        { items: { basic: 1 } },
        'Ngày đủ thói quen: nhận 1 Phá Cảnh Phù sơ cấp.',
      ),
    ],
    awakening: milestone(
      'Tam Nhật Kết Ấn',
      'Tích lũy 3 ngày đủ thói quen: nhận 1 Phá Cảnh Phù trung cấp.',
      'cumulative',
      3,
    ),
    perfect: milestone(
      'Luyện Phù Song Sinh',
      'Hỗ trợ 3 lần ghép Phá Cảnh Phù sơ cấp → trung cấp mỗi ngày. Thành công nhận tổng 2 Phá Cảnh Phù trung cấp; thất bại hoàn 1 Phá Cảnh Phù sơ cấp.',
      'daily',
      3,
    ),
  },
  hootlet: {
    summary: 'Chuỗi ngủ ngắn kiếm vé, chuỗi dài có cơ hội nhận Hộ Tâm Phù.',
    talents: [talent('Dạ Tức', 'sleep', { qi: 1 }, 'Ngủ đúng giờ: thêm 1 tu vi.')],
    awakening: milestone(
      'Tam Dạ Hộ Tâm',
      'Ngủ đúng giờ 3 đêm liên tiếp: nhận 3 vé quay thường.',
      'consecutive',
      3,
    ),
    perfect: milestone(
      'Đêm Đứng Yên',
      'Ngủ đúng giờ 14 đêm liên tiếp: 40% nhận 1 Hộ Tâm Phù. Xét xong bắt đầu chu kỳ mới.',
      'consecutive',
      14,
    ),
  },
  gibber: {
    summary: 'Hoàn tu vi khi đột phá thất bại; bảo hộ lần thử sau ba thất bại liên tiếp.',
    talents: [
      {
        ...talent(
          'Thạch Giáp',
          'breakthrough',
          {},
          'Đột phá thất bại: hoàn tối đa 5 tu vi thực mất.',
        ),
        refundQi: 5,
      },
    ],
    awakening: milestone('Quy Tức', 'Mỗi ngày đủ thói quen: thêm 1 tu vi.', 'daily'),
    perfect: milestone(
      'Mai Đá Hộ Thể',
      'Sau 3 lần đột phá thất bại liên tiếp, lần đột phá tiếp theo được cộng 5 điểm phần trăm vào tỷ lệ thành công và không mất tu vi nếu thất bại. Dùng xong đếm lại.',
      'event',
      3,
    ),
  },
  voltfawn: {
    summary: 'Kiếm tu vi từ công việc, thưởng thêm khi hoàn thành việc sáng sớm.',
    talents: [
      talent(
        'Tụ Từ',
        'task',
        { qi: 1 },
        'Hoàn thành công việc: nhận thêm 1 tu vi.',
        [0.1, 0.2, 0.3, 0.35],
      ),
    ],
    awakening: milestone('Tam Cực', 'Công việc thứ 3 trong ngày: thêm 3 tu vi.', 'daily', 3),
    perfect: milestone(
      'Cực Từ Đảo Chiều',
      'Hoàn thành công việc từ 05:00 đến trước 08:00: nhận thêm 5 tu vi. Mỗi ngày 1 lần.',
      'daily',
    ),
  },
  cheerling: {
    summary: 'Kiếm vé từ công việc; đủ tám việc trong ngày nhận vé triệu hồi linh thú.',
    talents: [
      talent(
        'Tinh Tài',
        'task',
        { tickets: 1 },
        'Hoàn thành công việc: nhận thêm 1 vé quay thường.',
        [0.1, 0.2, 0.3, 0.35],
      ),
    ],
    awakening: milestone(
      'Tam Tinh',
      'Công việc thứ 3 trong ngày: thêm 3 vé quay thường.',
      'daily',
      3,
    ),
    perfect: milestone(
      'Tinh Tú Dẫn Lối',
      'Hoàn thành 8 công việc trong ngày: nhận 1 vé triệu hồi linh thú. Mỗi ngày 1 lần.',
      'daily',
      8,
    ),
  },
  funglet: {
    summary: 'Thưởng tu vi từ thói quen và chuỗi kết hợp ngủ đúng giờ.',
    talents: [talent('Mộng Tức', 'habit', { qi: 2 }, 'Ngày đủ thói quen: thêm 2 tu vi.')],
    awakening: milestone('An Mộng', 'Ngày đủ thói quen và ngủ đúng giờ: thêm 2 tu vi.', 'daily'),
    perfect: milestone(
      'Mộng Cảnh',
      'Đủ thói quen và ngủ đúng giờ 3 ngày liên tiếp: nhận 3 vé quay thường và 3 tu vi.',
      'consecutive',
      3,
    ),
  },
  shardsnail: {
    summary: 'Tích lũy vé từ thói quen; thưởng lớn cho chuỗi ngày hoàn hảo.',
    talents: [
      talent(
        'Tinh Thạch Tích Lũy',
        'habit',
        { tickets: 2 },
        'Ngày đủ thói quen: thêm 2 vé quay thường.',
      ),
    ],
    awakening: milestone(
      'Ngũ Sắc Kết Tinh',
      'Tích lũy 5 ngày đủ thói quen: nhận 5 vé quay thường và 10 tu vi.',
      'cumulative',
      5,
    ),
    perfect: milestone(
      'Tinh Hốc Bí Tàng',
      'Đạt 5 ngày hoàn hảo liên tiếp: nhận 20 vé quay thường và 20 tu vi.',
      'consecutive',
      5,
    ),
  },
  flameow: {
    summary: 'Kiếm tu vi từ công việc; càng làm nhiều việc trong ngày, càng nhận thêm tu vi.',
    talents: [
      talent(
        'Dư Hỏa',
        'task',
        { qi: 1 },
        'Hoàn thành công việc: nhận thêm 1 tu vi.',
        [0.15, 0.3, 0.45, 0.6],
      ),
    ],
    awakening: milestone('Tam Trảo', 'Công việc thứ 3 trong ngày: thêm 3 tu vi.', 'daily', 3),
    perfect: milestone(
      'Hỏa Liên Trảm',
      'Trong ngày, công việc thứ 1 nhận thêm 1 tu vi, thứ 2 thêm 2 tu vi, từ thứ 3 trở đi mỗi việc thêm 3 tu vi. Không giới hạn số việc; sang ngày mới đếm lại.',
      'daily',
    ),
  },
  manteeny: {
    summary: 'Công việc kiếm vé, thưởng thêm khi làm trước trưa và duy trì ngày hoàn hảo.',
    talents: [
      talent(
        'Lan Liêm Truy Tài',
        'task',
        { tickets: 1 },
        'Hoàn thành công việc: nhận thêm 1 vé quay thường.',
        [0.1, 0.25, 0.35, 0.5],
      ),
    ],
    awakening: milestone(
      'Tam Hoa',
      'Hoàn thành 3 công việc trước 12:00 trong cùng ngày: nhận 10 vé quay thường. Mỗi ngày 1 lần.',
      'daily',
      3,
    ),
    perfect: milestone(
      'Song Liêm Khế',
      'Đạt 2 ngày hoàn hảo liên tiếp: nhận 3 vé quay thường và 5 tu vi.',
      'consecutive',
      2,
    ),
  },
  fluffle: {
    summary: 'Ngủ đúng giờ kiếm tu vi; chuỗi dài tăng thưởng Hoàn mỹ.',
    talents: [talent('Vân Tức', 'sleep', { qi: 2 }, 'Ngủ đúng giờ: thêm 2 tu vi.')],
    awakening: milestone(
      'Tam Vân Tụ Khí',
      'Tích lũy 3 lần ngủ đúng giờ: thêm 5 tu vi.',
      'cumulative',
      3,
    ),
    perfect: milestone(
      'Thiên Cung Mộng Du',
      'Cứ ngủ đúng giờ thêm 3 đêm liên tiếp: nhận tu vi bằng số ngày trong chuỗi ngủ đúng giờ hiện tại. Không giới hạn lượng thưởng.',
      'consecutive',
      3,
    ),
  },
  maskfry: {
    summary: 'Hoàn tu vi khi đột phá thất bại; chuỗi ngủ kiếm vé triệu hồi.',
    talents: [
      {
        ...talent(
          'Hải Giáp',
          'breakthrough',
          {},
          'Đột phá thất bại: hoàn tối đa 10 tu vi thực mất.',
        ),
        refundQi: 10,
      },
    ],
    awakening: milestone('Triều Sinh', 'Mỗi ngày đủ thói quen: thêm 2 tu vi.', 'daily'),
    perfect: milestone(
      'Giao Ước Vực Sâu',
      'Ngủ đúng giờ 5 đêm liên tiếp: nhận 1 vé triệu hồi linh thú.',
      'consecutive',
      5,
    ),
  },
  goonbug: {
    summary: 'Thói quen tạo An Tâm Phù có bảo hiểm; chuỗi ngủ tạo phù bảo hộ.',
    talents: [
      talent(
        'Giáp Dực',
        'habit',
        { items: { peace: 1 } },
        'Ngày đủ thói quen: nhận 1 An Tâm Phù.',
        [0.03, 0.05, 0.07, 0.09],
      ),
    ],
    awakening: milestone(
      'Thất Nhật Hộ Ấn',
      'Đủ thói quen 7 ngày liên tiếp mà Giáp Dực chưa cho An Tâm Phù: nhận 1 An Tâm Phù. Nếu Giáp Dực cho phù hoặc bỏ lỡ một ngày, bộ đếm bảo hiểm về 0.',
      'consecutive',
      7,
    ),
    perfect: milestone(
      'Hiệp Sĩ Hộ Vệ',
      'Ngủ đúng giờ 10 đêm liên tiếp: nhận 1 phù, với 30% là Hộ Tâm Phù và 70% là An Tâm Phù.',
      'consecutive',
      10,
    ),
  },
  frostnip: {
    summary: 'Ngủ đúng giờ thưởng nhiều tu vi; chuỗi ngủ tạo vé quay tăng dần.',
    talents: [
      talent('Nguyệt Tức', 'sleep', { qi: 10 }, 'Ngủ đúng giờ: thêm 10 tu vi.'),
      talent(
        'Tuyết Ấn',
        'habit',
        { items: { peace: 1 } },
        'Ngày đủ thói quen: nhận 1 An Tâm Phù.',
        [0, 0, 0.05, 0.1],
      ),
    ],
    awakening: milestone(
      'Băng Nguyệt Giao Hòa',
      'Ngày đủ thói quen và ngủ đúng giờ: thêm 2 vé quay thường.',
      'daily',
    ),
    perfect: milestone(
      'Băng Nguyệt Phong Ấn',
      'Cứ ngủ đúng giờ thêm 3 đêm liên tiếp: nhận vé quay thường bằng số ngày trong chuỗi ngủ đúng giờ hiện tại. Không giới hạn lượng thưởng.',
      'consecutive',
      3,
    ),
  },
  zappur: {
    summary: 'Công việc thưởng đồng thời vé và tu vi; ngày hoàn hảo có thêm thưởng.',
    talents: [
      talent(
        'Lôi Tài',
        'task',
        { tickets: 1 },
        'Hoàn thành công việc: nhận thêm 1 vé quay thường.',
      ),
      talent(
        'Lôi Tức',
        'task',
        { qi: 1 },
        'Hoàn thành công việc: nhận thêm 1 tu vi. Có thể nhận cùng thưởng Lôi Tài.',
        [0, 0, 0.5, 1],
      ),
    ],
    awakening: milestone(
      'Tam Lôi',
      'Từ công việc thứ 3 trong ngày trở đi: mỗi việc nhận thêm 3 vé quay thường. Không giới hạn số việc.',
      'daily',
      3,
    ),
    perfect: milestone(
      'Lôi Vương Bảo Khố',
      'Mỗi ngày hoàn hảo, nhận thêm tu vi và vé quay thường với số lượng bằng nhau: lấy số ngày trong chuỗi ngủ đúng giờ chia 2, làm tròn lên. Tối đa 5 tu vi và 5 vé quay thường.',
      'daily',
    ),
  },
  skinklet: {
    summary: 'Ngày hoàn hảo kiếm vé triệu hồi; quay x10 tăng dần cơ hội thưởng thêm.',
    talents: [
      talent(
        'Huyễn Tức',
        'perfect',
        { summonTickets: 1 },
        'Ngày hoàn hảo: nhận 1 vé triệu hồi linh thú.',
        [0.1, 0.15, 0.25, 0.35],
      ),
    ],
    awakening: milestone(
      'Tam Ảnh Tụ Khí',
      'Mỗi lần quay thường x10: 3% nhận đồng thời 1 vé triệu hồi linh thú và 30 vé quay thường. Mỗi lần hụt, tỷ lệ nhận gói thưởng này tăng thêm 3 điểm phần trăm, tối đa 100%. Nhận được gói thưởng thì tỷ lệ về 3%.',
      'event',
    ),
    perfect: milestone(
      'Ảo Ảnh Tam Phân',
      'Đạt 3 ngày hoàn hảo liên tiếp: nhận 30 vé quay thường và 1 vé triệu hồi linh thú. Chỉ đếm những ngày có chuỗi ngủ đúng giờ từ 7 ngày trở lên.',
      'consecutive',
      3,
    ),
  },
  punchimp: {
    summary: 'Thói quen thưởng tu vi; công việc tăng thưởng ngày sau; cứu bẫy ở mọi tầng tháp.',
    talents: [
      talent('Hầu Vương Tụ Khí', 'habit', { qi: 5 }, 'Ngày đủ thói quen: nhận thêm 5 tu vi.'),
      talent(
        'Kiên Tâm',
        'two_tasks',
        { tickets: 3 },
        'Hoàn thành 2 công việc trong ngày: nhận 3 vé quay thường.',
        [0, 0, 0.5, 1],
      ),
    ],
    awakening: milestone(
      'Ngũ Nhật Chiêu Linh',
      'Tích lũy 5 ngày đủ thói quen: nhận 1 vé triệu hồi linh thú.',
      'cumulative',
      5,
    ),
    perfect: milestone(
      'Phân Thân Thế Mệnh',
      'Mỗi lượt tháp được cứu bẫy 1 lần ở bất kỳ tầng nào, kể cả tầng 4. Các ô được xáo lại để chọn lại; vẫn có thể gặp bẫy.',
      'event',
      1,
    ),
  },
  pyropup: {
    summary:
      'Công việc thưởng tu vi và vé; chuỗi ngủ dài mở thưởng ×3, phạt ×3 và tự trừ 36 tu vi/ngày.',
    talents: [
      talent('Liệp Hỏa', 'task', { qi: 3 }, 'Hoàn thành công việc: nhận thêm 3 tu vi.'),
      talent(
        'Truy Tài',
        'task',
        { tickets: 2 },
        'Hoàn thành công việc: nhận thêm 2 vé quay thường.',
        [0, 0, 0.4, 0.8],
      ),
    ],
    awakening: milestone(
      'Tam Diệm Tụ Hồn',
      'Tích lũy 10 công việc: nhận 10 vé quay thường và có 30% nhận thêm 1 vé triệu hồi linh thú.',
      'cumulative',
      10,
    ),
    perfect: {
      ...milestone(
        'Tam Thủ Chiêu Hồn',
        'Khi bắt đầu ngày với chuỗi ngủ đúng giờ từ 30 ngày: nhận gấp 3 phần thưởng và mất gấp 3 tu vi khi bị phạt. Mỗi ngày có hiệu ứng tự trừ 36 tu vi, đã nhân 3 từ mức gốc 12 tu vi.',
        'daily',
      ),
      details: [
        'Thưởng ×3 gồm tu vi, vé quay thường, vé triệu hồi linh thú và vật phẩm kiếm được từ công việc, thói quen, ngủ, điểm danh, quay thường, tháp và kỹ năng linh thú.',
        'Phạt ×3 áp dụng khi ngủ sai giờ hoặc đột phá thất bại. Ngày đang có hiệu ứng mà ngủ muộn vẫn chịu phạt ×3.',
        'Ví dụ: thưởng 5 tu vi thành 15 tu vi; phạt 20 tu vi thành 60 tu vi.',
        'Không nhân chi phí, khoản hoàn trả, tài nguyên từ đổi vé hoặc hiến tế, sản phẩm ghép phù hoặc luyện đan, và số linh thú triệu hồi.',
      ],
    },
  },
  rubblet: {
    summary: 'Sinh hoạt đều đặn tạo tu vi; ngày hoàn hảo và chuỗi ngủ dài tạo nhiều vé.',
    talents: [
      talent('Địa Mạch', 'habit', { qi: 5 }, 'Ngày đủ thói quen: thêm 5 tu vi.'),
      talent('Tinh Tức', 'sleep', { qi: 10 }, 'Ngủ đúng giờ: thêm 10 tu vi.', [0, 0, 0.5, 1]),
    ],
    awakening: milestone(
      'Nhật Nguyệt Đồng Tu',
      'Đạt 7 ngày hoàn hảo liên tiếp: nhận 100 vé quay thường.',
      'consecutive',
      7,
    ),
    perfect: milestone(
      'Tinh Vẫn Kết Giới',
      'Mỗi ngày hoàn hảo: nhận vé quay thường bằng số ngày trong chuỗi ngủ đúng giờ hiện tại. Không giới hạn lượng thưởng.',
      'daily',
    ),
  },
} as const satisfies Record<string, BeastV2Config>;
export type BeastV2Species = keyof typeof BEAST_V2_CONFIG;
export type BeastV2Context = {
  speciesId: string;
  form: BeastV2Form;
  awakened: boolean;
  perfect: boolean;
};
export type BeastV2State = {
  counters: Record<string, number>;
  lastDay: number | null;
  daily: {
    day: number;
    taskOrdinal: number;
    earlyRewarded: boolean;
    beforeNoonTasks: number;
    fusionUses: number;
    monkeyTriggered: boolean;
  };
};
export type BeastV2Event =
  | { kind: 'task'; day: number; ordinal: number; localMinute: number }
  | {
      kind: 'day';
      day: number;
      habitSatisfied: boolean;
      habitRewardEligible: boolean;
      sleepOnTime: boolean;
      sleepStreak: number;
      taskCount: number;
      /** False terminates consecutive progress when the beast was not accompanying. */
      active?: boolean;
      /** Only suppress already-paid component passives. Day counters still settle once. */
      settleHabit?: boolean;
      settleSleep?: boolean;
    }
  | { kind: 'draw'; day: number; count: number }
  | { kind: 'fusion'; day: number; success: boolean; from: 'basic' | 'middle' | 'high' | 'supreme' }
  | { kind: 'breakthrough'; day: number; success: boolean; lostQi: number };
export type BeastV2Result = {
  state: BeastV2State;
  reward: BeastV2Reward;
  refundQi: number;
  fusion: { extraMiddle: number; refundBasic: number } | null;
  nextDayTaskBuff: boolean;
  activated: string[];
};
export type BeastV2Outcome = BeastV2Result;

export function initialBeastV2State(): BeastV2State {
  return { counters: {}, lastDay: null, daily: emptyDaily(-1) };
}
function emptyDaily(day: number): BeastV2State['daily'] {
  return {
    day,
    taskOrdinal: 0,
    earlyRewarded: false,
    beforeNoonTasks: 0,
    fusionUses: 0,
    monkeyTriggered: false,
  };
}
export function emptyBeastV2Reward(): BeastV2Reward {
  return { qi: 0, tickets: 0, summonTickets: 0, items: {} };
}
export function beastV2Config(speciesId: string): BeastV2Config | null {
  return Object.hasOwn(BEAST_V2_CONFIG, speciesId)
    ? BEAST_V2_CONFIG[speciesId as BeastV2Species]
    : null;
}
/** The persistence layer derives these flags from unrounded training data. */
export function beastV2SkillLevels(form: BeastV2Form, fullyTrained: boolean, purity: number) {
  return {
    awakened: form === 4 && fullyTrained && purity >= 0.95,
    perfect: form === 4 && fullyTrained && purity >= 1,
  };
}
export function beastV2Projection(context: BeastV2Context) {
  const config = beastV2Config(context.speciesId);
  if (!config) return null;
  return {
    version: BEAST_SKILL_VERSION_V2,
    summary: config.summary,
    talents: config.talents.map((entry) => ({
      ...entry,
      chance: entry.chances[context.form - 1],
      unlocked: entry.chances[context.form - 1]! > 0,
    })),
    awakening: {
      ...config.awakening,
      unlocked: context.form === 4 && (context.awakened || context.perfect),
    },
    perfect: { ...config.perfect, unlocked: context.form === 4 && context.perfect },
    ...(context.speciesId === 'skinklet'
      ? { chanceBoost: [0, 0, 0.1, 0.2][context.form - 1], chanceBoostSleepThreshold: 14 }
      : {}),
  };
}
/** Full roadmap for every beast; no duplicated gameplay numbers in browser code. */
export function beastV2SpeciesProjection(speciesId: string, includeProgress = true) {
  const config = beastV2Config(speciesId);
  if (!config) return null;
  const percent = (chance: number) => `${Number((chance * 100).toFixed(2))}%`;
  const stages = ([1, 2, 3, 4] as const).map((form) => {
    const skills = config.talents.flatMap((entry, index) => {
      const chance = entry.chances[form - 1]!;
      let description = entry.description
        .replace(': thêm ', ': nhận thêm ')
        .replace(': ', chance < 1 ? `: ${percent(chance)} ` : ': ');
      if (speciesId === 'punchimp' && index === 0 && form === 4)
        description = 'Ngày đủ thói quen: nhận thêm 5 tu vi và 1 vé quay thường.';
      if (speciesId === 'punchimp' && index === 1)
        description +=
          chance < 1
            ? ' Dù có nhận được 3 vé hay không, ngày hôm sau mỗi công việc vẫn được thêm 1 tu vi và 1 vé quay thường. Mỗi ngày kích hoạt 1 lần.'
            : ' Ngày hôm sau, mỗi công việc được thêm 1 tu vi và 1 vé quay thường. Mỗi ngày kích hoạt 1 lần.';
      return chance > 0
        ? [
            {
              id: `talent_${index + 1}`,
              name: entry.name,
              description,
            },
          ]
        : [];
    });
    if (speciesId === 'skinklet' && form >= 3)
      skills.push({
        id: 'talent_2',
        name: 'Thế Thân',
        description: `Khi chuỗi ngủ đúng giờ từ 14 ngày, tỷ lệ nhận 1 vé triệu hồi linh thú của Huyễn Tức tăng từ ${percent(config.talents[0]!.chances[form - 1]!)} lên ${form === 3 ? 35 : 55}%.`,
      });
    return { form, skills };
  });
  const progress = [
    ...(config.awakening.target && ['cumulative', 'consecutive'].includes(config.awakening.scope)
      ? [
          {
            key: awakeningCounter(speciesId),
            label: config.awakening.name,
            target: config.awakening.target,
            unit: speciesId === 'pyropup' ? 'công việc' : 'ngày',
            tier: 'awakening',
            minPurity: 95,
            source: 'counters',
          },
        ]
      : []),
    ...(config.perfect.target && config.perfect.scope === 'consecutive'
      ? [
          {
            key: perfectCounter(speciesId),
            label: config.perfect.name,
            target: config.perfect.target,
            unit: 'ngày',
            tier: 'perfect',
            minPurity: 100,
            source: 'counters',
          },
        ]
      : []),
    ...(speciesId === 'skinklet'
      ? [
          {
            key: 'drawMisses',
            label: 'Số gói x10 chưa trúng',
            unit: 'gói',
            tier: 'awakening',
            minPurity: 95,
            source: 'counters',
          },
        ]
      : []),
    ...(speciesId === 'gibber'
      ? [
          {
            key: 'breakthroughFailures',
            label: 'Đột phá thất bại liên tiếp',
            target: 3,
            unit: 'lần',
            tier: 'perfect',
            minPurity: 100,
            source: 'counters',
          },
        ]
      : []),
    ...(speciesId === 'humbug'
      ? [
          {
            key: 'fusionUses',
            label: 'Lượt ghép tăng lợi ích đã dùng hôm nay',
            target: 3,
            unit: 'lượt',
            tier: 'perfect',
            minPurity: 100,
            source: 'daily',
            remainingFrom: 3,
          },
        ]
      : []),
  ];
  return {
    summary: config.summary,
    // Compact presentation metadata: upgrade comparisons use exact configured
    // chances without duplicating full descriptions or guessing rates in web.
    talentChances: config.talents.map((entry) => entry.chances),
    activity: {
      tasks: config.talents.some(
        (entry) => entry.trigger === 'task' || entry.trigger === 'two_tasks',
      ),
      sleep: config.talents.some((entry) => entry.trigger === 'sleep') || speciesId === 'skinklet',
      sleepOnPerfect: ['maskfry', 'goonbug', 'zappur', 'pyropup', 'rubblet'].includes(speciesId),
    },
    stages,
    awakening: { id: 'awakening', ...config.awakening },
    perfect: { id: 'perfect', ...config.perfect },
    ...(includeProgress ? { progress } : {}),
  };
}

export type BeastV2SkillProgress = {
  kind: 'cycle' | 'quota' | 'probability' | 'status';
  label: string;
  value?: number;
  max?: number;
  hint?: string;
  status: 'working' | 'ready' | 'done' | 'waiting';
};
export type BeastV2ProgressFacts = {
  day: number;
  taskCount: number;
  daily: BeastV2State['daily'];
  startSleepStreak: number;
  multiplier: number;
  claimedToday: readonly string[];
  recentRewards: readonly string[];
  tower: { active: boolean; available: boolean; used: boolean } | null;
};

/** Read-only presentation, using the same context/counters as reward evaluation. */
export function beastV2SkillProgress(
  context: BeastV2Context,
  state: BeastV2State,
  facts: BeastV2ProgressFacts,
): Record<string, BeastV2SkillProgress> {
  const config = beastV2Config(context.speciesId);
  if (!config) return {};
  const result: Record<string, BeastV2SkillProgress> = {};
  const s = context.speciesId;
  const daily = facts.daily.day === facts.day ? facts.daily : emptyDaily(facts.day);
  const tasks = Math.max(0, facts.taskCount);
  const put = (id: string, value: BeastV2SkillProgress) => {
    result[id] = value;
  };
  const cycle = (id: string, key: string, target: number, unit: string, consecutive = false) => {
    const value = Math.min(target, Math.max(0, state.counters[key] ?? 0));
    const skill = id === 'awakening' ? config.awakening : config.perfect;
    put(id, {
      kind: 'cycle',
      value,
      max: target,
      status: value >= target ? 'ready' : 'working',
      label: `${value}/${target} ${unit}${consecutive ? ' liên tiếp' : ' tích lũy'}`,
      hint:
        value === 0 && facts.recentRewards.includes(skill.name)
          ? 'Đã nhận thưởng · Đang đếm chu kỳ mới'
          : `Còn ${target - value} ${unit}${unit === 'công việc' ? '' : ' · Theo ngày đã chốt'}`,
    });
  };
  const quota = (id: string, used: number, max: number, label: string) => {
    const remaining = Math.max(0, max - used);
    put(id, {
      kind: 'quota',
      value: remaining,
      max,
      label,
      status: remaining ? 'working' : 'done',
      hint: 'Hồi lại vào ngày sinh hoạt mới',
    });
  };
  const taskGoal = (id: string, target: number, name: string, count = tasks, exact = true) => {
    const paid = facts.claimedToday.includes(name);
    const value = paid ? target : Math.min(count, target);
    put(id, {
      kind: 'cycle',
      value,
      max: target,
      label: paid ? 'Đã nhận thưởng hôm nay' : `${value}/${target} công việc`,
      status: paid ? 'done' : count >= target ? (exact ? 'waiting' : 'ready') : 'working',
      hint: paid
        ? 'Hồi lại vào ngày sinh hoạt mới'
        : count >= target
          ? exact
            ? 'Mốc đã qua · Xét lại vào ngày mai'
            : 'Công việc tiếp theo sẽ kích hoạt'
          : `Còn ${target - value} công việc${s === 'manteeny' ? ' trước 12:00' : ''}`,
    });
  };
  config.talents.forEach((entry, index) => {
    if (!entry.chances[context.form - 1]) return;
    if (entry.taskLimit) {
      const remaining = Math.max(0, entry.taskLimit - tasks);
      quota(
        `talent_${index + 1}`,
        tasks,
        entry.taskLimit,
        `Còn ${remaining}/${entry.taskLimit} lượt xét công việc hôm nay`,
      );
    }
    if (entry.trigger === 'two_tasks') {
      taskGoal(`talent_${index + 1}`, 2, entry.name, tasks, false);
      if (daily.monkeyTriggered)
        put(`talent_${index + 1}`, {
          kind: 'status',
          status: 'done',
          label: 'Đã tăng thưởng công việc cho ngày mai',
        });
    }
  });
  if (s === 'skinklet' && context.form >= 3) {
    const threshold = beastV2Projection(context)?.chanceBoostSleepThreshold ?? 14;
    put('talent_2', {
      kind: 'cycle',
      value: Math.min(threshold, facts.startSleepStreak),
      max: threshold,
      label:
        facts.startSleepStreak >= threshold
          ? `Chuỗi ngủ đã chốt: ${facts.startSleepStreak} ngày`
          : `Chuỗi ngủ đã chốt: ${facts.startSleepStreak}/${threshold} ngày`,
      status: facts.startSleepStreak >= threshold ? 'ready' : 'working',
      hint:
        facts.startSleepStreak >= threshold
          ? 'Thế Thân đang có hiệu lực'
          : 'Đủ chuỗi để tăng tỷ lệ Huyễn Tức',
    });
  }
  const awakening = context.form === 4 && (context.awakened || context.perfect);
  const perfect = context.form === 4 && context.perfect;
  if (awakening) {
    const skill = config.awakening;
    if (skill.target && ['cumulative', 'consecutive'].includes(skill.scope)) {
      cycle(
        'awakening',
        awakeningCounter(s),
        skill.target,
        s === 'pyropup' ? 'công việc' : ['hootlet', 'fluffle'].includes(s) ? 'đêm' : 'ngày',
        skill.scope === 'consecutive',
      );
    } else if (['voltfawn', 'flameow', 'cheerling', 'manteeny'].includes(s)) {
      taskGoal(
        'awakening',
        skill.target!,
        skill.name,
        s === 'manteeny' ? daily.beforeNoonTasks : tasks,
      );
    } else if (s === 'zappur') {
      if (tasks < skill.target!) taskGoal('awakening', skill.target!, skill.name);
      else
        put('awakening', {
          kind: 'status',
          status: 'ready',
          label: 'Các công việc tiếp theo đều được tăng thưởng',
        });
    } else if (s === 'skinklet') {
      const chance = Math.min(100, 3 * ((state.counters.drawMisses ?? 0) + 1));
      put('awakening', {
        kind: 'probability',
        value: chance,
        max: 100,
        label: `Xác suất lần x10 tiếp theo: ${chance}%`,
        status: chance === 100 ? 'ready' : 'working',
        hint: `${state.counters.drawMisses ?? 0} lần x10 chưa trúng · Nhận gói thưởng thì về 3%`,
      });
    } else {
      put('awakening', {
        kind: 'status',
        status: 'waiting',
        label: 'Xét thưởng khi chốt ngày',
        ...(facts.recentRewards.includes(skill.name)
          ? { hint: 'Lần chốt gần nhất đã nhận thưởng' }
          : {}),
      });
    }
  }
  if (perfect) {
    const skill = config.perfect;
    if (skill.target && skill.scope === 'consecutive') {
      cycle(
        'perfect',
        perfectCounter(s),
        skill.target,
        ['hootlet', 'fluffle', 'maskfry', 'goonbug', 'frostnip'].includes(s) ? 'đêm' : 'ngày',
        true,
      );
      if (s === 'skinklet' && facts.startSleepStreak < 7)
        result.perfect!.hint = 'Chỉ đếm ngày có chuỗi ngủ đúng giờ từ 7 ngày';
      if (s === 'fluffle' || s === 'frostnip')
        result.perfect!.hint += ` · Chuỗi ngủ đã chốt: ${facts.startSleepStreak} ngày`;
    } else if (s === 'gibber') {
      const value = Math.min(skill.target!, state.counters.breakthroughFailures ?? 0);
      put('perfect', {
        kind: 'cycle',
        value,
        max: skill.target!,
        status: value >= skill.target! ? 'ready' : 'working',
        label:
          value >= skill.target!
            ? 'Đã sẵn sàng cho lần đột phá tiếp theo'
            : `${value}/${skill.target} lần thất bại liên tiếp`,
        hint:
          value >= skill.target!
            ? 'Tăng tỷ lệ thành công và không mất tu vi nếu thất bại'
            : `Còn ${skill.target! - value} lần thất bại để có bảo hộ`,
      });
    } else if (s === 'humbug') {
      quota(
        'perfect',
        daily.fusionUses,
        skill.target!,
        `Còn ${Math.max(0, skill.target! - daily.fusionUses)}/${skill.target} lượt ghép hôm nay`,
      );
    } else if (s === 'voltfawn') {
      put('perfect', {
        kind: 'quota',
        value: daily.earlyRewarded ? 0 : 1,
        max: 1,
        status: daily.earlyRewarded ? 'done' : 'working',
        label: daily.earlyRewarded ? 'Đã nhận thưởng hôm nay' : 'Còn 1 lượt thưởng hôm nay',
        hint: daily.earlyRewarded
          ? 'Hồi lại vào ngày sinh hoạt mới'
          : 'Hoàn thành công việc từ 05:00 đến trước 08:00',
      });
    } else if (s === 'cheerling') {
      taskGoal('perfect', skill.target!, skill.name);
    } else if (s === 'flameow') {
      put('perfect', {
        kind: 'status',
        status: 'ready',
        label: `Công việc tiếp theo: thêm ${Math.min(3, tasks + 1)} tu vi`,
        hint: `Đã hoàn thành ${tasks} công việc hôm nay · Không giới hạn số việc`,
      });
    } else if (s === 'pyropup') {
      put('perfect', {
        kind: 'cycle',
        value: Math.min(30, facts.startSleepStreak),
        max: 30,
        status:
          facts.multiplier === 3 ? 'ready' : facts.startSleepStreak >= 30 ? 'waiting' : 'working',
        label:
          facts.multiplier === 3
            ? 'Hiệu ứng đang áp dụng hôm nay'
            : `Chuỗi ngủ đã chốt: ${facts.startSleepStreak}/30 ngày`,
        hint:
          facts.multiplier === 3
            ? `Thưởng ×3 · Phạt tu vi ×3 · Tự trừ ${BEAST_V2_SELF_BURN_FINAL} tu vi/ngày`
            : facts.startSleepStreak >= 30
              ? 'Áp dụng từ ngày sinh hoạt tiếp theo'
              : 'Đủ chuỗi để mở hiệu ứng cho ngày tiếp theo',
      });
    } else if (s === 'punchimp') {
      const tower = facts.tower;
      if (tower?.used)
        put('perfect', {
          kind: 'status',
          status: 'done',
          label: 'Đã dùng lượt cứu bẫy trong lượt tháp này',
        });
      else if (tower && !tower.active)
        put('perfect', {
          kind: 'status',
          status: 'waiting',
          label: 'Lượt tháp hôm nay đã kết thúc',
        });
      else if (!tower)
        put('perfect', {
          kind: 'status',
          status: 'waiting',
          label: 'Lượt cứu bẫy được cấp khi bắt đầu lượt tháp',
        });
      else
        put('perfect', {
          kind: 'quota',
          value: tower.available && !tower.used ? 1 : 0,
          max: 1,
          status: tower.used ? 'done' : tower.available ? 'ready' : 'waiting',
          label: tower.used
            ? 'Đã dùng lượt cứu bẫy trong lượt tháp này'
            : tower.available
              ? 'Còn 1 lượt cứu bẫy trong lượt tháp này'
              : 'Lượt tháp này không có bảo hộ từ linh thú này',
        });
    } else {
      put('perfect', {
        kind: 'status',
        status: 'waiting',
        label: 'Xét thưởng khi chốt ngày hoàn hảo',
        ...(facts.recentRewards.includes(skill.name)
          ? { hint: 'Lần chốt gần nhất đã nhận thưởng' }
          : {}),
      });
    }
  }
  return result;
}
function awakeningCounter(speciesId: string): string {
  if (speciesId === 'hootlet') return 'sleep95';
  if (speciesId === 'fluffle') return 'sleepAccum95';
  if (speciesId === 'goonbug') return 'habitDry';
  if (speciesId === 'rubblet') return 'perfect95';
  if (speciesId === 'pyropup') return 'task95';
  return 'habit95';
}
function perfectCounter(speciesId: string): string {
  if (speciesId === 'funglet') return 'combined100';
  if (['shardsnail', 'manteeny', 'skinklet'].includes(speciesId)) return 'perfect100';
  return 'sleep100';
}
export function beastV2BreakthroughModifier(context: BeastV2Context, state: BeastV2State) {
  const ready =
    context.speciesId === 'gibber' &&
    context.form === 4 &&
    context.perfect &&
    (state.counters.breakthroughFailures ?? 0) >= 3;
  return { chancePoints: ready ? 5 : 0, preventLoss: ready };
}
export function beastV2TowerEligible(context: BeastV2Context): boolean {
  return context.speciesId === 'punchimp' && context.form === 4 && context.perfect;
}
export function beastV2Multiplier(context: BeastV2Context, startSleepStreak: number): 1 | 3 {
  return context.speciesId === 'pyropup' &&
    context.form === 4 &&
    context.perfect &&
    startSleepStreak >= 30
    ? 3
    : 1;
}
export function beastV2SelfBurn(context: BeastV2Context, startSleepStreak: number): number {
  return beastV2Multiplier(context, startSleepStreak) === 3 ? BEAST_V2_SELF_BURN_FINAL : 0;
}

/**
 * Pure, base-amount effects only. Adapter commits result + source receipt atomically.
 * IDs, eligibility, original-day snapshots, multiplier, wallet clamping and pending
 * sleep are adapter responsibilities. Never pass an unfinalized day here.
 */
export function reduceBeastV2(
  previous: BeastV2State,
  context: BeastV2Context,
  event: BeastV2Event,
  rng: () => number,
): BeastV2Result {
  const state: BeastV2State = {
    ...previous,
    counters: { ...previous.counters },
    daily: { ...previous.daily },
  };
  const result: BeastV2Result = {
    state,
    reward: emptyBeastV2Reward(),
    refundQi: 0,
    fusion: null,
    nextDayTaskBuff: false,
    activated: [],
  };
  const config = beastV2Config(context.speciesId);
  if (!config) return result;
  const awakening = context.form === 4 && (context.awakened || context.perfect);
  const perfect = context.form === 4 && context.perfect;
  const hit = (chance: number): boolean => chance >= 1 || (chance > 0 && rng() < chance);
  const add = (reward: RewardInput, name: string) => {
    result.reward.qi += reward.qi ?? 0;
    result.reward.tickets += reward.tickets ?? 0;
    result.reward.summonTickets += reward.summonTickets ?? 0;
    for (const [key, value] of Object.entries(reward.items ?? {})) {
      const item = key as Item;
      result.reward.items[item] = (result.reward.items[item] ?? 0) + value;
    }
    result.activated.push(name);
  };
  const advance = (key: string, qualified: boolean, target: number, consecutive = false) => {
    if (!qualified) {
      if (consecutive) state.counters[key] = 0;
      return false;
    }
    const count = (state.counters[key] ?? 0) + 1;
    state.counters[key] = count >= target ? 0 : count;
    return count >= target;
  };
  const proc = (trigger: BeastV2Talent['trigger'], ordinal?: number) => {
    let anyHit = false;
    for (const entry of config.talents) {
      if (
        entry.trigger !== trigger ||
        (ordinal !== undefined && ordinal > (entry.taskLimit ?? Infinity))
      )
        continue;
      let chance = entry.chances[context.form - 1]!;
      if (context.speciesId === 'skinklet' && event.kind === 'day' && event.sleepStreak >= 14)
        chance += context.form === 4 ? 0.2 : context.form === 3 ? 0.1 : 0;
      if (hit(chance)) {
        anyHit = true;
        if (entry.refundQi !== undefined && event.kind === 'breakthrough')
          result.refundQi = Math.max(
            result.refundQi,
            Math.min(entry.refundQi, Math.max(0, event.lostQi)),
          );
        add(entry.reward, entry.name);
      }
    }
    return anyHit;
  };
  if (event.kind === 'day') {
    if (state.lastDay !== null && event.day <= state.lastDay) return result;
    if (event.active === false || (state.lastDay !== null && event.day !== state.lastDay + 1)) {
      for (const key of [
        'sleep95',
        'sleep100',
        'combined100',
        'perfect100',
        'perfect95',
        'habitDry',
      ])
        state.counters[key] = 0;
    }
    state.lastDay = event.day;
    if (event.active === false) return result;
    const habit = event.habitSatisfied && event.habitRewardEligible;
    const sleep = event.sleepOnTime;
    const combined = event.habitSatisfied && sleep;
    const perfectDay = combined && event.taskCount >= 1;
    const habitHit = habit && event.settleHabit !== false ? proc('habit') : false;
    if (sleep && event.settleSleep !== false) proc('sleep');
    if (perfectDay) proc('perfect');
    const s = context.speciesId;
    if (s === 'punchimp' && context.form === 4 && habit && event.settleHabit !== false)
      add({ tickets: 1 }, 'Hầu Vương Tụ Khí: vé T4');
    if (awakening) {
      if (s === 'humbug' && advance('habit95', habit, 3))
        add({ items: { middle: 1 } }, config.awakening.name);
      if (s === 'hootlet' && advance('sleep95', sleep, 3, true))
        add({ tickets: 3 }, config.awakening.name);
      if (s === 'gibber' && habit) add({ qi: 1 }, config.awakening.name);
      if (s === 'funglet' && combined) add({ qi: 2 }, config.awakening.name);
      if (s === 'shardsnail' && advance('habit95', habit, 5))
        add({ tickets: 5, qi: 10 }, config.awakening.name);
      if (s === 'fluffle' && advance('sleepAccum95', sleep, 3))
        add({ qi: 5 }, config.awakening.name);
      if (s === 'maskfry' && habit) add({ qi: 2 }, config.awakening.name);
      if (s === 'goonbug') {
        if (habitHit || !habit) state.counters.habitDry = 0;
        else if (advance('habitDry', true, 7, true))
          add({ items: { peace: 1 } }, config.awakening.name);
      }
      if (s === 'frostnip' && combined) add({ tickets: 2 }, config.awakening.name);
      if (s === 'punchimp' && advance('habit95', habit, 5))
        add({ summonTickets: 1 }, config.awakening.name);
      if (s === 'rubblet' && advance('perfect95', perfectDay, 7, true))
        add({ tickets: 100 }, config.awakening.name);
    }
    if (perfect) {
      if (s === 'hootlet' && advance('sleep100', sleep, 14, true) && hit(0.4))
        add({ items: { heart: 1 } }, config.perfect.name);
      if (s === 'funglet' && advance('combined100', combined, 3, true))
        add({ tickets: 3, qi: 3 }, config.perfect.name);
      if (s === 'shardsnail' && advance('perfect100', perfectDay, 5, true))
        add({ tickets: 20, qi: 20 }, config.perfect.name);
      if (s === 'manteeny' && advance('perfect100', perfectDay, 2, true))
        add({ tickets: 3, qi: 5 }, config.perfect.name);
      if (s === 'fluffle' && advance('sleep100', sleep, 3, true))
        add({ qi: Math.max(0, event.sleepStreak) }, config.perfect.name);
      if (s === 'maskfry' && advance('sleep100', sleep, 5, true))
        add({ summonTickets: 1 }, config.perfect.name);
      if (s === 'goonbug' && advance('sleep100', sleep, 10, true))
        add({ items: hit(0.3) ? { heart: 1 } : { peace: 1 } }, config.perfect.name);
      if (s === 'frostnip' && advance('sleep100', sleep, 3, true))
        add({ tickets: Math.max(0, event.sleepStreak) }, config.perfect.name);
      if (s === 'zappur' && perfectDay) {
        const amount = Math.min(5, Math.ceil(Math.max(0, event.sleepStreak) / 2));
        add({ qi: amount, tickets: amount }, config.perfect.name);
      }
      if (s === 'skinklet' && advance('perfect100', perfectDay && event.sleepStreak >= 7, 3, true))
        add({ tickets: 30, summonTickets: 1 }, config.perfect.name);
      if (s === 'rubblet' && perfectDay)
        add({ tickets: Math.max(0, event.sleepStreak) }, config.perfect.name);
    }
    return result;
  }
  // Late day settlement must not rewind immediate-event quotas for today's day.
  if (event.day > state.daily.day) state.daily = emptyDaily(event.day);
  if (event.day < state.daily.day) throw new Error('BEAST_V2_OUT_OF_ORDER_IMMEDIATE_EVENT');
  if (event.kind === 'task') {
    if (!Number.isSafeInteger(event.ordinal) || event.ordinal <= state.daily.taskOrdinal)
      return result;
    state.daily.taskOrdinal = event.ordinal;
    proc('task', event.ordinal);
    const s = context.speciesId;
    if (awakening && event.ordinal === 3) {
      if (s === 'voltfawn' || s === 'flameow') add({ qi: 3 }, config.awakening.name);
      if (s === 'cheerling') add({ tickets: 3 }, config.awakening.name);
    }
    if (awakening && s === 'manteeny' && event.localMinute < 720) {
      state.daily.beforeNoonTasks += 1;
      if (state.daily.beforeNoonTasks === 3) add({ tickets: 10 }, config.awakening.name);
    }
    if (awakening && s === 'zappur' && event.ordinal >= 3)
      add({ tickets: 3 }, config.awakening.name);
    if (awakening && s === 'pyropup' && advance('task95', true, 10)) {
      add({ tickets: 10, ...(hit(0.3) ? { summonTickets: 1 } : {}) }, config.awakening.name);
    }
    if (
      s === 'punchimp' &&
      context.form >= 3 &&
      event.ordinal >= 2 &&
      !state.daily.monkeyTriggered
    ) {
      state.daily.monkeyTriggered = true;
      proc('two_tasks');
      result.nextDayTaskBuff = true;
    }
    if (perfect) {
      if (
        s === 'voltfawn' &&
        event.localMinute >= 300 &&
        event.localMinute < 480 &&
        !state.daily.earlyRewarded
      ) {
        state.daily.earlyRewarded = true;
        add({ qi: 5 }, config.perfect.name);
      }
      if (s === 'cheerling' && event.ordinal === 8) add({ summonTickets: 1 }, config.perfect.name);
      if (s === 'flameow') add({ qi: Math.min(3, event.ordinal) }, config.perfect.name);
    }
  } else if (event.kind === 'draw') {
    if (context.speciesId === 'skinklet' && awakening && event.count === 10) {
      const chance = Math.min(1, 0.03 * ((state.counters.drawMisses ?? 0) + 1));
      if (hit(chance)) {
        state.counters.drawMisses = 0;
        add({ summonTickets: 1, tickets: 30 }, config.awakening.name);
      } else state.counters.drawMisses = (state.counters.drawMisses ?? 0) + 1;
    }
  } else if (event.kind === 'fusion') {
    if (
      context.speciesId === 'humbug' &&
      perfect &&
      event.from === 'basic' &&
      state.daily.fusionUses < 3
    ) {
      state.daily.fusionUses += 1;
      result.fusion = { extraMiddle: event.success ? 1 : 0, refundBasic: event.success ? 0 : 1 };
      result.activated.push(config.perfect.name);
    }
  } else if (event.kind === 'breakthrough') {
    const modifier = beastV2BreakthroughModifier(context, previous);
    if (!event.success) proc('breakthrough');
    if (context.speciesId === 'gibber' && perfect) {
      if (modifier.preventLoss) {
        state.counters.breakthroughFailures = 0;
        if (!event.success) result.refundQi = Math.max(0, event.lostQi);
        result.activated.push(config.perfect.name);
      } else
        state.counters.breakthroughFailures = event.success
          ? 0
          : Math.min(3, (state.counters.breakthroughFailures ?? 0) + 1);
    }
  }
  return result;
}
