import { experiencePreferences, setExperiencePreferences } from '../core/experience.js';
import { button, el } from '../ui/dom.js';

export function createGameGuideActions({ state, sheet, sheetContent, openSheet, render, loadHabits, loadGame }) {
    function dismissGameGuide() { setExperiencePreferences({ gameGuideDismissed: true }); render(); }
    function openGameGuide() {
        openSheet('Bắt đầu Tu luyện'); sheet.classList.add('settings-sheet-open');
        const body = el('div', undefined, 'settings-sheet-body game-guide');
        body.append(el('p', 'Thói quen nuôi công pháp. Công pháp giúp cậu đánh boss. Mỗi chiến thắng mở thêm một phần thế giới để khám phá.', 'technique-description'));
        const steps = el('ol', undefined, 'game-guide-steps');
        for (const [title, description] of [
            ['Làm việc thật', 'Ghi nhận ở Thói quen. Đủ mục tiêu mới có đóng góp; ngày linh hoạt chưa thiếu cam kết không bị tính là bỏ lỡ. Ngày sinh hoạt bắt đầu lúc ' + state.start + '.'],
            ['Luyện môn mình thích', 'Mở Công pháp → chọn phái → chọn môn. Hết thời gian luyện thì mở tầng; habit quyết định phần sát thương nhận thêm. Độ thuần khiết giữ khuyết điểm của bản; xem Nâng cấp để cân nhắc môn cần luyện tiếp.'],
            ['Chọn thử thách', 'Võ Kỹ luôn có sẵn. Mang tối đa năm môn đã đạt tầng 1, mỗi môn một bản. Chuẩn bị hôm nay, xuất chiến ngày sinh hoạt kế tiếp. Xem chiêu và cái giá rồi xác nhận; lượt đánh chốt khi ngày kết thúc.'],
            ['Giữ lại chiến tích', 'Thành tựu ghi boss đã thắng và trận đã đánh. Chiến thắng có thể mở quyền học bí tịch; cậu vẫn cần tự luyện từ đầu. Cơ duyên và cấm thuật hé lộ theo tiến trình.'],
        ]) { const step = el('li'); step.append(el('h3', title), el('p', description, 'hint')); steps.append(step); }
        body.append(steps, el('p', 'Có thể chỉ dùng Thói quen, không cần chơi game. Trong game, xem chi tiết trước khi luyện lại, dùng cấm thuật hoặc cứu mạng. Cam kết tuần đã dùng để luyện vẫn chốt khi đến hạn, kể cả sau khi đổi môn hoặc dừng luyện.', 'hint'));
        const links = el('div', undefined, 'game-guide-links');
        links.append(button('Đến Thói quen', () => { sheet.close(); state.tab = 'habits'; state.habitPanel = 'today'; render(); loadHabits(); }, 'primary'));
        if (experiencePreferences().gameVisible) links.append(button('Đến Công pháp', () => {
            sheet.close(); state.tab = 'game'; state.gamePanel = 'library'; state.gameSchool = ''; render(); loadGame();
        }, 'secondary'));
        body.append(links); sheetContent.append(body);
    }
    return { openGameGuide, dismissGameGuide };
}
