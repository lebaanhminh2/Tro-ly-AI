import { experiencePreferences, setExperiencePreferences } from '../core/experience.js';
import { button, el } from '../ui/dom.js';

export function createGameGuideActions({ state, sheet, sheetContent, openSheet, render, loadHabits, loadGame }) {
    function dismissGameGuide() { setExperiencePreferences({ gameGuideDismissed: true }); render(); }
    function openGameGuide() {
        openSheet('Bắt đầu Thần Lộ'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body game-guide');
        body.append(el('p', 'Tịch Vân giữ đường tới thư các. Cậu chọn cam kết vừa sức, luyện môn mình thích rồi tự quyết khi nào xuất chiến.', 'technique-description'));
        const steps = el('ol', undefined, 'game-guide-steps');
        for (const [title, description] of [
            ['Một thói quen vừa sức', 'Tick hoặc nhập số lượng đã làm. Chỉ khi đủ mục tiêu mới có đóng góp. Ngày sinh hoạt bắt đầu lúc ' + state.start + '; ngày đã qua chỉ xem.'],
            ['Luyện một môn', 'Chọn ở Công pháp. Đổi môn hoặc chế độ bắt đầu từ ngày sinh hoạt kế tiếp. Tiến độ và tinh thuần là hai phần riêng; muốn sửa phẩm chất phải luyện một bản mới.'],
            ['Chuẩn bị rồi xuất chiến', 'Võ Kỹ dùng được ngay để thử. Mỗi ngày giao chiến chọn một lần; đọc đòn sắp tới và chọn công hoặc thủ. Một bản Nhập môn đã có thể dùng, không cần luyện đủ mọi môn.'],
        ]) { const step = el('li'); step.append(el('h3', title), el('p', description, 'hint')); steps.append(step); }
        body.append(steps, el('p', 'Habit vẫn dùng độc lập. Các cam kết tuần đã dùng để luyện vẫn được chốt khi đến hạn, kể cả sau khi đổi môn hoặc dừng luyện.', 'hint'));
        const links = el('div', undefined, 'game-guide-links');
        links.append(button('Đến Thói quen', () => { sheet.close(); state.tab = 'habits'; state.habitPanel = 'today'; render(); loadHabits(); }, 'primary'));
        if (experiencePreferences().gameVisible) links.append(button('Đến Công pháp', () => {
            sheet.close(); state.tab = 'game'; state.gamePanel = 'library'; state.gameSchool = 'owned'; render(); loadGame();
        }, 'secondary'));
        body.append(links); sheetContent.append(body);
    }
    return { openGameGuide, dismissGameGuide };
}
