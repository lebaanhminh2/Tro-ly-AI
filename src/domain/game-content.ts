import type { BossIntent } from './battle.ts';
import { INITIAL_TECHNIQUES, SCHOOLS, TECHNIQUES } from './techniques.ts';
import { REALMS } from './healthy.ts';
import { CAMPAIGN_BOSSES, GAME_CHAPTERS } from './game-campaign.ts';
import { BRANCH_BOSSES } from './game-branches.ts';
import { GAME_CHARACTERS } from './game-characters.ts';
import { GAME_ACHIEVEMENTS, GAME_WEAPONS } from './game-rewards.ts';
import { battleTechnique } from './battle-techniques.ts';
import { bossAction as action, contentFighter as fighter, type GameBoss, type GameChapter } from './game-content-model.ts';
export type { GameBoss, GameChapter } from './game-content-model.ts';
export { GAME_CHAPTERS } from './game-campaign.ts';

export const GAME_CONTENT_VERSION = 'than-lo-2';
export const SUPPORTED_CONTENT_VERSIONS = ['than-lo-1', 'than-lo-2'] as const;
export const supportsContentVersion = (version: string): boolean => SUPPORTED_CONTENT_VERSIONS.some(value => value === version);
export const GAME_BOSSES: GameBoss[] = [
    { id: 'truy-lenh', name: 'Người Truy Lệnh', chapter: 1, requires: [], recommendedRank: 0, maxTurns: 4,
        fighter: fighter(95, 12), revival: { remaining: 0, hpPercent: 350 },
        pattern: [action('Ép đường', 'Một đòn thẳng. Giữ nhịp đánh để mở lối qua cầu.', [1000]),
            action('Nắm áo', 'Đối thủ chậm tay, chỉ gây nửa lực.', [500])],
        introduction: 'Tịch Vân kéo cậu về phía cầu gỗ. Sau lưng, người giữ Hắc Lệnh chặn đường ra khỏi thôn. “Đừng đánh để thắng họ. Đánh để chúng ta có đường đi.”',
        victory: 'Hắc Lệnh rơi xuống ván cầu. Tịch Vân nhặt mảnh giấy có tên người thân cậu: họ vẫn còn sống, đang bị đưa đến cửa núi.',
        defeat: 'Đường cầu bị phong tỏa. Tịch Vân giữ lại bản đồ đường núi; cậu có thể trở lại sau khi chuẩn bị.',
        mechanics: 'Một trận ngắn để làm quen: đánh trước, đối thủ còn sống mới phản công.',
        advice: ['Võ Kỹ đủ để mở đầu, chưa cần luyện công pháp.', 'Đủ một habit giúp đòn hôm đó mạnh hơn; không cần tạo thêm habit để chơi.'],
        unlocks: ['lien-van', 'huyen-quy', 'huyet-sat', 'hu-khong', 'lac-tu'], artId: 'truy-lenh' },
    { id: 'song-nha', name: 'Song Nha Canh Lộ', chapter: 1, requires: ['truy-lenh'], recommendedRank: 0, maxTurns: 5,
        fighter: fighter(130, 9, 1), revival: { remaining: 0, hpPercent: 350 },
        pattern: [action('Hai vết cắn', 'Hai hit nhỏ liên tiếp. Khiên chặn được cả hai nếu còn đủ.', [1000, 1000]),
            action('Vồ hụt', 'Một hit nhẹ khi đối thủ đổi vị trí.', [700])],
        introduction: 'Dấu chân xe tù dừng ở một trạm bỏ hoang. Hai canh thú giữ cửa, còn trong bóng tối có người đang cố giấu tiếng ho.',
        victory: 'Người đưa thư thoát khỏi trạm trao cho cậu một bí tịch bị xé. Năm ký hiệu trên bìa chỉ về năm phái cùng từng chống Tuyển Tiên Lệnh.',
        defeat: 'Canh thú đẩy cậu ra khỏi trạm. Người đưa thư vẫn đang ẩn trong tầng hầm; chuẩn bị rồi quay lại.',
        mechanics: 'Nhiều hit kiểm tra từng lớp khiên; né một hit không né cả chuỗi.',
        advice: ['Liên Vân dùng nhiều hit để giữ áp lực.', 'Huyền Quy hoặc Thái Hư Bộ giúp giảm tổn thất trong lúc chuẩn bị.'],
        unlocks: ['tuyet-menh', 'phan-chan', 'minh-ha', 'khong-minh', 'dan-kiep'], artId: 'song-nha' },
    { id: 'thu-lenh', name: 'Thư Lệnh Không Mặt', chapter: 1, requires: ['song-nha'], recommendedRank: 0, maxTurns: 6,
        fighter: fighter(175, 12), revival: { remaining: 0, hpPercent: 350 },
        pattern: [action('Mực khóa', 'Một hit; thư lệnh chưa kịp hồi phục.', [800]),
            action('Tái ấn', 'Đòn nhẹ, sau đó hồi 10 HP nếu thư lệnh còn sống.', [500], true, 10),
            action('Triệu hồi', 'Một đòn mạnh đã báo; giữ thế thủ hoặc kết thúc trước phản công.', [1700], true)],
        introduction: 'Lá lệnh ở tầng hầm tự mở. Mỗi tên người bị bắt được nối bằng một nét mực đen. Tịch Vân nhận ra nét viết của người từng dạy mình.',
        victory: 'Mực đen tan khỏi tên người thân cậu, nhưng lá lệnh vẫn còn hàng trăm tên khác. Cậu không thể chỉ cứu một người rồi bỏ đi.',
        defeat: 'Lá lệnh gấp lại trước khi nét cuối bị phá. Cậu đã biết nhịp tái ấn; lần tới có thể chọn đòn theo đúng thời điểm.',
        mechanics: 'Hồi phục sau phản công; người chơi hạ đối thủ trước thì không có hồi phục.',
        advice: ['Luyện được tầng đầu đã có thể mang công pháp vào trận.', 'Đặt Lạc Tử rồi dùng Thất Tinh vào ngày kế tiếp để chuyển thế cờ thành đòn công.'],
        unlocks: ['vo-hoi', 'tran-son', 'tan-menh', 'hoan-hinh', 'that-tinh'], artId: 'thu-lenh' },
    { id: 'thiet-lenh-su', name: 'Thiết Lệnh Sứ', chapter: 1, requires: ['thu-lenh'], recommendedRank: 1, maxTurns: 7,
        fighter: fighter(240, 16, 4), revival: { remaining: 0, hpPercent: 350 },
        pattern: [action('Thiết lệnh', 'Một hit vừa; giáp chưa tăng.', [1000]),
            action('Khóa cầu', 'Hai hit liên tiếp; sau đó giáp tăng 2, có trần.', [800, 800], true, 0, 2),
            action('Trảm lệnh', 'Một hit lớn đã báo. Có thể thủ hoặc dồn đòn kết liễu.', [1900], true),
            action('Thuấn nghỉ', 'Thiết Lệnh Sứ rút tay, gây một hit nhẹ.', [500])],
        introduction: 'Người mặc áo sắt đã đợi bên cửa núi. Ông ta nói mình chỉ nhận lệnh, rồi nhường cho đoàn tù một khoảng đường tránh mũi kiếm. Hắc Lệnh không khiến mọi người giống nhau.',
        victory: 'Thiết Lệnh Sứ hạ tay: “Ta đã chậm một chuyến xe. Đừng buộc ta chậm chuyến thứ hai.” Cửa núi mở. Tịch Vân giữ lại chiếc thẻ sắt như lời hẹn chưa được nói ra.',
        defeat: 'Chiếc thẻ sắt ghim bên lối xuống núi. Người giữ lệnh để cậu rời đi; cuộc cứu người vẫn chưa kết thúc.',
        mechanics: 'Nhịp đánh mạnh xen ngày nghỉ; giáp tăng có giới hạn, xuyên giáp giữ được giá trị.',
        advice: ['Chuẩn bị một đòn công và một lựa chọn phòng thủ cho ngày Trảm Lệnh.', 'Cảnh giới gợi ý là Luyện Khí; một habit đều và công pháp đã luyện cũng tạo được đường thắng.'],
        unlocks: [], artId: 'thiet-lenh-su' },
    { id: 'kiem-truyen', name: 'Người Giữ Kiếm Trầm', chapter: 1, kind: 'heritage', requires: ['thiet-lenh-su'], recommendedRank: 2, maxTurns: 7,
        practicePrerequisites: ['kiem-y', 'lien-van', 'tuyet-menh', 'vo-hoi'],
        fighter: fighter(390, 24, 8), revival: { remaining: 0, hpPercent: 350 },
        pattern: [action('Giữ đường kiếm', 'Một hit vừa. Lớp giáp mỏng giữ lại đòn thiếu chuẩn bị.', [1000]),
            action('Ba nhịp trầm', 'Ba hit nhỏ. Khiên bền hoặc giảm thương giúp giữ sức.', [500, 500, 500], true),
            action('Mở sơ hở', 'Người giữ kiếm hạ tay để cậu tìm đường kết liễu.', [300]),
            action('Kiếm vực cũ', 'Một hit lớn đã báo; chuẩn bị trước hoặc đổi nhịp công thủ.', [1800], true)],
        introduction: 'Bên cửa núi, một người giữ thanh kiếm gỗ không tên: “Bốn đường kiếm đã học giúp cậu đi xa. Muốn giữ cả một kiếm vực, hãy cho ta thấy cậu biết lúc nào cần dừng.”',
        victory: 'Người giữ kiếm đặt bốn vết khắc vào thẻ sắt. Cậu được quyền học Kiếm Vực Khai Thiên; sức mạnh chưa tự đến, còn phải luyện từng tầng.',
        defeat: 'Thanh kiếm gỗ dừng trước ngực cậu. Bốn đường khắc vẫn còn: bài học thuộc về việc chọn đúng nhịp, không phải bỏ những gì đã học.',
        mechanics: 'Truyền thừa Thiên Kiếm: cần bốn môn thường đạt Nhập môn; đọc nhịp mạnh/nghỉ để thắng trong bảy lượt.',
        advice: ['Giữ đòn mạnh cho nhịp Mở sơ hở; Kiếm Ý và Liên Vân vẫn có giá trị khác nhau trước giáp.', 'Thắng chỉ mở quyền học trấn phái; không tự tặng một bản Viên mãn.'],
        unlocks: ['kiem-vuc'], artId: 'kiem-truyen' },
    ...CAMPAIGN_BOSSES, ...BRANCH_BOSSES,
];

