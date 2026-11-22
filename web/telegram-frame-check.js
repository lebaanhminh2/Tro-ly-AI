// Keep this page independent of app modules, data APIs, and inline scripts (CSP).
const status = document.getElementById('status');
const details = document.getElementById('details');
const initialize = document.getElementById('initialize');
const color = document.getElementById('color');
const fullscreen = document.getElementById('fullscreen');
let app;
let stage = 'Trang trắng; chưa tải SDK Telegram';

function showDetails() {
  for (const edge of ['top', 'bottom'])
    document.documentElement.style.setProperty(
      '--host-safe-' + edge,
      Math.max(0, app?.safeAreaInset?.[edge] ?? 0, app?.contentSafeAreaInset?.[edge] ?? 0) + 'px',
    );
  status.textContent = stage;
  details.textContent = JSON.stringify(
    {
      checkVersion: 2,
      sdkLoaded: !!app,
      platform: app?.platform,
      botApiVersion: app?.version,
      telegramTheme: app?.colorScheme,
      fullscreen: app?.isFullscreen,
      windowHeight: innerHeight,
      viewportHeight: app?.viewportHeight,
      viewportStableHeight: app?.viewportStableHeight,
      safeAreaInset: app?.safeAreaInset,
      contentSafeAreaInset: app?.contentSafeAreaInset,
      userAgent: navigator.userAgent,
    },
    null,
    2,
  );
}

initialize.addEventListener('click', async () => {
  initialize.disabled = true;
  stage = 'Đang tải SDK Telegram…';
  showDetails();
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(Error('Không tải được SDK Telegram. Có thể bấm lại nút 1.'));
      };
      document.head.append(script);
    });
    app = globalThis.Telegram?.WebApp;
    if (!app?.initData) throw Error('Hãy mở trang này bằng nút kiểm tra trong Telegram.');
    for (const event of [
      'viewportChanged',
      'safeAreaChanged',
      'contentSafeAreaChanged',
      'themeChanged',
      'fullscreenChanged',
    ])
      app.onEvent(event, () => {
        fullscreen.textContent = app.isFullscreen
          ? '3. Thoát toàn màn hình'
          : '3. Thử toàn màn hình';
        showDetails();
      });
    app.onEvent('fullscreenFailed', (event) => {
      stage = 'Telegram không mở toàn màn hình: ' + (event?.error ?? 'không rõ lý do');
      showDetails();
    });
    app.expand();
    app.ready();
    color.disabled = false;
    fullscreen.disabled =
      typeof app.requestFullscreen !== 'function' || !app.isVersionAtLeast('8.0');
    stage = 'Đã tải SDK, mở rộng khung và báo sẵn sàng; chưa đổi màu';
  } catch (error) {
    stage = error.message;
    initialize.disabled = false;
  }
  showDetails();
});

color.addEventListener('click', () => {
  try {
    for (const [method, version] of [
      ['setBackgroundColor', '6.1'],
      ['setBottomBarColor', '7.10'],
    ])
      if (typeof app[method] === 'function' && app.isVersionAtLeast(version))
        app[method]('#ffffff');
    stage = 'Đã gửi màu trắng cho nền và thanh đáy Telegram';
  } catch (error) {
    stage = 'Không đổi được màu: ' + error.message;
  }
  showDetails();
});

fullscreen.addEventListener('click', () => {
  try {
    if (app.isFullscreen) app.exitFullscreen();
    else app.requestFullscreen();
    stage = 'Đã gửi yêu cầu thay đổi chế độ toàn màn hình';
  } catch (error) {
    stage = 'Không đổi được chế độ toàn màn hình: ' + error.message;
  }
  showDetails();
});

addEventListener('resize', showDetails);
showDetails();
