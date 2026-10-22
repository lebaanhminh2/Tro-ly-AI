import type { BeastAccount, OwnedBeast } from '../domain/linh-thu-account.ts';
import type { HealthyState } from '../domain/healthy.ts';
import type { BeastAttempt } from '../domain/linh-thu-training.ts';
import type { HabitTrainingStatus } from '../domain/linh-thu.ts';
import type { BeastTower } from '../domain/linh-thu-tower.ts';
import type { BeastUltimate, UltimateChoice } from '../domain/linh-thu-ultimates.ts';
import type { SkillReward } from '../domain/linh-thu-skills.ts';
export type BeastRewardChoice = { id: string; options: SkillReward[]; result: unknown | null };
export type BeastSummonChoice = {
  id: string;
  candidates: string[];
  remaining: number;
  count: number;
  requestId: string;
  pity: BeastAccount['pity'];
  result: unknown | null;
};

export type BeastSnapshot = {
  state: BeastAccount;
  version: number;
  activatedDay: number | null;
  skillCutoverDay?: number | null;
};
export type BeastCollectionOverview = Record<string, { count: number; best: OwnedBeast }>;
export type BeastRole = 'training' | 'companion';
export type BeastRoleSelection = {
  role: BeastRole;
  day: number;
  beastId: string | null;
  attemptId: string | null;
};
export type BeastTowerRow = {
  state: BeastTower;
  version: number;
  expiresAt: number;
  eligibility: unknown;
};
export type BeastTowerEligibility = {
  day: number;
  startAt: number;
  endAt: number;
  habitVersion: number;
  achieved: number;
  missed: number;
  taskId: string | null;
  eligible: boolean;
  rescueAvailable: boolean;
  rescueBeastId?: string | null;
  skillVersion?: 1 | 2;
  rewardMultiplier?: 1 | 3;
};
export type BeastMutation<T> = {
  state: BeastAccount;
  healthy: HealthyState;
  result: T;
  newBeasts?: readonly { id: string; speciesId: string; attemptId: string }[];
  protection?: { beastId: string; isProtected: boolean };
  sacrifice?: readonly string[];
  newAttempts?: readonly { id: string; beastId: string; speciesId: string }[];
  updateAttempts?: readonly {
    id: string;
    attempt: BeastAttempt;
    counters?: Record<string, number>;
    startedDay?: number;
    endedDay?: number;
    lastSettledDay?: number;
  }[];
  roleChanges?: readonly (BeastRoleSelection & { remove?: boolean })[];
  habitVersion?: number;
  ultimate?: BeastUltimate;
  requiredOpenTasks?: readonly string[];
  resolveChoice?: { id: string; result: unknown };
  summonChoice?: BeastSummonChoice;
  rewardChoices?: readonly { id: string; choice: UltimateChoice }[];
  settlement?: {
    day: number;
    trainingId: string | null;
    companionId: string | null;
    outcomes: readonly HabitTrainingStatus[];
    result: unknown;
  };
  tower?: {
    state: BeastTower;
    version: number;
    expiresAt: number;
    eligibility: unknown;
    requiredTaskId?: string;
    startAt?: number;
  };
};
export interface BeastStore {
  read(owner: string): Promise<BeastSnapshot>;
  individual(owner: string, id: string, attemptId?: string): Promise<OwnedBeast | null>;
  sacrificeSelection(
    owner: string,
    ids: readonly string[],
    day: number,
    now: number,
  ): Promise<OwnedBeast[]>;
  roles(
    owner: string,
    day: number,
  ): Promise<{ current: BeastRoleSelection[]; pending: BeastRoleSelection[] }>;
  ultimate(owner: string, week: number): Promise<BeastUltimate | null>;
  rewardChoice(owner: string, id: string): Promise<BeastRewardChoice | null>;
  summonChoice(owner: string): Promise<BeastSummonChoice | null>;
  sleepTarget(owner: string, day: number): Promise<number | null>;
  dayEnd(owner: string, day: number): Promise<number | null>;
  nextSettlement(owner: string): Promise<number | null>;
  assessedHabitDay(
    owner: string,
    day: number,
    now: number,
  ): Promise<{
    ready: boolean;
    version?: number;
    outcomes?: HabitTrainingStatus[];
    habitSatisfied?: boolean;
    habitRewardEligible?: boolean;
  }>;
  tower(owner: string, day: number): Promise<BeastTowerRow | null>;
  expiredTower(owner: string, now: number): Promise<BeastTowerRow | null>;
  towerEligibility(owner: string, now: number): Promise<BeastTowerEligibility>;
  collection(
    owner: string,
    cursor?: string | null,
    limit?: number,
    speciesId?: string | null,
  ): Promise<{ beasts: OwnedBeast[]; nextCursor: string | null }>;
  transact<T>(
    owner: string,
    requestId: string,
    operation: string,
    input: unknown,
    day: number,
    now: number,
    expectedVersion: number,
    apply: (snapshot: BeastSnapshot, healthy: HealthyState) => BeastMutation<T>,
    deadline?: number,
  ): Promise<T>;
}
