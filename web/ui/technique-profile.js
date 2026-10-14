import { el } from './dom.js';
import { purityLabel } from '../models/practice.js';

const number = value => Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const amount = (value, unit) => value === null ? 'Chưa mở' : number(value) + (unit ? ' ' + unit : '');

export function renderTechniqueDamage(profile, reference = false) {
    const root = el('div', undefined, 'cultivation-damage');
    if (!profile) { root.append(el('p', 'Đang luyện tới tầng 1', 'hint')); return root; }
    root.append(el('strong', number(profile.damage)), el('span', reference ? 'Sát thương tham chiếu' : 'Sát thương'));
    return root;
}

export function renderPracticePurity(training) {
    const root = el('section', undefined, 'cultivation-purity');
    if (!training) { root.hidden = true; return root; }
    const earned = training.totalPurityBp, maximum = Math.max(earned, training.maximumPurityBp);
    const label = el('div', undefined, 'cultivation-purity-label');
    label.append(el('span', 'Độ thuần khiết'), el('strong', purityLabel(earned)));
    if (training.grade) label.append(el('span', training.grade.name, 'cultivation-grade'));
    const meter = el('div', undefined, 'cultivation-purity-meter');
    meter.setAttribute('role', 'img');
    const lost = training.permanentLossBp ?? (training.provisional ? 0 : 10000 - maximum);
    meter.setAttribute('aria-label', 'Đã đạt ' + purityLabel(earned) + '; trần ' + (training.provisional ? 'tạm tính ' : '') + purityLabel(maximum) +
        '; đã mất ít nhất ' + purityLabel(lost) + '; ngoài trần dự kiến ' + purityLabel(10000 - maximum));
    for (const [kind, width] of [['earned', earned], ['possible', maximum - earned], ['lost', 10000 - maximum]]) {
        const segment = el('span', undefined, 'is-' + kind); segment.style.width = (width / 100) + '%'; meter.append(segment);
    }
    root.append(label, meter, el('p', (training.provisional ? 'Trần tạm tính ' : 'Có thể đạt ') + purityLabel(maximum) +
        (lost ? ' · Đã mất ' + (training.provisional ? 'ít nhất ' : '') + purityLabel(lost) : ''), 'cultivation-purity-caption'));
    if (training.awaitingAudit) root.append(el('p', 'Sát thương và thuần khiết đang chờ chốt cam kết tuần.', 'practice-wait-note'));
    return root;
}

function effectLine(effect) {
    const row = el('div', undefined, 'technique-stat-row'), title = el('div');
    title.append(el('span', effect.label));
    const information = [effect.timing, effect.condition, effect.limit].filter(Boolean).join(' · ');
    if (information) title.append(el('small', information));
    row.append(title, el('span', effect.amount === null ? effect.unit : amount(effect.amount, effect.unit), 'technique-stat-value'));
    return row;
}

export function renderTechniqueEffects(profile, contextLabel = null) {
    const root = el('div', undefined, 'technique-effects');
    if (!profile) return root;
    const strikes = el('details', undefined, 'technique-stat-group');
    strikes.append(el('summary', 'Đòn đánh'), el('p', 'Mỗi đòn ' + number(profile.perHit) + ' · Số đòn ' + profile.hits, 'hint'),
        el('p', 'Sát thương thô của đòn chính, trước phòng ngự. Chảy máu, đòn trễ và đòn thêm có điều kiện tính riêng.', 'hint'));
    root.append(strikes);
    for (const group of ['Đặc tính', 'Hiệu ứng', 'Nội tại', 'Cái giá']) {
        const values = profile.effects.filter(effect => effect.group === group);
        if (!values.length) continue;
        const block = el('section', undefined, 'technique-stat-group');
        block.append(el('h3', group)); values.forEach(effect => block.append(effectLine(effect))); root.append(block);
    }
    if (profile.warning) root.append(el('p', profile.warning, 'battle-warning'));
    const context = el('details', undefined, 'technique-context');
    context.append(el('summary', 'Ngữ cảnh thông số'), el('p', contextLabel ?? ('Công ' + number(profile.attack) + ', không buff ngày. Trong trận dùng chỉ số đã chốt và phòng ngự của boss.'), 'hint'));
    root.append(context); return root;
}

