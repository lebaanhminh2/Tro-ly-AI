import { DAY_MS, operatingDay } from './healthy.ts';
import { habitWeekStart } from './habits.ts';
import { BEAST_SKILLS, type SkillReward, type UltimateKind } from './linh-thu-skills.ts';
import { trainingView, type BeastAttempt } from './linh-thu-training.ts';

export type BeastUltimate = {
  kind: UltimateKind;
  speciesId: string;
  beastId: string;
  attemptId: string;
  week: number;
  activatedAt: number;
  expiresAt: number;
  day: number;
  remaining: number;
  sleepRemaining: number;
  breakthroughRemaining: number;
  count: number;
  targets: string[];
  completedTargets: string[];
  pact?: 'reward' | 'guard';
  cancelled: boolean;
  settled: boolean;
};
export type UltimateChoice = { key: string; options: SkillReward[] };
export type UltimateEvent = {
  kind: 'task' | 'habit' | 'sleep' | 'combined' | 'breakthrough' | 'fusion';
  sourceId: string;
  day: number;
  at: number;
  qualified: boolean;
  ordinal?: number;
  success?: boolean;
  actualQiLoss?: number;
  streakAtRisk?: boolean;
  qiAtRisk?: boolean;
  fusionTier?: string;
};
export type UltimateOutcome = {
  state: BeastUltimate;
  reward: SkillReward;
  choices: UltimateChoice[];
  refundQi: number;
  protectStreak: boolean;
  protectQi: boolean;
};

/** Calendar week is UTC+7, independent of the user's operating-day boundary. */
export function beastCalendarWeek(now: number): number {
  return habitWeekStart(operatingDay(now, 0));
}
export function activateBeastUltimate(input: {
  attempt: BeastAttempt;
  beastId: string;
  attemptId: string;
  day: number;
  now: number;
  dayEnd: number;
  targets?: string[];
  pact?: 'reward' | 'guard';
}): BeastUltimate {
  if (!trainingView(input.attempt).perfect) throw Error('BEAST_PERFECT_REQUIRED');
  const skill = BEAST_SKILLS[input.attempt.speciesId]!.ultimate;
  const targets = input.targets ?? [];
  const targetCount = skill.kind === 'marked_tasks' ? 2 : skill.kind === 'magnet_tasks' ? 3 : 0;
  if (
    !Array.isArray(targets) ||
    new Set(targets).size !== targets.length ||
    targets.some((id) => typeof id !== 'string' || !id || id.length > 120) ||
    (targetCount === 0 && targets.length) ||
    (skill.kind === 'marked_tasks' && targets.length !== 2) ||
    (skill.kind === 'magnet_tasks' && (targets.length < 1 || targets.length > targetCount))
  )
    throw Error('INVALID_BEAST_TARGETS');
  if (
    skill.kind === 'breakthrough_pact'
      ? !['reward', 'guard'].includes(input.pact ?? '')
      : input.pact !== undefined
  )
    throw Error('INVALID_BEAST_PACT');
  const week = beastCalendarWeek(input.now);
  const weekEnd = (week + 7) * DAY_MS - 7 * 3600000;
  const expiresAt = skill.expires === 'day' ? Math.min(input.dayEnd, weekEnd) : weekEnd;
  if (
    !Number.isSafeInteger(input.now) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= input.now
  )
    throw Error('INVALID_BEAST_ULTIMATE_TIME');
  return {
    kind: skill.kind,
    speciesId: input.attempt.speciesId,
    beastId: input.beastId,
    attemptId: input.attemptId,
    week,
    activatedAt: input.now,
    expiresAt,
    day: input.day,
    remaining: skill.parameters.uses ?? 0,
    sleepRemaining: skill.parameters.sleepUses ?? 0,
    breakthroughRemaining: skill.parameters.breakthroughUses ?? 0,
    count: 0,
    targets: [...targets],
    completedTargets: [],
    ...(input.pact ? { pact: input.pact } : {}),
    cancelled: false,
    settled: false,
  };
}

