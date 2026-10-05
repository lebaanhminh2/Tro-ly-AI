export function themePreference() {
    try {
        const value = localStorage.getItem('minh-anh-theme');
        return ['light', 'dark'].includes(value) ? value : 'auto';
    }
    catch {
        return 'auto';
    }
}
export function applyTheme(preference = themePreference()) {
    const automatic = globalThis.Telegram?.WebApp?.colorScheme ?? (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = preference === 'auto' ? automatic : preference;
}
export function setThemePreference(value) {
    if (!['auto', 'light', 'dark'].includes(value))
        return;
    try {
        localStorage.setItem('minh-anh-theme', value);
    }
    catch {
    }
    applyTheme(value);
}
