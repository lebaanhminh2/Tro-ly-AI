export function gameSearchText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();
}
export function matchingTechniques(catalog, owned, filter, query) {
    const search = gameSearchText(query), rights = new Set(owned);
    return catalog.techniques.filter(technique => (filter === 'owned' ? rights.has(technique.id)
        : filter === 'forbidden' || filter === 'outside' ? technique.kind === filter : !filter || technique.school === filter)
        && (!search || gameSearchText(technique.name + ' ' + technique.description).includes(search)));
}
