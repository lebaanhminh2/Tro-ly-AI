import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
export function webScripts(root = 'web') {
    return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
        const path = join(root, entry.name);
        return entry.isDirectory() ? webScripts(path) : entry.name.endsWith('.js') ? [path] : [];
    }).sort();
}
for (const path of webScripts()) {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) {
        process.stderr.write(result.stderr || String(result.error));
        process.exit(1);
    }
}
console.log('Syntax checked all ' + webScripts().length + ' web modules.');
