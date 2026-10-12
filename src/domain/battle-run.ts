import { resolveBattleTurn, withdrawBattle, type BattleLogEntry, type BattleState, type BattleTurnInput } from './battle.ts';

export type BattleRun = { id: string; bossId: string; contentVersion: string; combatRank: number; weaponId?: string | null; state: BattleState;
    startsDay: number; lastDay: number | null; waitDays: number; rescueUntilDay: number | null; deathPaid: boolean };
export type BattleDayResult = { run: BattleRun; entries: BattleLogEntry[]; fought: boolean; automaticDeath: boolean };

// Only settled habit successes contribute. Neutral days, partial logs and
// weekly quota overflow are not completions; six mature successes cap at 60%.
export function battleHabitContribution(sources: { successes: number; mature: boolean }[]): number {
    const successes = sources.filter(source => source.successes > 0), mature = successes.filter(source => source.mature).length;
    return successes.length ? 300 + 60 * Math.min(5, Math.max(0, mature - (mature === successes.length ? 1 : 0))) : 0;
}

export function settleBattleDay(before: BattleRun, day: number, choice: BattleTurnInput | null): BattleDayResult {
    if (!Number.isSafeInteger(day) || day < before.startsDay || before.lastDay !== null && day <= before.lastDay)
        throw Error('INVALID_BATTLE_DAY');
    const run = structuredClone(before); run.lastDay = day;
    if (run.state.status === 'awaiting_rescue') return { run, entries: [], fought: false,
        automaticDeath: run.rescueUntilDay !== null && day + 1 >= run.rescueUntilDay };
    if (run.state.status !== 'active') return { run, entries: [], fought: false, automaticDeath: false };
    if (!choice) {
        run.waitDays++;
        const exhausted = run.waitDays >= 3;
        if (exhausted) run.state = withdrawBattle(run.state);
        return { run, fought: false, automaticDeath: false,
            entries: [{ kind: exhausted ? 'end' : 'effect', text: exhausted
                ? 'Ba ngày chưa chọn chiêu. Trận đã rút an toàn; cam kết habit vẫn ghi nhận như thường.'
                : 'Chưa chọn chiêu. Trận chờ, đối thủ không tự phản công.' }] };
    }
    const resolved = resolveBattleTurn(run.state, choice);
    run.state = resolved.state; run.waitDays = 0;
    if (run.state.status === 'awaiting_rescue') run.rescueUntilDay = day + 3;
    return { run, entries: resolved.entries, fought: true, automaticDeath: run.state.status === 'dead' && !run.deathPaid };
}

export function assertBattleCanChange(run: BattleRun, day: number, nextSettlementDay: number): void {
    if (nextSettlementDay < day) throw Error('GAME_CATCHING_UP');
    if (day < run.startsDay) throw Error('BATTLE_NOT_STARTED');
    if (run.state.status === 'awaiting_rescue' && run.rescueUntilDay !== null && day >= run.rescueUntilDay)
        throw Error('BATTLE_RESCUE_EXPIRED');
}
