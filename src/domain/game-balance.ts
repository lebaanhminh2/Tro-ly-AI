import type { GameBoss } from './game-content-model.ts';

// Content revision 3: advance from the introductory four main encounters to
// opponents that can read the same cast two turns in a row. This is applied
// only when creating new content snapshots, never to an existing battle.
export function withReadStances(bosses: GameBoss[]): GameBoss[] {
    return bosses.map(boss => {
        if (boss.chapter === 1 && (!boss.kind || boss.kind === 'main')) return boss;
        const repeatWard = boss.chapter <= 3 ? 650 : boss.chapter <= 9 ? 750 : 850;
        return { ...boss, repeatWard,
            advice: [...boss.advice, 'Nếu lặp lại chiêu của lượt trước, sát thương gây ra trong lượt này giảm ' + repeatWard / 10 + '%, kể cả đòn trễ và phản thương. Đổi chiêu để phá thế đọc; lực phòng thủ và giá thi triển vẫn giữ nguyên.'] };
    });
}
