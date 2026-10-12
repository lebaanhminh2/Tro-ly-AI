import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// Read-only tail. Keep only operational fields; never persist request headers,
// bodies, query strings, messages, log arguments, exceptions or credentials.
const secondsIndex = process.argv.indexOf('--seconds'), reportIndex = process.argv.indexOf('--report');
const seconds = Number(process.argv[secondsIndex + 1]), report = process.argv[reportIndex + 1];
if (secondsIndex < 0 || reportIndex < 0 || !report || !Number.isInteger(seconds) || seconds < 60 || seconds > 900)
    throw Error('USE_--seconds_60_TO_900_--report_NEW_JSON_PATH');
const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx.cmd wrangler tail --env staging --format json'], { windowsHide: true })
    : spawn('npx', ['wrangler', 'tail', '--env', 'staging', '--format', 'json']);
let buffer = '', depth = 0, inString = false, escaped = false, collecting = false;
let stderrReceived = false, parseErrors = 0, timedStop = false;
const events = [];
function accept(text) {
    try {
        const value = JSON.parse(text);
        if (value.scriptName && value.scriptName !== 'personal-assistant-staging') return;
        const request = value.event?.request;
        let path = null;
        if (typeof request?.url === 'string') {
            try { path = new URL(request.url).pathname; } catch { return; }
        }
        const number = key => typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] : null;
        events.push({ timestamp: value.eventTimestamp ?? null, type: request ? 'request' : value.event?.cron ? 'scheduled' : 'other',
            method: request?.method ?? null, path, status: value.event?.response?.status ?? null,
            outcome: value.outcome ?? null, cpuMs: number('cpuTime'), wallMs: number('wallTime'),
            version: value.scriptVersion?.id ?? null });
    } catch { parseErrors++; }
}
child.stdout.on('data', chunk => {
    for (const character of chunk.toString('utf8')) {
        if (!collecting) {
            if (character !== '{') continue;
            collecting = true; depth = 1; buffer = '{'; inString = false; escaped = false; continue;
        }
        buffer += character;
        if (inString) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') inString = false;
        } else if (character === '"') inString = true;
        else if (character === '{') depth++;
        else if (character === '}' && --depth === 0) { accept(buffer); collecting = false; buffer = ''; }
        if (buffer.length > 2 * 1024 * 1024) { parseErrors++; buffer = ''; collecting = false; }
    }
});
child.stderr.on('data', () => { stderrReceived = true; });
child.on('error', () => { process.exitCode = 1; });
const stop = () => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
};
const timer = setTimeout(() => { timedStop = true; stop(); }, seconds * 1000);
process.once('SIGINT', () => { timedStop = true; stop(); });
child.on('close', code => {
    clearTimeout(timer);
    const observed = events.filter(event => event.cpuMs !== null);
    const result = { format: 'assistant-staging-readonly-tail', version: 1, requestedSeconds: seconds,
        timedStop, childExitCode: code, stderrReceived, parseErrors, events,
        cpuAvailable: observed.length > 0, maxObservedCpuMs: observed.length ? Math.max(...observed.map(event => event.cpuMs)) : null,
        limitation: 'Natural live traffic only; missing CPU fields are not zero. This sample is not a large synthetic remote benchmark or a claim about unobserved phases.' };
    writeFileSync(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' });
    console.log(JSON.stringify({ events: events.length, cpuAvailable: result.cpuAvailable, maxObservedCpuMs: result.maxObservedCpuMs, parseErrors }));
    if (!timedStop && code !== 0) process.exitCode = 1;
});
