import type { BattleFighter, BossIntent } from './battle.ts';
import { TECHNIQUES } from './techniques.ts';

export const GAME_CONTENT_VERSION = 'than-lo-1';
export type GameBoss = { id: string; name: string; chapter: number; requires: string[]; recommendedRank: number;
    kind?: 'main' | 'heritage'; practicePrerequisites?: string[];
    maxTurns: number; fighter: BattleFighter; revival: { remaining: number; hpPercent: number };
    pattern: { name: string; description: string; factors: number[]; heal: number; armorBuff: number; special: boolean }[];
    introduction: string; victory: string; defeat: string; mechanics: string; advice: string[];
    unlocks: string[]; artId: string | null };
const fighter = (hp: number, attack: number, armor = 0): BattleFighter => ({ hp, maxHp: hp, attack, armor });
const action = (name: string, description: string, factors: number[], special = false, heal = 0, armorBuff = 0) => ({
    name, description, factors, special, heal, armorBuff,
});
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
];

export function bossById(id: string): GameBoss {
    const boss = GAME_BOSSES.find(value => value.id === id);
    if (!boss) throw Error('INVALID_GAME_BOSS');
    return boss;
}
export function bossIntents(boss: GameBoss): BossIntent[] {
    return Array.from({ length: boss.maxTurns }, (_, turn) => {
        const action = boss.pattern[turn % boss.pattern.length]!;
        return { id: boss.id + '-' + turn, name: action.name, description: action.description,
            hits: action.factors.map(factor => Math.floor(boss.fighter.attack * factor / 1000)),
            special: action.special, heal: action.heal, armorBuff: action.armorBuff };
    });
}
export function validateGameContent(): void {
    const ids = new Set(GAME_BOSSES.map(boss => boss.id));
    if (ids.size !== GAME_BOSSES.length) throw Error('INVALID_GAME_CONTENT');
    const visiting = new Set<string>(), visited = new Set<string>();
    function walk(id: string) {
        if (visiting.has(id)) throw Error('CIRCULAR_GAME_CONTENT');
        if (visited.has(id)) return;
        visiting.add(id); bossById(id).requires.forEach(walk); visiting.delete(id); visited.add(id);
    }
    for (const boss of GAME_BOSSES) {
        if (!/^[a-z0-9-]{1,80}$/.test(boss.id) || !Number.isInteger(boss.chapter) || boss.chapter < 1 || boss.chapter > 15 ||
            !Number.isInteger(boss.maxTurns) || boss.maxTurns < 1 || boss.maxTurns > 17 || !boss.pattern.length || boss.pattern.length > 17 ||
            boss.requires.some(id => !ids.has(id)) || [...boss.unlocks, ...(boss.practicePrerequisites ?? [])].some(id => !TECHNIQUES.some(technique => technique.id === id)) ||
            new Set(boss.unlocks).size !== boss.unlocks.length ||
            [boss.name, boss.introduction, boss.victory, boss.defeat, boss.mechanics, ...boss.advice].some(value => !value || value.length > 2500))
            throw Error('INVALID_GAME_CONTENT');
        for (const action of boss.pattern) if (action.factors.length < 1 || action.factors.length > 5 ||
            ![...action.factors, action.heal, action.armorBuff].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 5000))
            throw Error('INVALID_GAME_CONTENT');
        walk(boss.id);
    }
}
