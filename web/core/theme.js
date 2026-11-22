export function themePreference() {
  try {
    const value = localStorage.getItem('minh-anh-theme');
    return ['light', 'dark'].includes(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}
export function applyTheme(preference = themePreference()) {
  const automatic =
    globalThis.Telegram?.WebApp?.colorScheme ??
    (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = preference === 'auto' ? automatic : preference;
  const app = globalThis.Telegram?.WebApp;
  if (!app?.initData) return;
  const styles = getComputedStyle(document.documentElement);
  for (const [method, property, token, version] of [
    ['setBackgroundColor', 'backgroundColor', '--bg', '6.1'],
    ['setBottomBarColor', 'bottomBarColor', '--surface', '7.10'],
  ]) {
    const color = styles
      .getPropertyValue(token)
      .trim()
      .replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3');
    if (
      typeof app[method] !== 'function' ||
      !/^#[0-9a-f]{6}$/i.test(color) ||
      (app.isVersionAtLeast && !app.isVersionAtLeast(version)) ||
      app[property] === color
    )
      continue;
    // Native chrome is optional; an older Telegram bridge must not block the app.
    try {
      app[method](color);
    } catch {}
  }
}
export function setThemePreference(value) {
  if (!['auto', 'light', 'dark'].includes(value)) return;
  try {
    localStorage.setItem('minh-anh-theme', value);
  } catch {}
  applyTheme(value);
}
