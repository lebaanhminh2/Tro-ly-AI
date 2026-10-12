export function renderGameCollection(ui, data, catalog) {
    const { el, button, card } = ui, root = el('div', undefined, 'game-collection'), rewards = data.rewards ?? [];
    root.append(el('h2', 'Thần binh'), el('p', 'Mang một món khi chuẩn bị trận. Hiệu ứng và đánh đổi được giữ suốt trận đó.', 'hint'));
    for (const weapon of catalog.weapons ?? []) {
        const owned = rewards.some(reward => reward.kind === 'weapon' && reward.id === weapon.id), boss = catalog.bosses.find(boss => boss.id === weapon.sourceBossId);
        const row = card('technique-card');
        const heading = el('div', undefined, 'technique-heading'), copy = el('div'), image = el('img', undefined, 'game-relic-art');
        image.src = './assets/than-lo/weapon-' + weapon.id + '-thumb.webp'; image.width = 64; image.height = 64; image.alt = ''; image.loading = 'lazy';
        copy.append(el('small', owned ? 'Đã sở hữu' : 'Chưa mở', 'technique-school'), el('h3', weapon.name));
        heading.append(copy, image); row.append(heading, el('p', weapon.description, 'technique-description'));
        if (!owned && boss) row.append(button('Tìm ở chương ' + boss.chapter + ' · ' + boss.name, () => {
            ui.selectGameChapter(boss.chapter); ui.showGamePanel('journey');
        }, 'text-button'));
        root.append(row);
    }
    const count = rewards.filter(reward => reward.kind === 'achievement').length;
    root.append(el('h2', 'Chiến tích · ' + count + ' / ' + (catalog.achievements ?? []).length));
    for (const achievement of catalog.achievements ?? []) {
        const owned = rewards.some(reward => reward.kind === 'achievement' && reward.id === achievement.id), row = el('div', undefined, 'game-achievement'), copy = el('div');
        copy.append(el('h3', achievement.name), el('p', achievement.description, 'hint'));
        row.append(el('span', owned ? '✓' : '·', 'game-achievement-mark'), copy);
        row.setAttribute('aria-label', achievement.name + (owned ? ' · đã đạt' : ' · chưa đạt')); root.append(row);
    }
    const exportBox = el('section', undefined, 'game-export-controls');
    exportBox.append(el('h2', 'Lưu hành trình'), el('p', 'Xuất hồ sơ và nhật ký để giữ lại nhịp đã đi.', 'hint'), button('Xuất hành trình', () => ui.openGameExport(), 'secondary'));
    root.append(exportBox); return root;
}
