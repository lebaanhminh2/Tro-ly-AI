export type SchoolId = 'thien-kiem' | 'bat-diet' | 'u-minh' | 'thai-hu' | 'thien-co';
export type TechniqueKind = 'ordinary' | 'heritage' | 'forbidden' | 'outside';
export type Technique = { id: string; name: string; school: SchoolId | null; kind: TechniqueKind;
    description: string; trainingFactor: number; identity: string };

export const SCHOOLS: { id: SchoolId; name: string; description: string }[] = [
    { id: 'thien-kiem', name: 'Thiên Kiếm', description: 'Đọc sơ hở, giữ kiếm ý rồi kết thúc bằng một đòn quyết định.' },
    { id: 'bat-diet', name: 'Bất Diệt', description: 'Chịu lực, tích Cương Kình và biến phòng thủ thành phản công.' },
    { id: 'u-minh', name: 'U Minh', description: 'Dùng sinh lực làm giá, đoạt lại từng nhịp sống từ đối thủ.' },
    { id: 'thai-hu', name: 'Thái Hư', description: 'Giữ một Hư Ảnh để thủ, hoặc tiêu nó đúng lúc để đổi thế trận.' },
    { id: 'thien-co', name: 'Thiên Cơ', description: 'Nhìn trước, đặt thế và thay nhịp của những đòn đã báo.' },
];
type Entry = [id: string, name: string, description: string, identity: string];
const schoolEntries: Record<SchoolId, Entry[]> = {
    'thien-kiem': [
        ['kiem-y', 'Kiếm Ý', 'Một đường kiếm gọn xuyên qua lớp giáp đối thủ.', 'pierce'],
        ['lien-van', 'Liên Vân Kiếm', 'Ba nhát liên tiếp tìm điểm yếu giữa những lớp phòng ngự.', 'multi_hit'],
        ['tuyet-menh', 'Tuyệt Mệnh Kiếm', 'Dồn kiếm lực vào đối thủ đã suy yếu để kết liễu.', 'execute'],
        ['vo-hoi', 'Vô Hồi Kiếm', 'Đổi thế thủ ngày này lấy một đòn công mạnh.', 'risk_burst'],
        ['kiem-vuc', 'Kiếm Vực Khai Thiên', 'Dựng kiếm vực rồi giải phóng lực đã chuẩn bị.', 'sword_domain'],
    ],
    'bat-diet': [
        ['kim-than', 'Bất Diệt Kim Thân', 'Bọc thân bằng kim lực, tích Cương Kình qua những đòn chịu được.', 'guard_stack'],
        ['huyen-quy', 'Huyền Quy Chân Kinh', 'Giữ một lớp khiên bền và chuyển nhịp về phòng thủ.', 'persistent_shield'],
        ['phan-chan', 'Phản Chấn Quyết', 'Trả lại một phần thương tổn đã thực sự chịu.', 'reflect'],
        ['tran-son', 'Trấn Sơn Quyền', 'Tiêu Cương Kình để phá thế đối thủ.', 'consume_guard'],
        ['chien-the', 'Bất Diệt Chiến Thể', 'Chuyển nền phòng ngự thành thế công trong vài lượt.', 'guard_conversion'],
    ],
    'u-minh': [
        ['thon-thien', 'Thôn Thiên Ma Công', 'Đánh và hút lại một phần sinh lực đã lấy được.', 'life_steal'],
        ['huyet-sat', 'Huyết Sát Quyết', 'Hiến một phần HP để đòn đánh mang huyết lực.', 'blood_cost'],
        ['minh-ha', 'Minh Hà Huyết Chú', 'Đặt huyết chú rút sinh lực qua nhiều ngày giao chiến.', 'bleed'],
        ['tan-menh', 'Tàn Mệnh Chỉ', 'Càng gần giới hạn sinh mạng, phản sát càng mạnh.', 'low_hp_burst'],
        ['huyet-hai', 'Huyết Hải Phần Thiên', 'Đổi một phần HP tối đa lấy thế huyết hải có giới hạn.', 'max_hp_trade'],
    ],
    'thai-hu': [
        ['thai-hu-bo', 'Thái Hư Bộ', 'Tạo một Hư Ảnh để làm lệch đòn kế tiếp.', 'illusion_guard'],
        ['hu-khong', 'Hư Không Tạng', 'Giữ Hư Ảnh và tạo khoảng hồi phục giữa giao chiến.', 'illusion_heal'],
        ['khong-minh', 'Không Minh Trảm', 'Tiêu Hư Ảnh để một nhát chém bỏ qua thế thủ.', 'illusion_strike'],
        ['hoan-hinh', 'Hoán Hình Thuật', 'Đổi Hư Ảnh lấy một lần né đã chuẩn bị.', 'illusion_dodge'],
        ['quy-hu', 'Vạn Pháp Quy Hư', 'Thu hồi một phần hiệu ứng đối thủ bằng thế hư không.', 'dispel'],
    ],
    'thien-co': [
        ['quan-thien', 'Quan Thiên Chỉ', 'Soi hai hành động kế tiếp để chuẩn bị đường đáp trả.', 'foresight'],
        ['lac-tu', 'Lạc Tử Ấn', 'Đặt một quân cờ nổ vào nhịp đã định.', 'delayed_mark'],
        ['dan-kiep', 'Dẫn Kiếp Chỉ', 'Dẫn một phần lực của ý định đã báo về phía đối thủ.', 'intent_conversion'],
        ['that-tinh', 'Thất Tinh Sát', 'Ghép những thế cờ đã đặt thành một đòn nhiều nhịp.', 'mark_combo'],
        ['nghich-thien', 'Nghịch Thiên Kỳ', 'Đổi thứ tự hai hành động hợp lệ, không xóa đại chiêu khỏi trận.', 'intent_swap'],
    ],
};
const forbidden: Entry[] = [
    ['nghich-menh', 'Nghịch Mệnh Hoán Sinh', 'Chuẩn bị cứu mạng bằng một đại cảnh giới, chung quyền cứu với Hộ Mệnh.', 'rank_rescue'],
    ['thau-thien', 'Thâu Thiên Hoán Mệnh', 'Cướp phần sinh lực có trần và tự mất HP tối đa.', 'bounded_hp_steal'],
    ['tang-nhat', 'Táng Nhật Nhất Kích', 'Dồn lực vào một đòn cực mạnh rồi tự tiến gần tử cảnh.', 'near_death_burst'],
    ['dong-menh', 'Đồng Mệnh Huyết Khế', 'Buộc đối thủ chia thương từ phần HP thật đã mất.', 'actual_hp_reflect'],
    ['cuu-u', 'Cửu U Đoạt Hồn', 'Tái hiện một dấu vết thần thông boss đã thi triển.', 'bounded_copy'],
    ['phong-than', 'Thiên Táng Phong Thần', 'Trả HP tối đa để niêm phong một tuyệt kỹ đã xác định.', 'seal'],
    ['tam-nhat', 'Tam Nhật Đoạn Mệnh', 'Gieo một Tử Ấn nổ sau ba ngày giao chiến.', 'death_mark'],
    ['nghich-luan', 'Nghịch Luân Chuyển Sinh', 'Đảo một lợi thế boss vừa nhận, giữ nguyên lịch sử và cái giá đã trả.', 'reverse_buff'],
];
// Release names are original; stable IDs preserve the draft's tactical roles.
const outside: Entry[] = [
    ['vo-mon', 'Vô Môn Dịch Kinh', 'Đổi một ô công pháp đã sở hữu cho ngày giao chiến sau.', 'loadout_exchange'],
    ['son-ha', 'Sơn Hà Hộ Kiếm', 'Tạo giáp ảo giảm 40% từng hit khi lớp giáp còn tồn tại.', 'virtual_armor'],
    ['huyet-trieu', 'Huyết Triều Khai Kiếm', 'Mở kiếm thức theo HP tối đa với huyết triều có trần.', 'bounded_max_hp'],
    ['kiep-dong', 'Chấn Kiếp Kiếm Thức', 'Chuyển hóa một phần lực của đòn boss đã báo.', 'announced_damage'],
    ['van-co', 'Vạn Cổ Kiếm Âm', 'Lưu kiếm âm để echo một lần, rồi hồi phục có thời hạn.', 'bounded_echo'],
    ['van-thien', 'Tứ Ấn Vấn Thiên', 'Giữ bốn ấn khác nhau trong trận rồi giải phóng một lần.', 'four_seals'],
];
const fromEntry = (entry: Entry, school: SchoolId | null, kind: TechniqueKind): Technique => ({
    id: entry[0], name: entry[1], school, kind, description: entry[2], identity: entry[3],
    trainingFactor: kind === 'outside' ? 2000 : kind === 'forbidden' ? 1500 : 1000,
});
export const TECHNIQUES: Technique[] = [
    ...SCHOOLS.flatMap(school => schoolEntries[school.id].map((entry, index) => fromEntry(entry, school.id, index === 4 ? 'heritage' : 'ordinary'))),
    ...forbidden.map(entry => fromEntry(entry, null, 'forbidden')),
    ...outside.map(entry => fromEntry(entry, null, 'outside')),
];
export const INITIAL_TECHNIQUES = SCHOOLS.map(school => schoolEntries[school.id][0]![0]);
export function techniqueById(id: string): Technique {
    const value = TECHNIQUES.find(technique => technique.id === id);
    if (!value) throw Error('INVALID_TECHNIQUE');
    return value;
}