export function renderTechniqueUpgrade(upgrade) {
    const root = el('section', undefined, 'technique-upgrade');
    if (upgrade.legacy) root.append(el('p', upgrade.explanation, 'hint'));
    else if (upgrade.nextTier) {
        root.append(el('h3', 'Lên tầng ' + upgrade.nextTier), el('p', 'Còn ' + upgrade.remainingDays + ' ngày luyện. Sát thương tăng thêm theo habit; đặc tính và mốc mở tăng đủ theo tầng.', 'hint'));
        const table = el('div', undefined, 'technique-upgrade-table'), header = el('div', undefined, 'technique-upgrade-row is-header');
        header.append(el('span', 'Thuộc tính'), el('span', 'Hiện tại'), el('span', 'Tối đa dự kiến')); table.append(header);
        for (const row of upgrade.rows) {
            const item = el('div', undefined, 'technique-upgrade-row'), label = el('div'); label.append(el('span', row.label));
            label.append(el('small', row.group === 'Cái giá' ? 'Cái giá' : row.kind === 'habit' ? 'Theo habit' : row.kind === 'unlock' ? 'Mở theo tầng' : 'Tăng đủ theo tầng'));
            const primary = row.previous && row.changes?.length && !row.changes.includes('amount') ? row.changes[0] : 'amount';
            const prior = primary === 'amount' ? amount(row.current, row.previous?.unit ?? row.unit) : row.previous?.[primary] ?? 'Không có';
            const next = primary === 'amount' ? row.next === null ? row.unit || 'Mở' : amount(row.next, row.unit) : row[primary] ?? 'Không có';
            item.append(label, el('span', prior), el('span', next));
            if (primary === 'amount' && row.current !== null && row.next !== null && row.next !== row.current) {
                const delta = row.next - row.current, note = el('small', (delta > 0 ? '+' : '') + number(delta) + ' ' + (row.unit === '%' ? 'điểm %' : row.unit));
                item.lastChild.append(note);
            }
            const names = { timing: 'Thời điểm / thời hạn', condition: 'Điều kiện', limit: 'Giới hạn', unit: 'Đơn vị' };
            const descriptions = row.kind === 'unlock' ? [row.timing, row.condition, row.limit].filter(Boolean) :
                (row.changes ?? []).filter(key => key !== primary && key !== 'amount').map(key => names[key] + ': ' +
                    (row.previous?.[key] ?? 'Không có') + ' → ' + (row[key] ?? 'Không có'));
            if (primary !== 'amount') label.append(el('small', names[primary]));
            if (descriptions.length) { const explanation = el('p', descriptions.join(' · '), 'hint'); explanation.classList.add('technique-upgrade-explanation'); item.append(explanation); }
            table.append(item);
        }
        root.append(table, el('p', 'Dự kiến theo cam kết hiện tại, chưa phải sức mạnh đã nhận. Phần chờ tuần được chốt sau.', 'hint'));
    } else root.append(el('h3', upgrade.current?.totalPurityBp === 10000 ? 'Thông Thần' : 'Hoàn tất 4 tầng'),
        el('p', upgrade.awaitingSettlement ? 'Đã hoàn tất thời gian luyện. Phần sát thương và độ thuần còn chờ chốt cam kết tuần.' :
            upgrade.current?.totalPurityBp === 10000 ? 'Đã đạt 100% thuần khiết. Thưởng Thông Thần đã tính vào sát thương.' :
            'Bản này đã đạt giới hạn. Luyện lại từ tầng 1 để cải thiện phần thuần khiết đã mất.', 'hint'));
    const roadmap = el('details', undefined, 'technique-roadmap'); roadmap.append(el('summary', 'Xem lộ trình 4 tầng'));
    roadmap.append(el('p', 'Tham chiếu một bản mới đạt đủ habit ở cả bốn kỳ; phần đã bỏ lỡ của bản hiện tại không được bù.', 'hint'));
    for (const step of upgrade.referenceRoadmap) {
        const block = el('section', undefined, 'technique-roadmap-step');
        block.append(el('h4', 'Tầng ' + step.tier + ' · ' + step.requiredDays + ' ngày luyện'),
            el('p', 'Sát thương ' + number(step.profile.damage) + ' · tổng ' + step.totalDays + ' ngày luyện', 'hint'));
        for (const change of step.changes ?? []) {
            const primary = change.previous && !change.changes.includes('amount') ? change.changes[0] : 'amount';
            const before = primary === 'amount' ? amount(change.current, change.previous?.unit ?? change.unit) : change.previous?.[primary] ?? 'Không có';
            const after = primary === 'amount' ? change.next === null ? change.unit || 'Mở' : amount(change.next, change.unit) : change[primary] ?? 'Không có';
            const row = el('div', undefined, 'technique-stat-row'), copy = el('div');
            copy.append(el('span', change.label));
            if (change.kind === 'unlock') copy.append(el('small', [change.timing, change.condition, change.limit].filter(Boolean).join(' · ')));
            row.append(copy, el('span', change.kind === 'unlock' ? after : before + ' → ' + after, 'technique-stat-value')); block.append(row);
        }
        roadmap.append(block);
    }
    root.append(roadmap); return root;
}
