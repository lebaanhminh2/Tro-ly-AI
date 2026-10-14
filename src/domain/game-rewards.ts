import { newBattleState, type BattleFighter, type BattleState } from './battle.ts';
import { techniqueById } from './techniques.ts';
import type { GameBoss } from './game-content-model.ts';

export const GAME_WEAPONS = [
    { id: 'thach-tam', name: 'Thạch Tâm', sourceBossId: 'thu-mo', description: 'Bắt đầu trận với khiên bằng 60% lực công nền, giữ tới hết lượt 2.', attackFactor: 1000, hpFactor: 1000, shieldFactor: 600 },
    { id: 'thuan-phong', name: 'Thuận Phong', sourceBossId: 'di-san-vo-mon', description: 'Lực công nền tăng 8%, HP tối đa giảm 5%.', attackFactor: 1080, hpFactor: 950, shieldFactor: 0 },
    { id: 'dinh-tam', name: 'Định Tâm', sourceBossId: 'ky-hanh-3', description: 'HP tối đa tăng 10%, lực công nền giảm 5%.', attackFactor: 950, hpFactor: 1100, shieldFactor: 0 },
];
export const GAME_ACHIEVEMENTS = [
    { id: 'mo-loi', name: 'Mở lối', description: 'Thắng trận đầu tiên.' },
    { id: 'khong-cuu', name: 'Vững bước', description: 'Thắng một trận mà không dùng cứu mạng.' },
    { id: 'vuot-tu-canh', name: 'Trở về', description: 'Thắng sau khi dùng quyền cứu của trận.' },
    { id: 'di-giao', name: 'Dị Giáo', description: 'Thắng sau khi thực sự thi triển công pháp của ít nhất hai phái.' },
    { id: 'kiem-do', name: 'Tứ Ấn Kiếm Đồ', description: 'Vượt thử thách Tứ Ấn sau khi học bốn kiếm thức.' },
    { id: 'diet-than', name: 'DIỆT THẦN', description: 'Thắng Thiên Mệnh Thần Chủ, sau cả ba trận chương15.' },
    ...['thien-kiem', 'bat-diet', 'u-minh', 'thai-hu', 'thien-co'].map((school, index) => ({ id: 'thuan-' + school,
        name: ['Thiên Kiếm độc hành', 'Bất Diệt độc hành', 'U Minh độc hành', 'Thái Hư độc hành', 'Thiên Cơ độc hành'][index]!,
        description: 'Thắng với bộ chiêu và các công pháp đã dùng thuộc một phái.' })),
];
export function battleWeapon(id: string) {
    const weapon = GAME_WEAPONS.find(value => value.id === id);
    if (!weapon) throw Error('INVALID_GAME_WEAPON');
    return weapon;
}
export function armedBattleState(player: BattleFighter, boss: GameBoss, loadout: BattleState['loadout'], intents: BattleState['intents'], weaponId: string | null, rule = 'battle-v1'): BattleState {
    const weapon = weaponId ? battleWeapon(weaponId) : null, fighter = { ...player };
    if (weapon) {
        fighter.maxHp = Math.max(1, Math.floor(fighter.maxHp * weapon.hpFactor / 1000)); fighter.hp = fighter.maxHp;
        fighter.attack = Math.max(1, Math.floor(fighter.attack * weapon.attackFactor / 1000));
    }
    const state = newBattleState(fighter, boss.fighter, loadout, intents, boss.maxTurns, boss.revival, rule);
    if (weapon?.shieldFactor) state.statuses.push({ key: 'weapon:thach-tam', kind: 'shield', target: 'player',
        value: Math.floor(fighter.attack * weapon.shieldFactor / 1000), expiresTurn: 2, dueTurn: null });
    return state;
}
export function earnedBattleRewards(boss: GameBoss, state: BattleState): { weapons: string[]; achievements: string[] } {
    if (state.status !== 'won') return { weapons: [], achievements: [] };
    const achievements = new Set(['mo-loi', state.rescueUsed ? 'vuot-tu-canh' : 'khong-cuu', ...(boss.rewards?.achievements ?? [])]);
    const used = Object.keys(state.lastUses).filter(id => id !== 'vo-ky').map(techniqueById);
    const schools = new Set(used.map(technique => technique.school).filter(school => school !== null));
    if (schools.size >= 2) achievements.add('di-giao');
    const loadout = state.loadout.map(skill => techniqueById(skill.id)), sole = loadout[0]?.school;
    if (sole && [...loadout, ...used].every(technique => technique.school === sole)) achievements.add('thuan-' + sole);
    if (boss.id === 'di-san-van-thien') achievements.add('kiem-do');
    const weapons = [...new Set(boss.rewards?.weapons ?? [])];
    if (weapons.some(id => !GAME_WEAPONS.some(value => value.id === id)) || [...achievements].some(id => !GAME_ACHIEVEMENTS.some(value => value.id === id))) throw Error('INVALID_GAME_REWARD');
    return { weapons, achievements: [...achievements] };
}
