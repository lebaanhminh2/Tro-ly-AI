// Build an offline document from production domain and web modules.
// Run: node scripts/build-cultivation-demo.mjs
import { build, transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({ entryPoints: [resolve(root, 'docs/prototypes/cultivation/demo.js')],
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', minify: true, charset: 'utf8' });
const script = result.outputFiles[0].text.replaceAll('./assets/than-lo/', '../../../web/assets/than-lo/').replaceAll('</script', '<\\/script');
const appCss = await readFile(resolve(root, 'web/styles.css'), 'utf8');
const previewCss = `
.demo-shell{max-width:640px;margin:auto;padding:0 18px 32px}
.demo-toolbar{position:sticky;top:0;z-index:10;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0;display:flex;align-items:center;gap:8px;font-size:12px}
.demo-toolbar>div{flex:1;min-width:0}.demo-toolbar small{display:block;color:var(--muted);margin-top:2px}.demo-toolbar button{padding:8px 10px;font-size:12px;white-space:nowrap}
.demo-footer{border-top:1px solid var(--line);margin-top:24px;padding-top:14px;font-size:12px;color:var(--muted)}
#toast{position:fixed;inset:auto 16px 20px;margin:auto;max-width:520px;z-index:100;background:var(--text);color:var(--surface);padding:14px 18px;border-radius:12px;font-size:13px}
#toast[hidden]{display:none}button:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
dialog:not([open]){display:none}dialog .actions{flex-shrink:0}dialog .settings-sheet-body>h3{margin:18px 0 8px}
@media(max-width:360px){.demo-shell{padding:0 12px 24px}.demo-toolbar{flex-wrap:wrap}.demo-toolbar>div{flex-basis:100%}}
`;
const css = (await transform(appCss + previewCss, { loader: 'css', minify: true })).code.replaceAll('</style', '<\\/style');
const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: file:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'">
<title>Tu luyện · Bản thử tương tác</title><style>${css}</style></head>
<body><div class="demo-shell"><header class="demo-toolbar"><div>Bản thử Tu luyện<small id="demo-day"></small></div>
<button id="demo-controls" type="button" class="secondary">Thử nhanh</button>
<button id="demo-advance" type="button" class="primary">Sang ngày</button></header>
<main></main><p class="demo-footer">Dữ liệu mẫu riêng · Có thể đặt lại trong Thử nhanh. Công pháp, nâng cấp và chiến đấu dùng logic và UI của app.</p></div>
<dialog id="sheet" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div id="sheet-content"></div></dialog>
<div id="toast" role="status" aria-live="polite" hidden></div>
<script>${script}</script></body></html>
`;
const output = resolve(root, 'docs/prototypes/cultivation/kiem-y-demo.html');
await writeFile(output, html, 'utf8');
console.log('Built standalone cultivation demo: ' + Buffer.byteLength(html) + ' bytes; production domain/UI bundled, network disabled.');