/** Persistence journals each original source exactly once in the same reward transaction. */
export function applyBeastUltimate(saved: BeastUltimate, event: UltimateEvent): UltimateOutcome {
  const state = {
    ...saved,
    targets: [...saved.targets],
    completedTargets: [...saved.completedTargets],
  };
  const out: UltimateOutcome = {
    state,
    reward: {},
    choices: [],
    refundQi: 0,
    protectStreak: false,
    protectQi: false,
  };
  const assignedDay = ['sleep', 'habit', 'combined'].includes(event.kind);
  const inWindow = assignedDay
    ? habitWeekStart(event.day) === state.week
    : event.at < state.expiresAt;
  if (state.cancelled || state.settled || event.at < state.activatedAt || !inWindow) return out;
  const p = BEAST_SKILLS[state.speciesId]!.ultimate.parameters;
  const choice = (options: SkillReward[]) => out.choices.push({ key: event.sourceId, options });
  if (
    event.kind === 'task' &&
    event.qualified &&
    Number.isInteger(event.ordinal) &&
    event.ordinal! >= 1 &&
    event.ordinal! <= 5
  ) {
    if (state.kind === 'task_bounty' && state.count < p.target!) {
      if (++state.count === p.target) choice([{ summonTickets: p.summonTickets }, { qi: p.qi }]);
    } else if (state.kind === 'task_combo' && state.day === event.day && state.count < 3) {
      out.reward = { qi: [p.first!, p.second!, p.third!][state.count++]! };
    } else if (
      ['marked_tasks', 'magnet_tasks'].includes(state.kind) &&
      state.targets.includes(event.sourceId) &&
      !state.completedTargets.includes(event.sourceId)
    ) {
      state.completedTargets.push(event.sourceId);
      if (state.kind === 'marked_tasks') {
        out.reward = { tickets: p.ticketsPerTask };
        if (state.completedTargets.length === state.targets.length) out.reward.qi = p.completionQi;
      } else choice([{ tickets: p.ticketsPerTask }, { qi: p.qiPerTask }]);
    }
  }
  const bounty =
    state.kind === 'habit_bounty'
      ? 'habit'
      : state.kind === 'sleep_bounty'
        ? 'sleep'
        : state.kind === 'dream_bounty'
          ? 'combined'
          : null;
  if (bounty && event.kind === bounty && event.qualified && state.count < p.target!) {
    if (++state.count === p.target) {
      if (state.kind === 'dream_bounty') choice([{ tickets: p.tickets }, { qi: p.qi }]);
      else out.reward = { summonTickets: p.summonTickets };
    }
  }
  if (event.kind === 'sleep') {
    const harm = !!(event.streakAtRisk || event.qiAtRisk);
    if (state.kind === 'meteor_guard' && harm && state.sleepRemaining > 0) {
      state.sleepRemaining--;
      out.protectStreak = true;
      out.protectQi = true;
    } else if (
      ['frost_guard', 'knight_guard', 'owl_guard'].includes(state.kind) &&
      state.remaining > 0
    ) {
      state.remaining--;
      if (!event.qualified) {
        out.protectStreak = true;
        out.protectQi = state.kind !== 'owl_guard';
      } else if (state.kind === 'frost_guard') out.reward = { qi: p.onTimeQi };
      else if (state.kind === 'knight_guard')
        out.reward = { items: { heart: p.onTimeHeart, peace: p.onTimePeace } };
      else choice([{ tickets: p.onTimeTickets }, { qi: p.onTimeQi }]);
    }
  }
  if (event.kind === 'breakthrough') {
    if (
      !Number.isSafeInteger(event.actualQiLoss) ||
      event.actualQiLoss! < 0 ||
      typeof event.success !== 'boolean'
    )
      throw Error('INVALID_BEAST_BREAKTHROUGH_EVENT');
    if (
      state.kind === 'meteor_guard' &&
      !event.success &&
      event.actualQiLoss! > 0 &&
      state.breakthroughRemaining > 0
    ) {
      state.breakthroughRemaining--;
      out.refundQi = event.actualQiLoss!;
    } else if (['breakthrough_pact', 'turtle_guard'].includes(state.kind) && state.remaining > 0) {
      state.remaining--;
      if (state.kind === 'turtle_guard') {
        if (event.success) out.reward = { qi: p.successQi };
        else out.refundQi = Math.min(p.maxRefund!, event.actualQiLoss!);
      } else if (state.pact === 'guard' && !event.success) out.refundQi = event.actualQiLoss!;
      else if (state.pact === 'reward' && event.success)
        out.reward = { summonTickets: p.summonTickets };
    }
  }
  if (
    event.kind === 'fusion' &&
    state.kind === 'double_fusion' &&
    state.remaining > 0 &&
    event.fusionTier === 'basic'
  ) {
    state.remaining--;
    out.reward = event.success
      ? { items: { middle: p.successOutputs! - 1 } }
      : { items: { basic: p.failureRefund } };
  }
  return out;
}

/** Call only after all original events in the week have been assessed. */
export function settleBeastUltimate(
  saved: BeastUltimate,
  now: number,
): { state: BeastUltimate; reward: SkillReward } {
  if (saved.settled || saved.cancelled || now < saved.expiresAt)
    return { state: saved, reward: {} };
  return {
    state: { ...saved, settled: true },
    reward:
      saved.kind === 'meteor_guard'
        ? {
            qi:
              (saved.sleepRemaining + saved.breakthroughRemaining) *
              BEAST_SKILLS[saved.speciesId]!.ultimate.parameters.unusedQi!,
          }
        : {},
  };
}
