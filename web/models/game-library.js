export function gameSearchText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();
}
export function matchingTechniques(catalog, owned, filter, query) {
    const search = gameSearchText(query), rights = new Set(owned);
    return catalog.techniques.filter(technique => (filter === 'owned' ? rights.has(technique.id)
        : filter === 'forbidden' || filter === 'outside' ? technique.kind === filter : !filter || technique.school === filter)
        && (!search || gameSearchText(technique.name + ' ' + technique.description).includes(search)));
}

// Discovery is derived from earned progress. A player's existing entitlement
// always wins, including accounts that predate discovery presentation.
export function bossDiscovered(boss, data) {
    if (boss.discovery === 'sealed') return false;
    if (boss.discovery === 'discovered' || boss.discovery === 'unlocked') return true;
    if ((data.victories ?? []).includes(boss.id) || (data.battles ?? []).some(battle => battle.bossId === boss.id)) return true;
    return (boss.requires ?? []).every(id => (data.victories ?? []).includes(id));
}
export function techniqueDiscovered(technique, data, catalog) {
    if (technique.discovery === 'sealed') return false;
    if (technique.discovery === 'discovered' || technique.discovery === 'unlocked') return true;
    if ((data.owned ?? []).includes(technique.id) || !['forbidden', 'outside'].includes(technique.kind)) return true;
    return (technique.sources ?? []).some(id => {
        const boss = catalog.bosses.find(value => value.id === id);
        return boss && bossDiscovered(boss, data);
    });
}
export function mainFloors(catalog) {
    const bosses = new Map(catalog.bosses.map(boss => [boss.id, boss]));
    const ordered = (catalog.chapters ?? []).flatMap(chapter => chapter.encounters ?? []).map(id => bosses.get(id)).filter(Boolean);
    return ordered.length ? ordered : catalog.bosses.filter(boss => !boss.kind || boss.kind === 'main');
}
export function currentBattle(data) {
    const battles = (data.battles ?? []).filter(battle => ['prepared', 'active', 'awaiting_rescue'].includes(battle.status));
    return battles.find(battle => battle.id === data.current?.battleId || battle.id === data.pending?.battleId)
        ?? battles[0];
}

export function latestBattleResult(data) {
    return (data.battles ?? []).find(battle => ['won', 'dead', 'expired', 'withdrawn'].includes(battle.status)
        && Number.isInteger(battle.finishedDay) && battle.finishedDay >= data.day.day - 1) ?? null;
}