export function bossById(id: string): GameBoss {
    const boss = GAME_BOSSES.find(value => value.id === id);
    if (!boss) throw Error('INVALID_GAME_BOSS');
    return boss;
}
export function publicGameCatalog() {
    return { schools: SCHOOLS, techniques: TECHNIQUES.map(technique => ({ ...technique,
        sources: GAME_BOSSES.filter(boss => boss.unlocks.includes(technique.id)).map(boss => boss.id),
        availableInitially: INITIAL_TECHNIQUES.includes(technique.id), combatWarning: battleTechnique(technique.id).warning })),
        weapons: GAME_WEAPONS, achievements: GAME_ACHIEVEMENTS, contentVersion: GAME_CONTENT_VERSION,
        chapters: GAME_CHAPTERS.map(({ number, name, scene, encounters }) => ({ number, name, scene, encounters })),
        bosses: GAME_BOSSES.map(({ id, name, chapter, kind, requires, practicePrerequisites, recommendedRank, maxTurns, mechanics, artId, artPosition }) =>
            ({ id, name, chapter, kind: kind ?? 'main', requires, practicePrerequisites, recommendedRank, maxTurns, mechanics, artId, artPosition })) };
}
export function bossIntents(boss: GameBoss): BossIntent[] {
    return Array.from({ length: boss.maxTurns }, (_, turn) => {
        const action = boss.pattern[turn % boss.pattern.length]!;
        return { id: boss.id + '-' + turn, name: action.name, description: action.description,
            hits: action.factors.map(factor => Math.floor(boss.fighter.attack * factor / 1000)),
            special: action.special, heal: action.heal, armorBuff: action.armorBuff };
    });
}
export function validateGameContent(bosses = GAME_BOSSES, chapters: GameChapter[] = GAME_CHAPTERS): void {
    const ids = new Set(bosses.map(boss => boss.id)), byId = new Map(bosses.map(boss => [boss.id, boss]));
    if (ids.size !== bosses.length) throw Error('INVALID_GAME_CONTENT');
    const visiting = new Set<string>(), visited = new Set<string>();
    function walk(id: string) {
        if (visiting.has(id)) throw Error('CIRCULAR_GAME_CONTENT');
        if (visited.has(id)) return;
        const boss = byId.get(id);
        if (!boss) throw Error('INVALID_GAME_CONTENT');
        visiting.add(id); boss.requires.forEach(walk); visiting.delete(id); visited.add(id);
    }
    for (const boss of bosses) {
        if (boss.artPosition && (boss.artPosition.length !== 2 || boss.artPosition.some(value => !Number.isFinite(value) || value < 0 || value > 1))) throw Error('INVALID_GAME_CONTENT');
        if (!/^[a-z0-9-]{1,80}$/.test(boss.id) || !Number.isInteger(boss.chapter) || boss.chapter < 1 || boss.chapter > 15 ||
            !Number.isInteger(boss.recommendedRank) || boss.recommendedRank < 0 || boss.recommendedRank >= REALMS.length ||
            !Number.isInteger(boss.revival.remaining) || boss.revival.remaining < 0 || boss.revival.remaining > 3 ||
            !Number.isInteger(boss.revival.hpPercent) || boss.revival.hpPercent < 1 || boss.revival.hpPercent > 1000 ||
            ![boss.fighter.hp, boss.fighter.maxHp, boss.fighter.attack, boss.fighter.armor].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000) ||
            boss.fighter.hp !== boss.fighter.maxHp || boss.fighter.maxHp < 1 || boss.fighter.attack < 1 ||
            !Number.isInteger(boss.maxTurns) || boss.maxTurns < 1 || boss.maxTurns > 17 || !boss.pattern.length || boss.pattern.length > 17 ||
            boss.requires.some(id => !ids.has(id)) || [...boss.unlocks, ...(boss.practicePrerequisites ?? [])].some(id => !TECHNIQUES.some(technique => technique.id === id)) ||
            new Set(boss.unlocks).size !== boss.unlocks.length || new Set(boss.requires).size !== boss.requires.length ||
            new Set(boss.practicePrerequisites ?? []).size !== (boss.practicePrerequisites ?? []).length ||
            (boss.rewards?.weapons ?? []).some(id => !GAME_WEAPONS.some(value => value.id === id)) ||
            (boss.rewards?.achievements ?? []).some(id => !GAME_ACHIEVEMENTS.some(value => value.id === id)) ||
            [boss.name, boss.introduction, boss.victory, boss.defeat, boss.mechanics, ...boss.advice].some(value => !value || value.length > 2500))
            throw Error('INVALID_GAME_CONTENT');
        for (const action of boss.pattern) if (action.factors.length < 1 || action.factors.length > 5 ||
            !action.name || !action.description || action.name.length > 100 || action.description.length > 500 || typeof action.special !== 'boolean' ||
            ![...action.factors, action.heal, action.armorBuff].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 5000))
            throw Error('INVALID_GAME_CONTENT');
        walk(boss.id);
    }
    if (chapters.length !== 15 || new Set(chapters.map(value => value.number)).size !== 15) throw Error('INVALID_GAME_CHAPTERS');
    const main = new Set(bosses.filter(boss => !boss.kind || boss.kind === 'main').map(boss => boss.id)), declared = new Set<string>();
    for (const chapter of chapters) {
        if (!Number.isInteger(chapter.number) || chapter.number < 1 || chapter.number > 15 || !chapter.name || !chapter.introduction || !chapter.conclusion ||
            chapter.characters.some(id => !GAME_CHARACTERS.some(character => character.id === id)) ||
            !chapter.encounters.length || chapter.encounters.some(id => !main.has(id) || declared.has(id) || byId.get(id)!.chapter !== chapter.number)) throw Error('INVALID_GAME_CHAPTERS');
        chapter.encounters.forEach(id => declared.add(id));
    }
    if (declared.size !== main.size) throw Error('INVALID_GAME_CHAPTERS');
    // Structural traversal assumes an unlocked technique can eventually be
    // trained. Combat difficulty and actual DB progression need separate proof.
    const reached = new Set<string>(), learnable = new Set(INITIAL_TECHNIQUES);
    for (let pass = 0; pass < bosses.length; pass++) for (const boss of bosses) if (!reached.has(boss.id) &&
        boss.requires.every(id => reached.has(id)) && (boss.practicePrerequisites ?? []).every(id => learnable.has(id))) {
        reached.add(boss.id); boss.unlocks.forEach(id => learnable.add(id));
    }
    if (reached.size !== bosses.length || TECHNIQUES.some(technique => !learnable.has(technique.id))) throw Error('UNREACHABLE_GAME_CONTENT');
}
