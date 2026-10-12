const storageKey = 'minh-anh-experience';

export function normalizeExperience(value) {
    return { gameVisible: value?.gameVisible !== false, motion: value?.motion === 'reduce' ? 'reduce' : 'system',
        gameGuideDismissed: value?.gameGuideDismissed === true };
}
function readExperience() {
    try { return normalizeExperience(JSON.parse(localStorage.getItem(storageKey))); }
    catch { return normalizeExperience(null); }
}
let current = readExperience();
export function experiencePreferences() { return { ...current }; }
export function prefersReducedMotion() {
    return current.motion === 'reduce' || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
export function applyExperiencePreferences() {
    document.documentElement.dataset.motion = current.motion;
}
export function setExperiencePreferences(change) {
    current = normalizeExperience({ ...current, ...change });
    try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Keep the choice for this session. */ }
    applyExperiencePreferences();
}
export function reloadExperiencePreferences() {
    current = readExperience(); applyExperiencePreferences();
}
export { storageKey as experienceStorageKey };
